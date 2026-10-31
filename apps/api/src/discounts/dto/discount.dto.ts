import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DISCOUNT_SCOPES, DISCOUNT_TYPES, type DiscountScope, type DiscountType } from '@subloop/shared';

export class CreateDiscountDto {
  @ApiProperty({ example: 'Diwali 10% off' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: DISCOUNT_TYPES, example: 'PERCENT' })
  @IsEnum(DISCOUNT_TYPES)
  type: DiscountType;

  @ApiProperty({ example: 10, description: 'Percent value or fixed amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @ApiProperty({ required: false, example: 5000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPurchase?: number;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity?: number;

  @ApiProperty({ required: false, example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2026-03-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({ enum: DISCOUNT_SCOPES, default: 'SUBSCRIPTION' })
  @IsEnum(DISCOUNT_SCOPES)
  scope: DiscountScope;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Product ids when scope=PRODUCT',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}
