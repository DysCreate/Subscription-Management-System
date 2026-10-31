import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Brightloop Retail Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'accounts@brightloop.example' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @ApiProperty({ required: false, example: '+91 90000 00000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ required: false, example: '12 Marine Drive, Kochi 682001' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  billingAddress?: string;

  @ApiProperty({ required: false, example: '32ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
