import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import type { RequestUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Create a new user account. Returns user + access token.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
      message: 'Account created successfully',
    };
  }

  /**
   * POST /api/auth/login
   * Authenticate with email or phone + password. Returns user + access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user's profile.
   * Requires valid JWT Bearer token.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: RequestUser) {
    const profile = await this.authService.getMe(user.userId);
    return {
      success: true,
      data: profile,
    };
  }

  /**
   * GET /api/auth/rbac-check
   * Minimal protected endpoint that verifies the reusable JWT + role guard setup.
   */
  @Get('rbac-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  rbacCheck() {
    return {
      success: true,
      data: { authorized: true },
    };
  }
}
