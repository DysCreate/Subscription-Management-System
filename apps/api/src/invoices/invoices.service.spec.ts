import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

describe('InvoicesService transitions', () => {
  let service: InvoicesService;
  const prisma: any = {
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditService: any = { record: jest.fn() };
  const mailService: any = { send: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoicesService(prisma, auditService, mailService);
  });

  it('should not allow cancelling a PAID invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: '1',
      status: InvoiceStatus.PAID,
      payments: [],
    });
    await expect(service.cancel('1', 'actor')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should not allow cancelling invoice with payments', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: '1',
      status: InvoiceStatus.CONFIRMED,
      payments: [{ id: 'p1' }],
    });
    await expect(service.cancel('1', 'actor')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm only from DRAFT', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: '1', status: InvoiceStatus.CONFIRMED });
    await expect(service.confirm('1', 'actor')).rejects.toBeInstanceOf(BadRequestException);
  });
});
