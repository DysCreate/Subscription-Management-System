import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class RunBillingDto {
  @ApiPropertyOptional({
    description: 'Bill subscriptions due on or before this date. Defaults to today (UTC).',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class QueryBillingRunsDto {
  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
