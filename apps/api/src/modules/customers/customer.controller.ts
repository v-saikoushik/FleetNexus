import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { RequestUser } from '@/auth/strategies/jwt.strategy';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const READ_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER', 'DRIVER'] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER'] as const;

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomerDto) {
    const customer = await this.customers.create(this.orgId(user), dto);
    return { success: true, data: customer, message: 'Customer created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(@CurrentUser() user: RequestUser) {
    return { success: true, data: await this.customers.findAll(this.orgId(user)) };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.customers.findOne(this.orgId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customers.update(this.orgId(user), id, dto);
    return { success: true, data: customer, message: 'Customer updated successfully' };
  }

  private orgId(user: RequestUser): string {
    if (!user.organizationId)
      throw new ForbiddenException('An organization is required for customer access');
    return user.organizationId;
  }
}
