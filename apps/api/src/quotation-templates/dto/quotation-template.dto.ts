import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuotationTemplateLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateQuotationTemplateDto {
  @ApiProperty({ example: 'Odoo monthly starter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiProperty({ required: false, default: 30, description: 'Quotation validity in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [QuotationTemplateLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A quotation template needs at least one line.' })
  @ValidateNested({ each: true })
  @Type(() => QuotationTemplateLineDto)
  lines: QuotationTemplateLineDto[];
}

export class UpdateQuotationTemplateDto extends PartialType(CreateQuotationTemplateDto) {}
