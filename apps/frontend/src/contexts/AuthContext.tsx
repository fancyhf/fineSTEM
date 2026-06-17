import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserResponse } from '../types';
import { authApi, authStorage } from '../services/api';

interface AuthContextType {
  user: UserResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化时检查本地存储的用户
    const storedUser = authStorage.getUser();
    const token = authStorage.getToken();
    if (storedUser && token) {
      setUser(storedUser);
      refreshUser();
    }
    setIsLoading(false);
  }, []);

  const refreshUser = async () => {
    try {
      const response = await authApi.getMe();
      if (response.data) {
        setUser(response.data);
        authStorage.setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);
      if (!response.data) {
        const msg = response.message || '登录失败，请检查邮箱和密码';
        throw new Error(msg);
      }
      authStorage.setToken(response.data.access_token);
      authStorage.setUser(response.data.user);
      setUser(response.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        name,
        email,
        password,
        role: 'student',
        level: 1,
        capability_tags: [],
      });
      if (!response.data) {
        const msg = response.message || '注册失败，请稍后重试';
        throw new Error(msg);
      }
      authStorage.setToken(response.data.access_token);
      authStorage.setUser(response.data.user);
      setUser(response.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
