import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { LoadProfitabilityDto } from './dto/load-profitability.dto';
import { LoadProfitabilityService } from './load-profitability.service';

@Controller('intelligence/load-profitability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER')
export class LoadProfitabilityController {
  constructor(private readonly loadProfitability: LoadProfitabilityService) {}

  @Post('analyze')
  async analyze(@CurrentUser() user: RequestUser, @Body() input: LoadProfitabilityDto) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for load economics');
    return {
      success: true,
      data: await this.loadProfitability.analyze(user.organizationId, input),
    };
  }
}
