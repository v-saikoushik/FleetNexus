import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { BusinessMemoryOverviewQueryDto } from './dto/business-memory-overview-query.dto';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { BusinessMemoryService } from './business-memory.service';
import { SimilarTripsQueryDto } from './dto/similar-trips-query.dto';

const MEMORY_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('intelligence/memory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MEMORY_ROLES)
export class BusinessMemoryController {
  constructor(private readonly businessMemory: BusinessMemoryService) {}

  @Get('overview')
  async overview(@CurrentUser() user: RequestUser, @Query() query: BusinessMemoryOverviewQueryDto) {
    void query;
    return {
      success: true,
      data: await this.businessMemory.getOverview(this.organizationId(user)),
    };
  }

  @Get('similar-trips')
  async similarTrips(@CurrentUser() user: RequestUser, @Query() query: SimilarTripsQueryDto) {
    return {
      success: true,
      data: await this.businessMemory.getSimilarTrips(
        this.organizationId(user),
        query.tripId,
        query.limit,
      ),
    };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for business memory access');
    return user.organizationId;
  }
}
