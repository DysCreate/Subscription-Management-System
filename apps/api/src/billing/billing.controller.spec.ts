import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { BillingController } from './billing.controller';
import { BillingQueueService } from './billing.queue';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  const billingService = {
    listRuns: jest.fn(),
    getRun: jest.fn(),
  };
  const billingQueue = {
    enqueueBillingRun: jest.fn(),
  };

  let controller: BillingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BillingController(
      billingService as unknown as BillingService,
      billingQueue as unknown as BillingQueueService,
    );
  });

  it('marks POST /billing/run as admin-only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BillingController.prototype.run)).toEqual(['ADMIN']);
  });

  it('enqueues a run and returns its id', async () => {
    billingQueue.enqueueBillingRun.mockResolvedValue({
      runId: 'run-1',
      jobId: 'billing-run:run-1',
      mode: 'QUEUED',
    });

    const result = await controller.run(
      { asOfDate: '2026-01-31' },
      { id: 'user-1', email: 'admin@subloop.local', role: 'ADMIN', customerId: null },
    );

    expect(result).toEqual({
      runId: 'run-1',
      jobId: 'billing-run:run-1',
      mode: 'QUEUED',
    });
    expect(billingQueue.enqueueBillingRun).toHaveBeenCalledWith(
      new Date('2026-01-31'),
      'manual:admin@subloop.local',
    );
  });

  it('lists and fetches billing runs', async () => {
    billingService.listRuns.mockResolvedValue([{ id: 'run-1' }]);
    billingService.getRun.mockResolvedValue({ id: 'run-1' });

    await expect(controller.list({ limit: 10 })).resolves.toEqual([{ id: 'run-1' }]);
    await expect(controller.get('run-1')).resolves.toEqual({ id: 'run-1' });
    expect(billingService.listRuns).toHaveBeenCalledWith(10);
    expect(billingService.getRun).toHaveBeenCalledWith('run-1');
  });
});
