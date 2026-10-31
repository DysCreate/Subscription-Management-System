import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { InvoicesService } from './invoices.service';
import { QueryInvoiceDto } from './dto/query-invoice.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'List invoices (server-side pagination, sort, filters)' })
  findAll(@Query() query: QueryInvoiceDto) {
    return this.invoicesService.findAll({ ...query, actorRole: 'ADMIN' });
  }

  @Get(':id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Get invoice with lines, discounts, payments' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post(':id/confirm')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Confirm invoice' })
  confirm(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.invoicesService.confirm(id, actorId);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Cancel invoice' })
  cancel(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.invoicesService.cancel(id, actorId);
  }

  @Post(':id/send')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Send invoice (queue email, stub if none)' })
  send(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.invoicesService.send(id, actorId);
  }

  @Get(':id/pdf')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.invoicesService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
    });
    res.send(pdf);
  }
}
