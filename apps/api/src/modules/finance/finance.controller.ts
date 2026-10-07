import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { FinancePeriodQueryDto } from './dto/finance-period-query.dto';
import { FinanceService } from './finance.service';

const FINANCE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FINANCE_ROLES)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  async summary(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return { success: true, data: await this.finance.getSummary(this.organizationId(user), query) };
  }

  @Get('expenses')
  async expenses(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.finance.getExpenses(this.organizationId(user), query),
    };
  }

  @Get('vehicles')
  async vehicles(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.finance.getVehicles(this.organizationId(user), query),
    };
  }

  @Get('trips')
  async trips(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return { success: true, data: await this.finance.getTrips(this.organizationId(user), query) };
  }

  @Get('cash-flow')
  async cashFlow(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.finance.getCashFlow(this.organizationId(user), query),
    };
  }

  @Get('outstanding')
  async outstanding(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.finance.getOutstanding(this.organizationId(user), query),
    };
  }

  @Get('insights')
  async insights(@CurrentUser() user: RequestUser, @Query() query: FinancePeriodQueryDto) {
    return {
      success: true,
      data: await this.finance.getInsights(this.organizationId(user), query),
    };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('An organization is required for finance access');
    }
    return user.organizationId;
  }
}
