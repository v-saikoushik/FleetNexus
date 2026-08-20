import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function createContext(role: 'SUPER_ADMIN' | 'DRIVER') {
  return {
    getHandler: () => class Handler {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows a user with a required role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['SUPER_ADMIN']) };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(createContext('SUPER_ADMIN'))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('rejects a user without a required role', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue(['SUPER_ADMIN']),
    } as never);

    expect(() => guard.canActivate(createContext('DRIVER'))).toThrow(ForbiddenException);
  });
});
