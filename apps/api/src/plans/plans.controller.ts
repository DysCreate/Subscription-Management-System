import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BillingPeriod } from '@subloop/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('billingPeriod') billingPeriod?: BillingPeriod,
    @Query('isActive') isActive?: string,
  ) {
    return this.plansService.list({ page, limit, search, billingPeriod, isActive });
  }

  @Get(':id')
  @Roles('ADMIN', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a plan with period, min qty and lifecycle flags' })
  create(@Body() dto: CreatePlanDto, @CurrentUser('id') actorId: string) {
    return this.plansService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.plansService.update(id, dto, actorId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.plansService.deactivate(id, actorId);
  }
}
