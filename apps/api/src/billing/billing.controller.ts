import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { BillingQueueService } from './billing.queue';
import { BillingService } from './billing.service';
import { QueryBillingRunsDto, RunBillingDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingQueue: BillingQueueService,
  ) {}

  @Post('run')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Queue a billing run now (admin only)' })
  async run(
    @Body() dto: RunBillingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : new Date();
    return this.billingQueue.enqueueBillingRun(asOfDate, `manual:${user.email}`);
  }

  @Get('runs')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'List recent billing runs' })
  list(@Query() query: QueryBillingRunsDto) {
    return this.billingService.listRuns(query.limit);
  }

  @Get('runs/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Billing run summary (created / skipped / failed)' })
  get(@Param('id') id: string) {
    return this.billingService.getRun(id);
  }
}
