import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const lowerCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignupDto {
  @ApiProperty({ example: 'priya@brightloop.example' })
  @Transform(lowerCase)
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @ApiProperty({ example: 'Str0ng!pass' })
  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password: string;

  @ApiProperty({ example: 'Priya Menon' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ required: false, example: '+91 90000 00000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@subloop.local' })
  @Transform(lowerCase)
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @ApiProperty({ example: 'Str0ng!pass' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'priya@brightloop.example' })
  @Transform(lowerCase)
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewStr0ng!pass' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
