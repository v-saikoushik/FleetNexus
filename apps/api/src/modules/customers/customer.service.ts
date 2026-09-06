import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository } from './customer.repository';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly customers: CustomerRepository) {}

  create(organizationId: string, dto: CreateCustomerDto) {
    return this.customers.create({
      organization: { connect: { id: organizationId } },
      name: dto.name,
      contactName: dto.contactName,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      notes: dto.notes,
      isActive: dto.isActive ?? true,
    });
  }

  findAll(organizationId: string) {
    return this.customers.findAllByOrganization(organizationId);
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.customers.findByIdForOrganization(id, organizationId);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(organizationId, id);
    return this.customers.update(id, organizationId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.contactName !== undefined && { contactName: dto.contactName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }
}
