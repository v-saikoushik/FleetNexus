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
import { SeasonalityComparisonQueryDto } from './dto/seasonality-comparison-query.dto';
import { SeasonalityFilterQueryDto } from './dto/seasonality-filter-query.dto';
import { SeasonalityService } from './seasonality.service';

const SEASONALITY_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
] as const;

@Controller('intelligence/seasonality')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SEASONALITY_ROLES)
export class SeasonalityController {
  constructor(private readonly seasonality: SeasonalityService) {}

  @Get('overview')
  async overview(@CurrentUser() user: RequestUser, @Query() query: SeasonalityFilterQueryDto) {
    return { success: true, data: await this.seasonality.getOverview(this.orgId(user), query) };
  }

  @Get('commodities')
  async commodities(@CurrentUser() user: RequestUser, @Query() query: SeasonalityFilterQueryDto) {
    return { success: true, data: await this.seasonality.getCommodities(this.orgId(user), query) };
  }

  @Get('routes')
  async routes(@CurrentUser() user: RequestUser, @Query() query: SeasonalityFilterQueryDto) {
    return { success: true, data: await this.seasonality.getRoutes(this.orgId(user), query) };
  }

  @Get('compare')
  async compare(@CurrentUser() user: RequestUser, @Query() query: SeasonalityComparisonQueryDto) {
    return { success: true, data: await this.seasonality.compare(this.orgId(user), query) };
  }

  @Get('commodities/:commodityId')
  async commodity(
    @CurrentUser() user: RequestUser,
    @Param('commodityId', ParseUUIDPipe) id: string,
    @Query() query: SeasonalityFilterQueryDto,
  ) {
    return {
      success: true,
      data: await this.seasonality.getCommodity(this.orgId(user), id, query),
    };
  }

  @Get('routes/:routeId/commodities')
  async routeCommodities(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) id: string,
    @Query() query: SeasonalityFilterQueryDto,
  ) {
    return {
      success: true,
      data: await this.seasonality.getRouteCommodities(this.orgId(user), id, query),
    };
  }

  @Get('routes/:routeId')
  async route(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) id: string,
    @Query() query: SeasonalityFilterQueryDto,
  ) {
    return { success: true, data: await this.seasonality.getRoute(this.orgId(user), id, query) };
  }

  @Get('customers/:customerId')
  async customer(
    @CurrentUser() user: RequestUser,
    @Param('customerId', ParseUUIDPipe) id: string,
    @Query() query: SeasonalityFilterQueryDto,
  ) {
    return { success: true, data: await this.seasonality.getCustomer(this.orgId(user), id, query) };
  }

  private orgId(user: RequestUser) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for seasonality access');
    return user.organizationId;
  }
}
