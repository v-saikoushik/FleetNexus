import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

const READ_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'DRIVER',
] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER'] as const;

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverController {
  constructor(private readonly drivers: DriverService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateDriverDto) {
    const driver = await this.drivers.create(this.orgId(user), dto);
    return { success: true, data: driver, message: 'Driver created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const drivers = await this.drivers.findAll(this.orgId(user), { status, search });
    return { success: true, data: drivers };
  }

  @Get(':id/performance')
  @Roles(...READ_ROLES)
  async performance(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { success: true, data: await this.drivers.getPerformance(this.orgId(user), id) };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.drivers.findOne(this.orgId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    const driver = await this.drivers.update(this.orgId(user), id, dto);
    return { success: true, data: driver, message: 'Driver updated successfully' };
  }

  private orgId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for driver access');
    return user.organizationId;
  }
}
