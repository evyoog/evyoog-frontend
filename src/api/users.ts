import api from './axios';
import type { ApiResponse, ApprovalPolicy, AppUser, Role, UserRoleAssignment } from '../types';

export async function listUsers(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<AppUser[]>>('/api/v1/auth/users', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function createUser(body: {
  email: string;
  fullName: string;
  password: string;
  roleId: string;
  legalEntityId: string;
}) {
  const { data } = await api.post<ApiResponse<AppUser>>('/api/v1/auth/users', body);
  return data.data;
}

export async function deactivateUser(userId: string) {
  const { data } = await api.post<ApiResponse<unknown>>(`/api/v1/auth/users/${userId}/deactivate`);
  return data;
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const { data } = await api.post<ApiResponse<unknown>>(
    `/api/v1/auth/users/${userId}/reset-password`,
    { newPassword },
  );
  return data;
}

export async function getUserRoles(userId: string) {
  const { data } = await api.get<ApiResponse<UserRoleAssignment[]>>(
    `/api/v1/auth/users/${userId}/roles`,
  );
  return data.data;
}

export async function assignUserRole(userId: string, roleId: string, legalEntityId: string) {
  const { data } = await api.post<ApiResponse<UserRoleAssignment>>(
    `/api/v1/auth/users/${userId}/roles`,
    { roleId, legalEntityId },
  );
  return data.data;
}

export async function removeUserRole(userId: string, roleId: string) {
  const { data } = await api.delete<ApiResponse<unknown>>(
    `/api/v1/auth/users/${userId}/roles/${roleId}`,
  );
  return data;
}

export async function listRoles(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<Role[]>>('/api/v1/auth/roles', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function createRole(body: {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
}) {
  const { data } = await api.post<ApiResponse<Role>>('/api/v1/auth/roles', body);
  return data.data;
}

export async function updateRole(
  roleId: string,
  body: { name: string; description: string; permissionCodes: string[]; isActive: boolean },
) {
  const { data } = await api.put<ApiResponse<Role>>(`/api/v1/auth/roles/${roleId}`, body);
  return data.data;
}

export async function listApprovalPolicies(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<ApprovalPolicy[]>>('/api/v1/auth/approval-policies', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function createApprovalPolicy(body: {
  legalEntityId: string;
  journalSourceCode: string;
  requiresApproval: boolean;
  businessUnitId: string | null;
  inventoryOrgId: string | null;
  approvalThresholdAmount: number | null;
  approverRoleCode: string | null;
}) {
  const { data } = await api.post<ApiResponse<ApprovalPolicy>>('/api/v1/auth/approval-policies', body);
  return data.data;
}

export async function updateApprovalPolicy(
  id: string,
  body: {
    journalSourceCode: string;
    requiresApproval: boolean;
    businessUnitId: string | null;
    inventoryOrgId: string | null;
    approvalThresholdAmount: number | null;
    approverRoleCode: string | null;
  },
) {
  const { data } = await api.put<ApiResponse<ApprovalPolicy>>(
    `/api/v1/auth/approval-policies/${id}`,
    body,
  );
  return data.data;
}

export async function deleteApprovalPolicy(id: string) {
  const { data } = await api.delete<ApiResponse<unknown>>(`/api/v1/auth/approval-policies/${id}`);
  return data;
}
