import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';
import { TaxesService } from './taxes.service';

@ApiTags('taxes')
@ApiBearerAuth()
@Controller('taxes')
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.taxesService.list({ page, limit, search, isActive });
  }

  @Get(':id')
  @Roles('ADMIN', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.taxesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a percent or fixed tax rule (admin only)' })
  create(@Body() dto: CreateTaxDto, @CurrentUser('id') actorId: string) {
    return this.taxesService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.taxesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.taxesService.deactivate(id, actorId);
  }
}
