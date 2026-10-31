import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Phase 3 background worker.
 *
 * Runs in-process via @nestjs/schedule so the API stays demoable without a
 * Redis/BullMQ worker; the jobs themselves are batched and idempotent, so they
 * can be lifted into a BullMQ processor later without behaviour changes.
 */
@Injectable()
export class SubscriptionsScheduler {
  private readonly logger = new Logger(SubscriptionsScheduler.name);
  private autoCloseRunning = false;

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runAutoClose(): Promise<void> {
    if (this.autoCloseRunning) return;
    this.autoCloseRunning = true;
    try {
      const { closed } = await this.subscriptionsService.autoCloseExpired();
      this.logger.log(`Auto-close run finished: ${closed} subscription(s) closed`);
    } catch (error) {
      this.logger.error(`Auto-close run failed: ${(error as Error).message}`);
    } finally {
      this.autoCloseRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runQuotationExpiry(): Promise<void> {
    try {
      const { expired } = await this.subscriptionsService.expireQuotations();
      if (expired > 0) this.logger.log(`Quotation expiry: ${expired} expired`);
    } catch (error) {
      this.logger.error(`Quotation expiry run failed: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  logHeartbeat(): void {
    this.logger.debug('Subscription workers are alive');
  }
}
