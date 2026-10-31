import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, Role } from '@subloop/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateStaffDto, UpdateUserDto } from './dto/user.dto';
import { UsersService, type UserSummary } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('staff')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a staff/admin login (admin only)' })
  createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserSummary> {
    return this.usersService.createStaff(dto, actorId);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List logins (admin only)' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: Role,
    @Query('search') search?: string,
  ): Promise<Paginated<UserSummary>> {
    return this.usersService.list({ page, limit, role, search });
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activate/deactivate a login or change its role (admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ): Promise<UserSummary> {
    return this.usersService.update(id, dto, actorId);
  }
}
