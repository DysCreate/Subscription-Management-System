import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SubscriptionStatus } from '@subloop/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  CreateSubscriptionDto,
  CreateSubscriptionFromTemplateDto,
  SendQuotationDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create a draft subscription (auto-numbered)' })
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.create(dto, actorId);
  }

  @Post('from-template/:templateId')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create a draft subscription from a quotation template' })
  createFromTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: CreateSubscriptionFromTemplateDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.subscriptionsService.createFromTemplate(templateId, dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List subscriptions (customers see only their own)' })
  findAll(
    @CurrentUser() viewer: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SubscriptionStatus,
    @Query('customerId') customerId?: string,
    @Query('planId') planId?: string,
    @Query('search') search?: string,
  ) {
    return this.subscriptionsService.findAll(viewer, {
      page,
      limit,
      status,
      customerId,
      planId,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Subscription detail (customers see only their own)' })
  findOne(@Param('id') id: string, @CurrentUser() viewer: AuthenticatedUser) {
    return this.subscriptionsService.findOne(id, viewer);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Status history timeline' })
  history(@Param('id') id: string, @CurrentUser() viewer: AuthenticatedUser) {
    return this.subscriptionsService.history(id, viewer);
  }

  @Patch(':id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Edit a draft/quotation subscription' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.subscriptionsService.update(id, dto, actorId);
  }

  @Post(':id/send-quotation')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Draft -> Quotation (starts the validity window)' })
  sendQuotation(
    @Param('id') id: string,
    @Body() dto: SendQuotationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.subscriptionsService.sendQuotation(id, actorId, dto.validityDays);
  }

  @Post(':id/confirm')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Draft/Quotation -> Confirmed' })
  confirm(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.confirm(id, actorId);
  }

  @Post(':id/activate')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Confirmed -> Active (starts billing)' })
  activate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.activate(id, actorId);
  }

  @Post(':id/pause')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Active -> Paused (plan must be pausable)' })
  pause(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.pause(id, actorId);
  }

  @Post(':id/resume')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Paused -> Active (shifts the next billing date)' })
  resume(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.resume(id, actorId);
  }

  @Post(':id/renew')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Extend the term by one plan period (plan must be renewable)' })
  renew(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.renew(id, actorId);
  }

  @Post(':id/close')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Close a subscription (early close requires a closable plan)' })
  close(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.subscriptionsService.close(id, actorId);
  }
}
