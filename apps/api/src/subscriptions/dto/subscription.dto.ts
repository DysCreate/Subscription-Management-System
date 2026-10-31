import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubscriptionLineDto {
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

  @ApiProperty({
    required: false,
    description: 'Defaults to product sales price + variant extra price',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  taxId?: string;
}

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiProperty({ required: false, example: '2026-02-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2027-01-31' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false, example: 'NET_15' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentTerms?: string;

  @ApiProperty({ type: [SubscriptionLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A subscription needs at least one line.' })
  @ValidateNested({ each: true })
  @Type(() => SubscriptionLineDto)
  lines: SubscriptionLineDto[];
}

export class CreateSubscriptionFromTemplateDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false, example: 'NET_15' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentTerms?: string;
}

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionFromTemplateDto) {
  @ApiProperty({ required: false, type: [SubscriptionLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubscriptionLineDto)
  lines?: SubscriptionLineDto[];
}

export class SendQuotationDto {
  @ApiProperty({ required: false, description: 'Defaults to the template or 30 days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;
}
