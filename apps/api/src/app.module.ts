import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuditModule } from './common/audit/audit.module';
import { MailModule } from './common/mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CustomersModule } from './customers/customers.module';
import { DiscountsModule } from './discounts/discounts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { PortalModule } from './portal/portal.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { QuotationTemplatesModule } from './quotation-templates/quotation-templates.module';
import { ReportsModule } from './reports/reports.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TaxesModule } from './taxes/taxes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Global default: 120 requests/min per IP. Auth routes tighten this with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    PlansModule,
    TaxesModule,
    DiscountsModule,
    QuotationTemplatesModule,
    BillingModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    PortalModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
