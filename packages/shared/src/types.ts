import { Role } from './constants';

/** Shape of the JWT access token payload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  customerId?: string | null;
}

/** Shape of the JWT refresh token payload. */
export interface RefreshTokenPayload {
  sub: string;
  tokenType: 'refresh';
  nonce: string;
}

/** Serialisable user returned by the API (never contains password hashes). */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  customerId: string | null;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp?: string;
}
