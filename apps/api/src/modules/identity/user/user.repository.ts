import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { CreateUserData, IUser, UpdateUserData } from './interfaces/user.interface';

const userSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  organizationId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * UserRepository — data access layer for users.
 * Never returns passwordHash to callers.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<IUser> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? 'DRIVER',
        organizationId: data.organizationId,
        passwordHash: data.passwordHash,
      },
      select: userSelect,
    });
  }

  async findById(id: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userSelect });
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: userSelect,
    });
  }

  async findByPhone(phone: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({ where: { phone }, select: userSelect });
  }

  async findAllByOrganization(organizationId: string): Promise<IUser[]> {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: userSelect,
    });
  }

  async update(id: string, data: UpdateUserData): Promise<IUser> {
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
