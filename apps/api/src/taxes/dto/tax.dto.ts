import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TAX_TYPES, type TaxType } from '@subloop/shared';

export class CreateTaxDto {
  @ApiProperty({ example: 'GST 18%' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: TAX_TYPES, example: 'PERCENT' })
  @IsEnum(TAX_TYPES)
  type: TaxType;

  @ApiProperty({ example: 18, description: 'Percent value, or a fixed amount when type=FIXED' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxDto extends PartialType(CreateTaxDto) {}
