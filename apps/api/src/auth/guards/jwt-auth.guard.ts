import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — protects routes by requiring a valid JWT Bearer token.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getMe(@Req() req: Request) { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
