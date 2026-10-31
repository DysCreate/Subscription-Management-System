import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discount.dto';

@ApiTags('discounts')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @ApiOperation({ summary: 'List discount rules (admin only)' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: 'PRODUCT' | 'SUBSCRIPTION',
    @Query('isActive') isActive?: string,
  ) {
    return this.discountsService.list({ page, limit, search, scope, isActive });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a fixed/percent discount rule (admin only)' })
  create(@Body() dto: CreateDiscountDto, @CurrentUser('id') actorId: string) {
    return this.discountsService.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.discountsService.update(id, dto, actorId);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.discountsService.deactivate(id, actorId);
  }
}
