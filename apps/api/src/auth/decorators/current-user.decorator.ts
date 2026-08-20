import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * @CurrentUser() param decorator — extracts the authenticated user from the request.
 *
 * Usage:
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   getMe(@CurrentUser() user: RequestUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
