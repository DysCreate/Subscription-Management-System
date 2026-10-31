import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BILLING_PERIODS, type BillingPeriod } from '@subloop/shared';

export class CreatePlanDto {
  @ApiProperty({ example: 'Odoo Monthly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 1450 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ enum: BILLING_PERIODS, example: 'MONTHLY' })
  @IsEnum(BILLING_PERIODS)
  billingPeriod: BillingPeriod;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity?: number;

  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'availableFrom must be an ISO date.' })
  availableFrom?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'availableTo must be an ISO date.' })
  availableTo?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoClose?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  closable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  pausable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  renewable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
