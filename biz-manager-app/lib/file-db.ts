import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SystemRole } from "@/types/domain";

const dataFile = path.join(process.cwd(), "data", "app-data.json");

export type AppUser = {
  id: string;
  loginId: string;
  name: string;
  passwordHash: string;
  systemRole: SystemRole;
};

export type AppStoreMembership = {
  userId: string;
  storeId: string;
  role: SystemRole;
};

export type AppStore = {
  id: string;
  code: string;
  name: string;
  businessType: string;
  ownerUserId: string | null;
  expectedProfitMarginRate?: number;
  estimatedTaxRate?: number;
  expectedMonthlyRevenue?: number;
};

export type AppStaff = {
  id: string;
  storeId: string;
  name: string;
  color: string;
  baseWage: number;
  targetWage: number;
  holidayWage: number;
  bonusWage: number;
  capacity: number;
  incentive: number;
  expectedSales: number;
  performanceBonus: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  employmentType: "HOURLY" | "MONTHLY";
  monthlySalary: number;
  expectedMonthlyHours: number;
  insuranceType: "NONE" | "FREELANCER" | "FOUR_INSURANCE";
  insuranceRate: number;
};

export type AppFinance = {
  id: string;
  storeId: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  memo: string | null;
  targetDate: string;
  inputMode: "AMOUNT" | "RATIO";
  ratioPercent: number | null;
};

export type AppSchedule = {
  storeId: string;
  timeUnit: number;
  hourlySalesProjection: Record<number, number>;
  assignments: Record<string, Record<number, string[]>>;
  seasonProfiles?: Array<{
    id: string;
    name: string;
    dayTypes: Record<string, "NORMAL" | "PEAK">;
    normalHourlyProjection: Record<number, number>;
    peakHourlyProjection: Record<number, number>;
  }>;
  activeSeasonProfileId?: string | null;
};

type AppData = {
  users: AppUser[];
  stores: AppStore[];
  memberships: AppStoreMembership[];
  staff: AppStaff[];
  finance: AppFinance[];
  schedules: AppSchedule[];
};

const emptyData: AppData = {
  users: [],
  stores: [],
  memberships: [],
  staff: [],
  finance: [],
  schedules: [],
};

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(emptyData, null, 2), "utf8");
  }
}

function normalizeAppData(raw: Partial<AppData> | null | undefined): AppData {
  return {
    users: Array.isArray(raw?.users) ? raw.users : [],
    stores: Array.isArray(raw?.stores)
      ? raw.stores.map((store) => ({
          ...store,
          expectedProfitMarginRate: Number(store.expectedProfitMarginRate) || 25,
          estimatedTaxRate: Number(store.estimatedTaxRate) || 10,
          expectedMonthlyRevenue: Number(store.expectedMonthlyRevenue) || 0,
        }))
      : [],
    memberships: Array.isArray(raw?.memberships) ? raw.memberships : [],
    staff: Array.isArray(raw?.staff)
      ? raw.staff.map((member) => {
          const performanceBonus = Number((member as Partial<AppStaff>).performanceBonus) || Number(member.incentive) || 0;
          const expectedSales = Number((member as Partial<AppStaff>).expectedSales) || Number(member.capacity) || 0;
          return {
            ...member,
            incentive: performanceBonus,
            performanceBonus,
            capacity: expectedSales,
            expectedSales,
            mealAllowance: Number((member as Partial<AppStaff>).mealAllowance) || 0,
            transportAllowance: Number((member as Partial<AppStaff>).transportAllowance) || 0,
            otherAllowance: Number((member as Partial<AppStaff>).otherAllowance) || 0,
            employmentType: (member as Partial<AppStaff>).employmentType === "MONTHLY" ? "MONTHLY" : "HOURLY",
            monthlySalary: Number((member as Partial<AppStaff>).monthlySalary) || 0,
            expectedMonthlyHours: Number((member as Partial<AppStaff>).expectedMonthlyHours) || 160,
            insuranceType:
              (member as Partial<AppStaff>).insuranceType === "FREELANCER" ||
              (member as Partial<AppStaff>).insuranceType === "FOUR_INSURANCE"
                ? ((member as Partial<AppStaff>).insuranceType as "FREELANCER" | "FOUR_INSURANCE")
                : "NONE",
            insuranceRate: Number((member as Partial<AppStaff>).insuranceRate) || 0,
          };
        })
      : [],
    finance: Array.isArray(raw?.finance)
      ? raw.finance.map((item) => ({
          ...item,
          inputMode: (item as Partial<AppFinance>).inputMode === "RATIO" ? "RATIO" : "AMOUNT",
          ratioPercent:
            (item as Partial<AppFinance>).inputMode === "RATIO"
              ? Number((item as Partial<AppFinance>).ratioPercent) || 0
              : Number((item as Partial<AppFinance>).ratioPercent) || null,
        }))
      : [],
    schedules: Array.isArray(raw?.schedules)
      ? raw.schedules.map((schedule) => ({
          ...schedule,
          seasonProfiles: Array.isArray(schedule.seasonProfiles) ? schedule.seasonProfiles : [],
          activeSeasonProfileId: schedule.activeSeasonProfileId ?? null,
        }))
      : [],
  };
}

export async function readAppData() {
  await ensureDataFile();
  const content = await fs.readFile(dataFile, "utf8");
  return normalizeAppData(JSON.parse(content) as Partial<AppData>);
}

export async function writeAppData(data: AppData) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(normalizeAppData(data), null, 2), "utf8");
}

export function createId() {
  return randomUUID();
}
