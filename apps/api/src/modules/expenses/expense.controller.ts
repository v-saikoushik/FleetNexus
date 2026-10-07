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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FilterExpensesDto } from './dto/filter-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseService } from './expense.service';

const READ_ROLES = [
  'SUPER_ADMIN',
  'FLEET_OWNER',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'DRIVER',
] as const;
const MANAGE_ROLES = ['SUPER_ADMIN', 'FLEET_OWNER', 'FACTORY_MANAGER', 'UNION_MANAGER'] as const;

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateExpenseDto) {
    const expense = await this.expenses.create(this.organizationId(user), dto);
    return { success: true, data: expense, message: 'Expense created successfully' };
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(@CurrentUser() user: RequestUser, @Query() filters: FilterExpensesDto) {
    return { success: true, data: await this.expenses.findAll(this.organizationId(user), filters) };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.expenses.findOne(this.organizationId(user), id) };
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const expense = await this.expenses.update(this.organizationId(user), id, dto);
    return { success: true, data: expense, message: 'Expense updated successfully' };
  }

  private organizationId(user: RequestUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('An organization is required for expense access');
    }
    return user.organizationId;
  }
}
