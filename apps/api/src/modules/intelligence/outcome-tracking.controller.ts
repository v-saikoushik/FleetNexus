import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { LinkOutcomeTripDto } from './dto/link-outcome-trip.dto';
import { OutcomeTrackingService } from './outcome-tracking.service';

@Controller('intelligence/outcomes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER')
export class OutcomeTrackingController {
  constructor(private readonly outcomes: OutcomeTrackingService) {}

  @Get() async list(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.list(this.org(user)) };
  }
  @Get('summary') async summary(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.summary(this.org(user)) };
  }
  @Get('by-route') async byRoute(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.aggregate(this.org(user), 'route') };
  }
  @Get('by-vehicle') async byVehicle(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.aggregate(this.org(user), 'vehicle') };
  }
  @Get('by-commodity') async byCommodity(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.aggregate(this.org(user), 'commodity') };
  }
  @Get('by-customer') async byCustomer(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.aggregate(this.org(user), 'customer') };
  }
  @Get('by-route-commodity') async byRouteCommodity(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.outcomes.aggregate(this.org(user), 'routeCommodity') };
  }
  @Get(':predictionId/comparison') async comparison(
    @CurrentUser() user: RequestUser,
    @Param('predictionId') predictionId: string,
  ) {
    return { success: true, data: await this.outcomes.comparison(this.org(user), predictionId) };
  }
  @Get(':predictionId') async get(
    @CurrentUser() user: RequestUser,
    @Param('predictionId') predictionId: string,
  ) {
    return { success: true, data: await this.outcomes.get(this.org(user), predictionId) };
  }
  @Post(':predictionId/link-trip') async linkTrip(
    @CurrentUser() user: RequestUser,
    @Param('predictionId') predictionId: string,
    @Body() input: LinkOutcomeTripDto,
  ) {
    return {
      success: true,
      data: await this.outcomes.linkTrip(this.org(user), predictionId, input.tripId),
    };
  }
  @Post(':predictionId/not-executed') async markNotExecuted(
    @CurrentUser() user: RequestUser,
    @Param('predictionId') predictionId: string,
  ) {
    return {
      success: true,
      data: await this.outcomes.markNotExecuted(this.org(user), predictionId),
    };
  }
  private org(user: RequestUser) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for outcomes');
    return user.organizationId;
  }
}
