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
import { RouteComparisonQueryDto } from './dto/route-comparison-query.dto';
import { RouteIntelligenceQueryDto } from './dto/route-intelligence-query.dto';
import { RouteIntelligenceService } from './route-intelligence.service';

const ROUTE_INTELLIGENCE_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
] as const;

@Controller('intelligence/routes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROUTE_INTELLIGENCE_ROLES)
export class RouteIntelligenceController {
  constructor(private readonly intelligence: RouteIntelligenceService) {}

  @Get()
  async routes(@CurrentUser() user: RequestUser, @Query() query: RouteIntelligenceQueryDto) {
    void query;
    return { success: true, data: await this.intelligence.getRoutes(this.orgId(user)) };
  }

  @Get('compare')
  async compare(@CurrentUser() user: RequestUser, @Query() query: RouteComparisonQueryDto) {
    return { success: true, data: await this.intelligence.compare(this.orgId(user), query.metric) };
  }

  @Get('insights')
  async insights(@CurrentUser() user: RequestUser, @Query() query: RouteIntelligenceQueryDto) {
    void query;
    return { success: true, data: await this.intelligence.getInsights(this.orgId(user)) };
  }

  @Get(':routeId/analysis')
  async analysis(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteIntelligenceQueryDto,
  ) {
    void query;
    return { success: true, data: await this.intelligence.getAnalysis(this.orgId(user), routeId) };
  }

  @Get(':routeId/vehicles')
  async vehicles(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteIntelligenceQueryDto,
  ) {
    void query;
    return {
      success: true,
      data: await this.intelligence.getDimension(this.orgId(user), routeId, 'vehicles'),
    };
  }

  @Get(':routeId/commodities')
  async commodities(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteIntelligenceQueryDto,
  ) {
    void query;
    return {
      success: true,
      data: await this.intelligence.getDimension(this.orgId(user), routeId, 'commodities'),
    };
  }

  @Get(':routeId/customers')
  async customers(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteIntelligenceQueryDto,
  ) {
    void query;
    return {
      success: true,
      data: await this.intelligence.getDimension(this.orgId(user), routeId, 'customers'),
    };
  }

  @Get(':routeId/expenses')
  async expenses(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteIntelligenceQueryDto,
  ) {
    void query;
    return { success: true, data: await this.intelligence.getExpenses(this.orgId(user), routeId) };
  }

  private orgId(user: RequestUser) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for route intelligence access');
    return user.organizationId;
  }
}
