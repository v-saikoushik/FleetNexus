import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Default transaction: run callback with prisma mock as tx
    mockPrismaService.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrismaService) => Promise<unknown>) => fn(mockPrismaService),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
    };

    it('should register a new user and return tokens', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash');
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: 'hash',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result.tokens.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 12);
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing',
        email: 'john@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing', phone: '+919999999999' });

      await expect(service.register({ ...registerDto, phone: '+919999999999' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create organization with user when organization payload provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Fleet',
        type: 'FLEET_OWNER',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'FLEET_OWNER',
        organizationId: 'org-1',
        isActive: true,
        passwordHash: 'hash',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register({
        ...registerDto,
        organization: { name: 'Acme Fleet', type: 'FLEET_OWNER' },
      });

      expect(result.user.organizationId).toBe('org-1');
      expect(mockPrismaService.organization.create).toHaveBeenCalled();
    });

    it('should ignore an attempted privileged role and use the public default', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'FLEET_OWNER',
        organizationId: null,
        isActive: true,
        passwordHash: 'hash',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register({
        ...registerDto,
        role: 'SUPER_ADMIN',
      } as RegisterDto & {
        role: string;
      });

      expect(result.user.role).toBe('FLEET_OWNER');
    });

    it('should normalize email to lowercase', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: 'hash',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register({ ...registerDto, email: 'JOHN@EXAMPLE.COM' });

      const createMock = mockPrismaService.user.create;
      const firstCall = createMock.mock.calls[0] as [{ data: { email: string } }];
      expect(firstCall[0].data.email).toBe('john@example.com');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      identifier: 'john@example.com',
      password: 'Password123!',
    };

    it('should login with valid email credentials', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: '+919999999999',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: hash,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.login(loginDto);
      expect(result.tokens.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should login with phone identifier', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: '+919999999999',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: hash,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.login({
        identifier: '+919999999999',
        password: 'Password123!',
      });
      expect(result.tokens.accessToken).toBe('mock-jwt-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+919999999999' },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        isActive: true,
        passwordHash: hash,
      });

      await expect(service.login({ ...loginDto, password: 'WrongPassword!' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        isActive: false,
        passwordHash: hash,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should not return passwordHash in response', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: hash,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.login(loginDto);
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('getMe', () => {
    it('should return user profile without passwordHash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'john@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        role: 'DRIVER',
        organizationId: null,
        isActive: true,
        passwordHash: 'secret-hash',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getMe('user-id-1');
      expect(result.id).toBe('user-id-1');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
