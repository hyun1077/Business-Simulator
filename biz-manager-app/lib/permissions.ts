import type { SystemRole } from "@/types/domain";

const roleRank: Record<SystemRole, number> = {
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
  SUPER_ADMIN: 4,
};

export function inferRoleFromLoginId(loginId: string): SystemRole {
  const normalized = loginId.trim().toLowerCase();

  if (
    normalized.startsWith("admin") ||
    normalized.startsWith("master") ||
    normalized.startsWith("owner")
  ) {
    return "OWNER";
  }

  if (normalized.startsWith("manager") || normalized.startsWith("mgr")) {
    return "MANAGER";
  }

  return "STAFF";
}

export function canAccess(required: SystemRole, current: SystemRole) {
  return roleRank[current] >= roleRank[required];
}
