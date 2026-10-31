import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { startOfUtcDay } from '../common/billing-period/billing-period';
import { PrismaService } from '../prisma/prisma.service';
import {
  billingCronPattern,
  billingCronTimezone,
  redisUrl,
} from './billing.config';
import { BillingService } from './billing.service';
import { InvoiceEmailService } from './invoice-email.service';

export const BILLING_QUEUE = 'billing';
export const RUN_BILLING_JOB = 'run-billing';
export const INVOICE_EMAIL_JOB = 'invoice-email';
const DAILY_BILLING_SCHEDULER = 'daily-billing';

interface RunBillingJobData {
  asOfDate?: string;
  triggeredBy?: string;
  runId?: string;
}

interface InvoiceEmailJobData {
  invoiceId: string;
}

@Injectable()
export class BillingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private queueConnection: IORedis | null = null;
  private workerConnection: IORedis | null = null;

  constructor(
    private readonly billingService: BillingService,
    private readonly invoiceEmailService: InvoiceEmailService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.queueConnection = new IORedis(redisUrl(), {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      this.queueConnection.on('error', (error) => {
        this.logger.warn(`Redis (queue) error: ${error.message}`);
      });

      this.workerConnection = new IORedis(redisUrl(), {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      this.workerConnection.on('error', (error) => {
        this.logger.warn(`Redis (worker) error: ${error.message}`);
      });

      this.queue = new Queue(BILLING_QUEUE, { connection: this.queueConnection });
      this.worker = new Worker(BILLING_QUEUE, (job) => this.process(job), {
        connection: this.workerConnection,
        concurrency: 1,
      });

      this.worker.on('failed', (job, error) => {
        this.logger.error(`Billing job ${job?.id ?? 'unknown'} failed: ${error.message}`);
      });
      this.worker.on('error', (error) => {
        this.logger.warn(`Billing worker error: ${error.message}`);
      });

      await this.registerRepeatableJob();
      this.logger.log(
        `Billing queue ready (daily run ${billingCronPattern()} ${billingCronTimezone()})`,
      );
    } catch (error) {
      // The API must stay usable for manual actions even if Redis is not up.
      this.logger.warn(
        `Billing queue unavailable, falling back to inline runs: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.worker?.close(),
      this.queue?.close(),
      this.queueConnection?.quit(),
      this.workerConnection?.quit(),
    ]);
  }

  /**
   * Queues a manual billing run. The BillingRun row is created first so the
   * API can return its id immediately; the worker fills in the counts.
   */
  async enqueueBillingRun(
    asOfDate: Date,
    triggeredBy: string,
  ): Promise<{ runId: string; jobId?: string; mode: 'QUEUED' | 'INLINE' }> {
    const run = await this.billingService.createRun(triggeredBy);

    if (!this.queue) {
      await this.billingService.runBilling(asOfDate, triggeredBy, run.id);
      return { runId: run.id, mode: 'INLINE' };
    }

    try {
      const job = await this.queue.add(
        RUN_BILLING_JOB,
        {
          asOfDate: startOfUtcDay(asOfDate).toISOString(),
          triggeredBy,
          runId: run.id,
        } satisfies RunBillingJobData,
        {
          jobId: `billing-run:${run.id}`,
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 7 * 86_400, count: 1_000 },
        },
      );
      return { runId: run.id, jobId: String(job.id), mode: 'QUEUED' };
    } catch (error) {
      this.logger.warn(
        `Could not enqueue billing run ${run.id}; running inline instead: ${(error as Error).message}`,
      );
      await this.billingService.runBilling(asOfDate, triggeredBy, run.id);
      return { runId: run.id, mode: 'INLINE' };
    }
  }

  /**
   * Scheduler hook: queue an email for every recently created confirmed
   * invoice. `jobId` deduplicates repeated scheduler ticks and retries.
   */
  async enqueueRecentInvoiceEmails(sinceMinutes = 24 * 60): Promise<{ enqueued: number }> {
    if (!this.queue) return { enqueued: 0 };

    const since = new Date(Date.now() - sinceMinutes * 60_000);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PAID'] },
        createdAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    let enqueued = 0;
    for (const invoice of invoices) {
      try {
        await this.queue.add(
          INVOICE_EMAIL_JOB,
          { invoiceId: invoice.id } satisfies InvoiceEmailJobData,
          {
            jobId: `invoice-email:${invoice.id}`,
            removeOnComplete: { age: 7 * 86_400, count: 5_000 },
            removeOnFail: { age: 7 * 86_400, count: 5_000 },
          },
        );
        enqueued += 1;
      } catch (error) {
        this.logger.warn(
          `Could not enqueue invoice email ${invoice.id}: ${(error as Error).message}`,
        );
      }
    }

    return { enqueued };
  }

  private async registerRepeatableJob(): Promise<void> {
    if (!this.queue) return;
    await this.queue.upsertJobScheduler(
      DAILY_BILLING_SCHEDULER,
      {
        pattern: billingCronPattern(),
        tz: billingCronTimezone(),
      },
      {
        name: RUN_BILLING_JOB,
        data: { triggeredBy: 'scheduler:daily' } satisfies RunBillingJobData,
        opts: {
          removeOnComplete: { age: 86_400, count: 100 },
          removeOnFail: { age: 7 * 86_400, count: 100 },
        },
      },
    );
  }

  private async process(job: Job): Promise<unknown> {
    if (job.name === RUN_BILLING_JOB) {
      const data = job.data as RunBillingJobData;
      return this.billingService.runBilling(
        data.asOfDate ? new Date(data.asOfDate) : new Date(),
        data.triggeredBy ?? 'scheduler',
        data.runId,
      );
    }

    if (job.name === INVOICE_EMAIL_JOB) {
      const data = job.data as InvoiceEmailJobData;
      await this.invoiceEmailService.sendForInvoice(data.invoiceId);
      return { sent: true };
    }

    this.logger.warn(`Unknown billing job: ${job.name}`);
    return { ignored: true };
  }
}
