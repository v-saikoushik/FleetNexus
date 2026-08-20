import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@fleetnexus/shared';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: Role;
  organizationId: string | null;
  iat?: number;
  exp?: number;
}

/** Shape attached to request.user after JWT validation */
export interface RequestUser {
  userId: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): RequestUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}
