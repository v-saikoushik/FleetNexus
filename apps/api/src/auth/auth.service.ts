import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;
const PUBLIC_REGISTRATION_ROLE = 'FLEET_OWNER' as const;

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string | null;
  isActive: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = dto.email.toLowerCase().trim();

    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    if (dto.phone) {
      const existingByPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingByPhone) {
        throw new ConflictException('An account with this phone already exists');
      }
    }

    if (dto.organizationId && dto.organization) {
      throw new BadRequestException('Provide either organizationId or organization, not both');
    }

    if (dto.organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: dto.organizationId } });
      if (!org || !org.isActive) {
        throw new BadRequestException('Organization not found or inactive');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      let organizationId = dto.organizationId ?? null;

      if (dto.organization) {
        const org = await tx.organization.create({
          data: {
            name: dto.organization.name,
            type: dto.organization.type,
            email: dto.organization.email,
            phone: dto.organization.phone,
            address: dto.organization.address,
            city: dto.organization.city,
            state: dto.organization.state,
          },
        });
        organizationId = org.id;
      }

      return tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone: dto.phone ?? undefined,
          passwordHash,
          // Public callers never choose a role. Privileged and staff roles must
          // be assigned through a future authenticated administration workflow.
          role: PUBLIC_REGISTRATION_ROLE,
          organizationId: organizationId ?? undefined,
        },
      });
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    const tokens = this.issueTokens(user);
    return { user: this.toAuthUser(user), tokens };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const identifier = dto.identifier.trim();
    const isEmail = identifier.includes('@');

    const user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
      : await this.prisma.user.findUnique({ where: { phone: identifier } });

    // Constant-time-ish path even when user is missing (dummy hash compare)
    const dummyHash = '$2a$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordToCompare = user?.passwordHash ?? dummyHash;
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    void this.prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err: unknown) => {
        this.logger.warn(`Failed to update lastLoginAt for ${user.id}: ${String(err)}`);
      });

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    const tokens = this.issueTokens(user);
    return { user: this.toAuthUser(user), tokens };
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toAuthUser(user);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private issueTokens(user: {
    id: string;
    email: string;
    role: string;
    organizationId: string | null;
  }): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      organizationId: user.organizationId,
    };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string | null;
    isActive: boolean;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      isActive: user.isActive,
    };
  }
}
