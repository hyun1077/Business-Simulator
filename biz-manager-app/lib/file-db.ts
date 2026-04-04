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
  weeklyWorkingHours: number;
  weeklyWorkingDays: number;
  insuranceType: "NONE" | "FREELANCER" | "FOUR_INSURANCE";
  insuranceRate: number;
  freelancerTaxRate: number;
  nationalPensionEmployeeRate: number;
  nationalPensionEmployerRate: number;
  healthInsuranceEmployeeRate: number;
  healthInsuranceEmployerRate: number;
  longTermCareEmployeeRate: number;
  longTermCareEmployerRate: number;
  employmentInsuranceEmployeeRate: number;
  employmentInsuranceEmployerRate: number;
  industrialAccidentEmployerRate: number;
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
  staffTemplates?: Record<string, Record<string, number[]>>;
  absenceOverrides?: Record<string, string[]>;
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
            weeklyWorkingHours: Number((member as Partial<AppStaff>).weeklyWorkingHours) || Math.round(((Number((member as Partial<AppStaff>).expectedMonthlyHours) || 160) / 4.345) * 10) / 10,
            weeklyWorkingDays: Number((member as Partial<AppStaff>).weeklyWorkingDays) || 5,
            insuranceType:
              (member as Partial<AppStaff>).insuranceType === "FREELANCER" ||
              (member as Partial<AppStaff>).insuranceType === "FOUR_INSURANCE"
                ? ((member as Partial<AppStaff>).insuranceType as "FREELANCER" | "FOUR_INSURANCE")
                : "NONE",
            freelancerTaxRate: Number((member as Partial<AppStaff>).freelancerTaxRate) || 3.3,
            nationalPensionEmployeeRate: Number((member as Partial<AppStaff>).nationalPensionEmployeeRate) || 0,
            nationalPensionEmployerRate: Number((member as Partial<AppStaff>).nationalPensionEmployerRate) || 0,
            healthInsuranceEmployeeRate: Number((member as Partial<AppStaff>).healthInsuranceEmployeeRate) || 0,
            healthInsuranceEmployerRate: Number((member as Partial<AppStaff>).healthInsuranceEmployerRate) || 0,
            longTermCareEmployeeRate: Number((member as Partial<AppStaff>).longTermCareEmployeeRate) || 0,
            longTermCareEmployerRate: Number((member as Partial<AppStaff>).longTermCareEmployerRate) || 0,
            employmentInsuranceEmployeeRate: Number((member as Partial<AppStaff>).employmentInsuranceEmployeeRate) || 0,
            employmentInsuranceEmployerRate: Number((member as Partial<AppStaff>).employmentInsuranceEmployerRate) || 0,
            industrialAccidentEmployerRate: Number((member as Partial<AppStaff>).industrialAccidentEmployerRate) || 0,
            insuranceRate:
              Number((member as Partial<AppStaff>).nationalPensionEmployerRate) +
                Number((member as Partial<AppStaff>).healthInsuranceEmployerRate) +
                Number((member as Partial<AppStaff>).longTermCareEmployerRate) +
                Number((member as Partial<AppStaff>).employmentInsuranceEmployerRate) +
                Number((member as Partial<AppStaff>).industrialAccidentEmployerRate) ||
              Number((member as Partial<AppStaff>).insuranceRate) ||
              0,
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
          staffTemplates:
            schedule.staffTemplates && typeof schedule.staffTemplates === "object"
              ? Object.fromEntries(
                  Object.entries(schedule.staffTemplates).map(([staffId, dayMap]) => [
                    staffId,
                    Object.fromEntries(
                      Object.entries(dayMap ?? {}).map(([day, slots]) => [
                        day,
                        Array.isArray(slots) ? slots.map((slot) => Number(slot)).filter((slot) => Number.isFinite(slot)) : [],
                      ]),
                    ),
                  ]),
                )
              : {},
          absenceOverrides:
            schedule.absenceOverrides && typeof schedule.absenceOverrides === "object"
              ? Object.fromEntries(
                  Object.entries(schedule.absenceOverrides).map(([dateKey, staffIds]) => [
                    dateKey,
                    Array.isArray(staffIds) ? staffIds.filter((staffId) => typeof staffId === "string") : [],
                  ]),
                )
              : {},
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
