import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PRODUCT_TYPES = ['GOODS', 'SERVICE', 'SUBSCRIPTION'] as const;
export type ProductTypeValue = (typeof PRODUCT_TYPES)[number];

export class ProductVariantDto {
  @ApiProperty({ example: 'Brand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  attribute: string;

  @ApiProperty({ example: 'Odoo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  value: string;

  @ApiProperty({ example: 560, description: 'Extra price added to the product sales price' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraPrice: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Odoo Subscription Module' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: PRODUCT_TYPES, default: 'SERVICE' })
  @IsEnum(PRODUCT_TYPES)
  type: ProductTypeValue;

  @ApiProperty({ example: 1200 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesPrice: number;

  @ApiProperty({ example: 700 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
