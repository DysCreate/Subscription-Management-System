import { Module } from '@nestjs/common';
import { QuotationTemplatesController } from './quotation-templates.controller';
import { QuotationTemplatesService } from './quotation-templates.service';

@Module({
  controllers: [QuotationTemplatesController],
  providers: [QuotationTemplatesService],
  exports: [QuotationTemplatesService],
})
export class QuotationTemplatesModule {}
