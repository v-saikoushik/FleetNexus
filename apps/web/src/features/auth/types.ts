import type { OrganizationType, Role } from '@fleetnexus/shared';

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string | null;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterOrganizationPayload {
  name: string;
  type: OrganizationType;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  organizationId?: string;
  organization?: RegisterOrganizationPayload;
}
