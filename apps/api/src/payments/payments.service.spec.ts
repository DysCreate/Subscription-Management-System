import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService validation', () => {
  let service: PaymentsService;
  const prisma: any = {
    $transaction: jest.fn(),
  };
  const auditService: any = { record: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(prisma, auditService);
  });

  it('rejects amount <= 0', async () => {
    await expect(
      service.create({ invoiceId: '1', method: 'CASH' as any, amount: 0, paidOn: '2026-01-01' }, 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates invoice is CONFIRMED', async () => {
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({ id: '1', status: InvoiceStatus.DRAFT, total: 100, amountPaid: 0 }),
        },
      };
      return cb(tx);
    });
    await expect(
      service.create({ invoiceId: '1', method: 'CASH' as any, amount: 50, paidOn: '2026-01-01' }, 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects amount > balance', async () => {
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({ id: '1', status: InvoiceStatus.CONFIRMED, total: 100, amountPaid: 80 }),
        },
      };
      return cb(tx);
    });
    await expect(
      service.create({ invoiceId: '1', method: 'CASH' as any, amount: 30, paidOn: '2026-01-01' }, 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
