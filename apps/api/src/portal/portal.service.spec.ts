import { ForbiddenException } from '@nestjs/common';
import { PortalService } from './portal.service';

describe('PortalService customer isolation', () => {
  let service: PortalService;
  const prisma: any = {
    subscription: { findMany: jest.fn() },
    invoice: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortalService(prisma);
  });

  it('filters subscriptions by customerId from JWT', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    await service.getSubscriptions('cust-123');
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'cust-123' } }),
    );
  });

  it('denies access to another customer invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      customerId: 'cust-999',
    });
    await expect(service.getInvoice('inv-1', 'cust-123')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
