import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateProductDto,
  ProductVariantDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Paginated product list with variants' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productsService.list({ page, limit, search, isActive });
  }

  @Get(':id')
  @Roles('ADMIN', 'STAFF')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a product, optionally with variants (admin only)' })
  create(@Body() dto: CreateProductDto, @CurrentUser('id') actorId: string) {
    return this.productsService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.update(id, dto, actorId);
  }

  @Post(':id/variants')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add a variant, e.g. Brand = Odoo, +560 (admin only)' })
  addVariant(
    @Param('id') id: string,
    @Body() dto: ProductVariantDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.addVariant(id, dto, actorId);
  }

  @Patch(':id/variants/:variantId')
  @Roles('ADMIN')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: Partial<ProductVariantDto>,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.updateVariant(id, variantId, dto, actorId);
  }

  @Delete(':id/variants/:variantId')
  @Roles('ADMIN')
  removeVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.removeVariant(id, variantId, actorId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate (archive) a product (admin only)' })
  deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.productsService.deactivate(id, actorId);
  }
}
