import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleRepository } from './vehicle.repository';

@Injectable()
export class VehicleService {
  constructor(private readonly vehicles: VehicleRepository) {}

  async create(organizationId: string, dto: CreateVehicleDto) {
    try {
      return await this.vehicles.create({
        organization: { connect: { id: organizationId } },
        ...this.toCreateData(dto),
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  findAll(organizationId: string) {
    return this.vehicles.findAllByOrganization(organizationId);
  }

  async findOne(organizationId: string, id: string) {
    const vehicle = await this.vehicles.findByIdForOrganization(id, organizationId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(organizationId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(organizationId, id);
    try {
      return await this.vehicles.update(id, organizationId, this.toUpdateData(dto));
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  private toCreateData(dto: CreateVehicleDto): Prisma.VehicleCreateWithoutOrganizationInput {
    return {
      registrationNumber: this.normalizeRegistrationNumber(dto.registrationNumber),
      vehicleType: dto.vehicleType,
      manufacturer: dto.manufacturer,
      model: dto.model,
      manufactureYear: dto.manufactureYear,
      chassisNumber: dto.chassisNumber,
      engineNumber: dto.engineNumber,
      fuelType: dto.fuelType,
      capacityTons: dto.capacityTons,
      status: dto.status,
      notes: dto.notes,
    };
  }

  private toUpdateData(dto: UpdateVehicleDto): Prisma.VehicleUpdateInput {
    return {
      ...(dto.registrationNumber && {
        registrationNumber: this.normalizeRegistrationNumber(dto.registrationNumber),
      }),
      ...(dto.vehicleType !== undefined && { vehicleType: dto.vehicleType }),
      ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.manufactureYear !== undefined && { manufactureYear: dto.manufactureYear }),
      ...(dto.chassisNumber !== undefined && { chassisNumber: dto.chassisNumber }),
      ...(dto.engineNumber !== undefined && { engineNumber: dto.engineNumber }),
      ...(dto.fuelType !== undefined && { fuelType: dto.fuelType }),
      ...(dto.capacityTons !== undefined && { capacityTons: dto.capacityTons }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };
  }

  private normalizeRegistrationNumber(registrationNumber: string): string {
    return registrationNumber.replace(/\s+/g, '').toUpperCase();
  }

  private handleDatabaseError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A vehicle with this registration number already exists');
    }
    throw error;
  }
}
