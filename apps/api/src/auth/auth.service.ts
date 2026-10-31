import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import {
  AuthUser,
  LoginResponse,
  RefreshTokenPayload,
  passwordPolicyMessage,
  validatePassword,
} from '@subloop/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { MailService } from '../common/mail/mail.service';
import {
  BCRYPT_ROUNDS,
  REFRESH_COOKIE_NAME,
  accessTokenSecret,
  accessTokenTtlSeconds,
  passwordResetTtlMinutes,
  refreshTokenSecret,
  refreshTokenTtlSeconds,
} from '../config/auth.config';
import { env, isProduction } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, SignupDto } from './dto/auth.dto';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // Password helpers (shared policy, enforced server-side)
  // ---------------------------------------------------------------------

  static assertPasswordPolicy(password: string): void {
    const { valid, errors } = validatePassword(password);
    if (!valid) {
      throw new BadRequestException([passwordPolicyMessage(), ...errors]);
    }
  }

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static toAuthUser(
    user: Pick<User, 'id' | 'email' | 'role' | 'customerId' | 'isActive'>,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      isActive: user.isActive,
    };
  }

  // ---------------------------------------------------------------------
  // Tokens & cookies
  // ---------------------------------------------------------------------

  private async issueTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const expiresIn = accessTokenTtlSeconds();
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, customerId: user.customerId },
      { secret: accessTokenSecret(), expiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenType: 'refresh', nonce: randomBytes(16).toString('hex') },
      { secret: refreshTokenSecret(), expiresIn: refreshTokenTtlSeconds() },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: sha256(refreshToken) },
    });

    return { accessToken, refreshToken, expiresIn };
  }

  setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: isProduction() ? 'strict' : 'lax',
      path: '/',
      maxAge: refreshTokenTtlSeconds() * 1000,
    });
  }

  clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  // ---------------------------------------------------------------------
  // Flows
  // ---------------------------------------------------------------------

  /** Self-service signup always creates a CUSTOMER account plus its customer row. */
  async signup(dto: SignupDto, response: Response): Promise<LoginResponse> {
    AuthService.assertPasswordPolicy(dto.password);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await AuthService.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { name: dto.name, email: dto.email, phone: dto.phone ?? null },
      });
      return tx.user.create({
        data: { email: dto.email, passwordHash, role: 'CUSTOMER', customerId: customer.id },
      });
    });

    await this.auditService.record({
      actorId: user.id,
      entity: 'user',
      entityId: user.id,
      action: 'SIGNUP',
      diff: { email: user.email, role: user.role },
    });

    const { accessToken, refreshToken, expiresIn } = await this.issueTokens(user);
    this.setRefreshCookie(response, refreshToken);
    return { accessToken, tokenType: 'Bearer', expiresIn, user: AuthService.toAuthUser(user) };
  }

  async login(dto: LoginDto, response: Response): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Identical message for unknown email and wrong password: no enumeration.
    const invalid = new UnauthorizedException('Invalid email or password.');
    if (!user) throw invalid;

    const passwordMatches = await AuthService.verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches) throw invalid;
    if (!user.isActive) throw new UnauthorizedException('This account has been deactivated.');

    const { accessToken, refreshToken, expiresIn } = await this.issueTokens(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    this.setRefreshCookie(response, refreshToken);
    return { accessToken, tokenType: 'Bearer', expiresIn, user: AuthService.toAuthUser(user) };
  }

  async refresh(refreshToken: string | undefined, response: Response): Promise<LoginResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token.');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: refreshTokenSecret(),
      });
    } catch {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Session is no longer valid.');
    }

    // Rotation: the presented token must be the one issued last time.
    if (user.refreshTokenHash !== sha256(refreshToken)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      this.clearRefreshCookie(response);
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const tokens = await this.issueTokens(user);
    this.setRefreshCookie(response, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: AuthService.toAuthUser(user),
    };
  }

  async logout(userId: string, response: Response): Promise<{ success: true }> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    this.clearRefreshCookie(response);
    return { success: true };
  }

  /**
   * Always returns the same generic response so the endpoint cannot be used to
   * discover which emails have accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const genericMessage =
      'If an account exists for that email, a password reset link has been sent.';

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const ttlMinutes = passwordResetTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.prisma.$transaction([
      // Only the newest link may be used.
      this.prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt },
      }),
    ]);

    const resetUrl = `${env('WEB_APP_URL', 'http://localhost:3000')}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordReset(user.email, resetUrl, ttlMinutes);
    this.logger.log(`Password reset link generated for user ${user.id}`);

    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    AuthService.assertPasswordPolicy(dto.password);

    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }

    const passwordHash = await AuthService.hashPassword(dto.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, refreshTokenHash: null },
      }),
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.passwordReset.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      actorId: record.userId,
      entity: 'user',
      entityId: record.userId,
      action: 'PASSWORD_RESET',
    });

    return { message: 'Your password has been reset. You can now sign in.' };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }
    return AuthService.toAuthUser(user);
  }
}
