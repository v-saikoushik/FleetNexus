import { useEffect, useState, type PropsWithChildren } from 'react';
import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@fleetnexus/shared';
import type { AuthResponseData, AuthUser, LoginPayload, RegisterPayload } from './types';
import { AuthContext } from './use-auth';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('fleetnexus_user');
    return saved ? (JSON.parse(saved) as AuthUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fleetnexus_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
        if (res.data.success) {
          setUser(res.data.data);
          localStorage.setItem('fleetnexus_user', JSON.stringify(res.data.data));
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    }
    void verifyAuth();
  }, [token]);

  const handleAuthSuccess = (data: AuthResponseData) => {
    setUser(data.user);
    setToken(data.tokens.accessToken);
    localStorage.setItem('fleetnexus_token', data.tokens.accessToken);
    localStorage.setItem('fleetnexus_user', JSON.stringify(data.user));
  };

  const login = async (payload: LoginPayload) => {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/login', payload);
    if (res.data.success) {
      handleAuthSuccess(res.data.data);
    }
  };

  const register = async (payload: RegisterPayload) => {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/register', payload);
    if (res.data.success) {
      handleAuthSuccess(res.data.data);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('fleetnexus_token');
    localStorage.removeItem('fleetnexus_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
