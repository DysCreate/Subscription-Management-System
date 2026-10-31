import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PortalService } from './portal.service';

@ApiTags('portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('subscriptions')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get customer subscriptions (scoped to JWT customerId)' })
  getSubscriptions(@CurrentUser('customerId') customerId: string | null) {
    return this.portalService.getSubscriptions(customerId);
  }

  @Get('invoices')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get customer invoices (scoped to JWT customerId)' })
  getInvoices(
    @CurrentUser('customerId') customerId: string | null,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: any,
  ) {
    return this.portalService.getInvoices(customerId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  @Get('invoices/:id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get customer invoice detail (scoped to JWT customerId)' })
  getInvoice(@Param('id') id: string, @CurrentUser('customerId') customerId: string | null) {
    return this.portalService.getInvoice(id, customerId);
  }
}
