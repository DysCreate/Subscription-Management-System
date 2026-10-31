import { BillingQueueService } from './billing.queue';
import { BillingService } from './billing.service';
import { InvoiceEmailService } from './invoice-email.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingQueueService', () => {
  const billingService = {
    createRun: jest.fn(),
    runBilling: jest.fn(),
  };
  const invoiceEmailService = {
    sendForInvoice: jest.fn(),
  };
  const prisma = {
    invoice: { findMany: jest.fn() },
  };

  let service: BillingQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingQueueService(
      billingService as unknown as BillingService,
      invoiceEmailService as unknown as InvoiceEmailService,
      prisma as unknown as PrismaService,
    );
  });

  it('runs inline and still returns the pre-created run id when Redis is unavailable', async () => {
    const run = { id: 'run-1', startedAt: new Date(), finishedAt: null, created: 0, skipped: 0, failed: 0, triggeredBy: 'manual:test' };
    billingService.createRun.mockResolvedValue(run);
    billingService.runBilling.mockResolvedValue({ ...run, created: 2, finishedAt: new Date() });

    const asOf = new Date('2026-01-31T00:00:00.000Z');
    const result = await service.enqueueBillingRun(asOf, 'manual:test');

    expect(result).toEqual({ runId: 'run-1', mode: 'INLINE' });
    expect(billingService.createRun).toHaveBeenCalledWith('manual:test');
    expect(billingService.runBilling).toHaveBeenCalledWith(asOf, 'manual:test', 'run-1');
  });

  it('does not query invoices for email jobs when the queue is unavailable', async () => {
    await expect(service.enqueueRecentInvoiceEmails()).resolves.toEqual({ enqueued: 0 });
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
});
