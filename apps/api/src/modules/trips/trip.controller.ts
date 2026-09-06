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
import { TripService } from './trip.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

const READ_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER', 'DRIVER'] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER'] as const;

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripController {
  constructor(private readonly trips: TripService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTripDto) {
    const trip = await this.trips.create(this.orgId(user), dto);
    return { success: true, data: trip, message: 'Trip created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const trips = await this.trips.findAll(this.orgId(user), {
      vehicleId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return { success: true, data: trips };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.trips.findOne(this.orgId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripDto,
  ) {
    const trip = await this.trips.update(this.orgId(user), id, dto);
    return { success: true, data: trip, message: 'Trip updated successfully' };
  }

  @Patch(':id/complete')
  @Roles(...MANAGE_ROLES)
  async complete(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    const trip = await this.trips.complete(this.orgId(user), id);
    return { success: true, data: trip, message: 'Trip completed successfully' };
  }

  private orgId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for trip access');
    return user.organizationId;
  }
}
