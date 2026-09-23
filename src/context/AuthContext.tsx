import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { getLegalEntity } from '../api/gl';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  clearMustChangePwd: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function persistUser(userData: User) {
  localStorage.setItem('user', JSON.stringify(userData));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const loginData = await authApi.login(email, password);
    localStorage.setItem('accessToken', loginData.accessToken);
    localStorage.setItem('refreshToken', loginData.refreshToken);
    let businessGroupId: string | undefined;
    try {
      const legalEntity = await getLegalEntity(loginData.legalEntityId);
      businessGroupId = legalEntity.businessGroupId;
    } catch {
      businessGroupId = undefined;
    }
    const userData: User = {
      userId: loginData.userId,
      email: loginData.email,
      fullName: loginData.fullName,
      legalEntityId: loginData.legalEntityId,
      businessGroupId,
      permissions: loginData.permissions,
      mustChangePwd: loginData.mustChangePwd,
    };
    persistUser(userData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasPermission = (permission: string) => {
    return user?.permissions.includes(permission) ?? false;
  };

  const clearMustChangePwd = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, mustChangePwd: false };
      persistUser(updated);
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
        clearMustChangePwd,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
