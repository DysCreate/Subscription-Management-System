import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { QueryOverdueDto, QueryReportDto } from './dto/query-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Reports summary with deltas' })
  summary(@Query() query: QueryReportDto) {
    return this.reportsService.summary(query.from, query.to);
  }

  @Get('revenue-by-month')
  @Roles('ADMIN', 'STAFF')
  revenueByMonth() {
    return this.reportsService.revenueByMonth();
  }

  @Get('payments-by-method')
  @Roles('ADMIN', 'STAFF')
  paymentsByMethod() {
    return this.reportsService.paymentsByMethod();
  }

  @Get('subscriptions-by-status')
  @Roles('ADMIN', 'STAFF')
  subscriptionsByStatus() {
    return this.reportsService.subscriptionsByStatus();
  }

  @Get('new-vs-churned')
  @Roles('ADMIN', 'STAFF')
  newVsChurned() {
    return this.reportsService.newVsChurned();
  }

  @Get('overdue')
  @Roles('ADMIN', 'STAFF')
  overdue(@Query() query: QueryOverdueDto) {
    return this.reportsService.overdue(query.page, query.limit);
  }

  @Get('renewals-upcoming')
  @Roles('ADMIN', 'STAFF')
  renewalsUpcoming() {
    return this.reportsService.renewalsUpcoming();
  }

  @Get('export.csv')
  @Roles('ADMIN', 'STAFF')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="reports.csv"')
  async exportCsv(@Query() query: QueryReportDto, @Res() res: Response) {
    const csv = await this.reportsService.exportCsv(query.from, query.to);
    res.send(csv);
  }
}
