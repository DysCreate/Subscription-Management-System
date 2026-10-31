import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateQuotationTemplateDto,
  UpdateQuotationTemplateDto,
} from './dto/quotation-template.dto';
import { QuotationTemplatesService } from './quotation-templates.service';

@ApiTags('quotation-templates')
@ApiBearerAuth()
@Controller('quotation-templates')
export class QuotationTemplatesController {
  constructor(private readonly templatesService: QuotationTemplatesService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'List quotation templates (staff can use them)' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('planId') planId?: string,
  ) {
    return this.templatesService.list({ page, limit, search, planId });
  }

  @Get(':id')
  @Roles('ADMIN', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateQuotationTemplateDto, @CurrentUser('id') actorId: string) {
    return this.templatesService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationTemplateDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.templatesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.templatesService.deactivate(id, actorId);
  }
}
