import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import type { CreateUserData, IUser, UpdateUserData } from './interfaces/user.interface';

/**
 * UserService — business logic for system users.
 * Password hashing for auth registration lives in AuthService;
 * this service focuses on user lookup and profile management.
 */
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  create(data: CreateUserData): Promise<IUser> {
    return this.userRepository.create(data);
  }

  async findByIdOrThrow(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmail(email: string): Promise<IUser | null> {
    return this.userRepository.findByEmail(email);
  }

  findByPhone(phone: string): Promise<IUser | null> {
    return this.userRepository.findByPhone(phone);
  }

  findAllByOrganization(organizationId: string): Promise<IUser[]> {
    return this.userRepository.findAllByOrganization(organizationId);
  }

  update(id: string, data: UpdateUserData): Promise<IUser> {
    return this.userRepository.update(id, data);
  }

  softDelete(id: string): Promise<void> {
    return this.userRepository.softDelete(id);
  }
}
