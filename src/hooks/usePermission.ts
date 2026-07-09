import { useAuth } from '../context/AuthContext';

export function usePermission(permission: string) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
