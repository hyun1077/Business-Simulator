import type { SystemRole } from "@/types/domain";
import type { AppData } from "@/types/internal";

export function getNextPath(data: AppData, storeId: string, role: SystemRole) {
  const staffCount = data.staff.filter((item) => item.storeId === storeId).length;
  const financeCount = data.finance.filter((item) => item.storeId === storeId).length;
  const hasSchedule = data.schedules.some((item) => item.storeId === storeId);

  if (role === "OWNER") {
    if (staffCount === 0) return "/dashboard/staff";
    if (financeCount === 0) return "/dashboard/finance";
    if (!hasSchedule) return "/dashboard/scheduler";
    return "/dashboard";
  }

  if (role === "MANAGER") {
    if (staffCount === 0) return "/dashboard/staff";
    if (!hasSchedule) return "/dashboard/scheduler";
    return "/dashboard";
  }

  if (!hasSchedule) return "/dashboard/scheduler";
  return "/dashboard";
}
