import type { AppFinance, AppSchedule, AppStaff, AppStore, AppStoreMembership, AppUser } from "@/lib/file-db";

export type AppData = {
  users: AppUser[];
  stores: AppStore[];
  memberships: AppStoreMembership[];
  staff: AppStaff[];
  finance: AppFinance[];
  schedules: AppSchedule[];
};
