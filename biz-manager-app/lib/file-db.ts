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
};

export type AppFinance = {
  id: string;
  storeId: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  memo: string | null;
  targetDate: string;
};

export type AppSchedule = {
  storeId: string;
  timeUnit: number;
  hourlySalesProjection: Record<number, number>;
  assignments: Record<string, Record<number, string[]>>;
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

export async function readAppData() {
  await ensureDataFile();
  const content = await fs.readFile(dataFile, "utf8");
  return JSON.parse(content) as AppData;
}

export async function writeAppData(data: AppData) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export function createId() {
  return randomUUID();
}
