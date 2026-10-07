import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentService } from './payment.service';

const READ_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'DRIVER',
] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    const payment = await this.payments.create(this.organizationId(user), dto);
    return { success: true, data: payment, message: 'Payment created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(@CurrentUser() user: RequestUser, @Query() filters: FilterPaymentsDto) {
    return { success: true, data: await this.payments.findAll(this.organizationId(user), filters) };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.payments.findOne(this.organizationId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    const payment = await this.payments.update(this.organizationId(user), id, dto);
    return { success: true, data: payment, message: 'Payment updated successfully' };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('An organization is required for payment access');
    }
    return user.organizationId;
  }
}
