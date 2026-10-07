import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { BusinessMemoryService } from './business-memory.service';
import { FreightHistoryQueryDto } from './dto/freight-history-query.dto';
import { HistoricalSimilarTripsQueryDto } from './dto/historical-similar-trips-query.dto';

const MEMORY_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('intelligence')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MEMORY_ROLES)
export class HistoricalIntelligenceController {
  constructor(private readonly memory: BusinessMemoryService) {}

  @Get('customers/:customerId/history')
  async customer(@CurrentUser() user: RequestUser, @Param('customerId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.memory.getCustomerHistory(this.orgId(user), id) };
  }

  @Get('routes/:routeId/history')
  async route(@CurrentUser() user: RequestUser, @Param('routeId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.memory.getRouteHistory(this.orgId(user), id) };
  }

  @Get('commodities/:commodityId/history')
  async commodity(
    @CurrentUser() user: RequestUser,
    @Param('commodityId', ParseUUIDPipe) id: string,
  ) {
    return { success: true, data: await this.memory.getCommodityHistory(this.orgId(user), id) };
  }

  @Get('vehicles/:vehicleId/history')
  async vehicle(@CurrentUser() user: RequestUser, @Param('vehicleId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.memory.getVehicleHistory(this.orgId(user), id) };
  }

  @Get('freight-rates/history')
  async freightRates(@CurrentUser() user: RequestUser, @Query() query: FreightHistoryQueryDto) {
    return {
      success: true,
      data: await this.memory.getFreightHistory(
        this.orgId(user),
        query.routeId,
        query.commodityId,
        query.customerId,
      ),
    };
  }

  @Get('similar-trips')
  async similarTrips(
    @CurrentUser() user: RequestUser,
    @Query() query: HistoricalSimilarTripsQueryDto,
  ) {
    return {
      success: true,
      data: await this.memory.getSimilarTripsByCriteria(this.orgId(user), query),
    };
  }

  private orgId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for intelligence access');
    return user.organizationId;
  }
}
