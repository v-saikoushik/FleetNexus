import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { FinancePeriodQueryDto } from '@/modules/finance/dto/finance-period-query.dto';
import { CostIntelligenceService } from './cost-intelligence.service';

const COST_READ_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('intelligence/costs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...COST_READ_ROLES)
export class CostIntelligenceController {
  constructor(private readonly intelligence: CostIntelligenceService) {}

  @Get('summary')
  async summary(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.intelligence.getSummary(this.organizationId(user), query),
    };
  }

  @Get('expenses')
  async expenses(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.intelligence.getExpenses(this.organizationId(user), query),
    };
  }

  @Get('vehicles')
  async vehicles(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.intelligence.getVehicles(this.organizationId(user), query),
    };
  }

  @Get('customers')
  async customers(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.intelligence.getCustomers(this.organizationId(user)) };
  }

  @Get('routes')
  async routes(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.intelligence.getRoutes(this.organizationId(user)) };
  }

  @Get('insights')
  async insights(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.intelligence.getInsights(this.organizationId(user), query),
    };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for cost intelligence access');
    return user.organizationId;
  }
}
