import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ROLES, type Role } from '@subloop/shared';

const lowerCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateStaffDto {
  @ApiProperty({ example: 'staff@subloop.local' })
  @Transform(lowerCase)
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @ApiProperty({ example: 'Str0ng!pass' })
  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password: string;

  @ApiProperty({ required: false, enum: ['STAFF', 'ADMIN'], default: 'STAFF' })
  @IsOptional()
  @IsIn(['STAFF', 'ADMIN'], { message: 'Role must be STAFF or ADMIN.' })
  role?: Role;

  @ApiProperty({ required: false, description: 'Attach the login to a customer record' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, enum: ROLES })
  @IsOptional()
  @IsIn(ROLES as unknown as string[])
  role?: Role;

  @ApiProperty({ required: false, description: 'Attach or detach a customer record' })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({ required: false, example: 'Staff' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;
}
