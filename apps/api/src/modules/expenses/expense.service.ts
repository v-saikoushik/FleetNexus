import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { FilterExpensesDto } from './dto/filter-expenses.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseRepository } from './expense.repository';

@Injectable()
export class ExpenseService {
  constructor(private readonly expenses: ExpenseRepository) {}

  async create(organizationId: string, dto: CreateExpenseDto) {
    await this.validateReferences(organizationId, dto);
    await this.assertTripWritable(organizationId, dto.tripId);
    const created = await this.expenses.create({
      organization: { connect: { id: organizationId } },
      ...(dto.tripId && { trip: { connect: { id: dto.tripId } } }),
      ...(dto.vehicleId && { vehicle: { connect: { id: dto.vehicleId } } }),
      ...(dto.driverId && { driver: { connect: { id: dto.driverId } } }),
      ...(dto.routeId && { route: { connect: { id: dto.routeId } } }),
      type: dto.type,
      amount: dto.amount,
      ...(dto.date && { date: new Date(dto.date) }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber.trim() }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    await this.invalidateReview(organizationId, dto.tripId);
    return created;
  }

  findAll(organizationId: string, filters: FilterExpensesDto = {}) {
    this.validateDateRange(filters.startDate, filters.endDate);
    return this.expenses.findAllByOrganization(organizationId, {
      tripId: filters.tripId,
      vehicleId: filters.vehicleId,
      driverId: filters.driverId,
      type: filters.type,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
  }

  async findOne(organizationId: string, id: string) {
    const expense = await this.expenses.findByIdForOrganization(id, organizationId);
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(organizationId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.findOne(organizationId, id);
    const nextTripId = dto.tripId !== undefined ? dto.tripId : existing.tripId;
    await this.assertTripWritable(organizationId, existing.tripId);
    await this.validateReferences(organizationId, dto);
    await this.assertTripWritable(organizationId, nextTripId);
    const updated = await this.expenses.updateForOrganization(id, organizationId, {
      ...(dto.tripId !== undefined && { tripId: dto.tripId }),
      ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
      ...(dto.driverId !== undefined && { driverId: dto.driverId }),
      ...(dto.routeId !== undefined && { routeId: dto.routeId }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.date !== undefined && { date: new Date(dto.date) }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber.trim() }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    if (!updated) throw new NotFoundException('Expense not found');
    await this.invalidateReview(organizationId, existing.tripId);
    if (nextTripId !== existing.tripId) await this.invalidateReview(organizationId, nextTripId);
    return updated;
  }

  private async assertTripWritable(organizationId: string, tripId?: string | null) {
    if (!tripId) return;
    const trip = await this.expenses.findTripForOrganization(tripId, organizationId);
    if (trip?.financialStatus === 'FINALIZED') {
      throw new ConflictException(
        'Trip financials are finalized. Reopen financials before editing expenses.',
      );
    }
  }

  private async invalidateReview(organizationId: string, tripId?: string | null) {
    if (tripId) await this.expenses.reopenReviewForOrganization(tripId, organizationId);
  }

  private async validateReferences(
    organizationId: string,
    dto: Partial<CreateExpenseDto>,
  ): Promise<void> {
    const checks: Array<
      [string | undefined, (id: string, orgId: string) => Promise<unknown>, string]
    > = [
      [dto.tripId, this.expenses.findTripForOrganization.bind(this.expenses), 'Trip'],
      [dto.vehicleId, this.expenses.findVehicleForOrganization.bind(this.expenses), 'Vehicle'],
      [dto.driverId, this.expenses.findDriverForOrganization.bind(this.expenses), 'Driver'],
      [dto.routeId, this.expenses.findRouteForOrganization.bind(this.expenses), 'Route'],
    ];

    for (const [id, findInOrganization, label] of checks) {
      if (id && !(await findInOrganization(id, organizationId))) {
        throw new BadRequestException(`${label} not found in your organization`);
      }
    }
  }

  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate cannot be after endDate');
    }
  }
}
