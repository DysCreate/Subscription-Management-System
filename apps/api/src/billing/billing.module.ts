import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingQueueService } from './billing.queue';
import { BillingService } from './billing.service';
import { InvoiceEmailService } from './invoice-email.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingQueueService, InvoiceEmailService],
  exports: [BillingService, BillingQueueService, InvoiceEmailService],
})
export class BillingModule {}
