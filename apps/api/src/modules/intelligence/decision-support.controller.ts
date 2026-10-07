import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { LoadProfitabilityDto } from './dto/load-profitability.dto';
import { DecisionSupportService } from './decision-support.service';

@Controller('intelligence/load-decision')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER')
export class DecisionSupportController {
  constructor(private readonly decisions: DecisionSupportService) {}

  @Post('analyze')
  async analyze(@CurrentUser() user: RequestUser, @Body() input: LoadProfitabilityDto) {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for decision support');
    return { success: true, data: await this.decisions.analyze(user.organizationId, input) };
  }
}
