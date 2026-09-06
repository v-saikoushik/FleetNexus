import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleService } from './vehicle.service';

const READ_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'DRIVER',
] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER'] as const;

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateVehicleDto) {
    const vehicle = await this.vehicles.create(this.organizationId(user), dto);
    return { success: true, data: vehicle, message: 'Vehicle created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.vehicles.findAll(this.organizationId(user)) };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.vehicles.findOne(this.organizationId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    const vehicle = await this.vehicles.update(this.organizationId(user), id, dto);
    return { success: true, data: vehicle, message: 'Vehicle updated successfully' };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for vehicle access');
    return user.organizationId;
  }
}
