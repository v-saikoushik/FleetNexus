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
import {
  ForecastEvaluationQueryDto,
  ForecastQueryDto,
  RouteForecastQueryDto,
} from './dto/forecast-query.dto';
import { ForecastingService } from './forecasting.service';

@Controller('intelligence/forecasting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER')
export class ForecastingController {
  constructor(private readonly forecasting: ForecastingService) {}

  @Get('overview')
  async overview(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.forecasting.overview(this.org(user)) };
  }

  @Get('commodity/:commodityId')
  @Get('commodities/:commodityId')
  async commodity(
    @CurrentUser() user: RequestUser,
    @Param('commodityId', ParseUUIDPipe) commodityId: string,
    @Query() query: ForecastQueryDto,
  ) {
    return {
      success: true,
      data: await this.forecasting.forecast(this.org(user), commodityId, undefined, query),
    };
  }

  @Get('route/:routeId')
  async route(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Query() query: RouteForecastQueryDto,
  ) {
    return {
      success: true,
      data: await this.forecasting.forecast(this.org(user), query.commodityId, routeId, query),
    };
  }

  @Get('route/:routeId/commodity/:commodityId')
  @Get('routes/:routeId/commodities/:commodityId')
  async routeCommodity(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Param('commodityId', ParseUUIDPipe) commodityId: string,
    @Query() query: ForecastQueryDto,
  ) {
    return {
      success: true,
      data: await this.forecasting.forecast(this.org(user), commodityId, routeId, query),
    };
  }

  @Get('evaluation')
  async evaluation(@CurrentUser() user: RequestUser, @Query() query: ForecastEvaluationQueryDto) {
    return {
      success: true,
      data: await this.forecasting.evaluation(this.org(user), query.commodityId, query.routeId),
    };
  }

  @Get('evaluation/commodity/:commodityId')
  @Get('evaluation/commodities/:commodityId')
  async commodityEvaluation(
    @CurrentUser() user: RequestUser,
    @Param('commodityId', ParseUUIDPipe) commodityId: string,
  ) {
    return { success: true, data: await this.forecasting.evaluation(this.org(user), commodityId) };
  }

  @Get('evaluation/route/:routeId/commodity/:commodityId')
  @Get('evaluation/routes/:routeId/commodities/:commodityId')
  async routeCommodityEvaluation(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Param('commodityId', ParseUUIDPipe) commodityId: string,
  ) {
    return {
      success: true,
      data: await this.forecasting.evaluation(this.org(user), commodityId, routeId),
    };
  }

  private org(user: RequestUser) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for forecasting');
    return user.organizationId;
  }
}
