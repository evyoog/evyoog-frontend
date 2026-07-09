import api from './axios';
import type { ApiResponse, LoginResponse, MeResponse } from '../types';

export async function login(email: string, password: string) {
  const { data } = await api.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', {
    email,
    password,
  });
  return data.data;
}

export async function getMe() {
  const { data } = await api.get<ApiResponse<MeResponse>>('/api/v1/auth/me');
  return data.data;
}
