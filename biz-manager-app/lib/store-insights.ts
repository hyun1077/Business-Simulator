export type InsightFinanceItem = {
  id?: string;
  type: "REVENUE" | "EXPENSE";
  amount: number;
  targetDate: string;
  category: string;
  inputMode?: "AMOUNT" | "RATIO";
  ratioPercent?: number | null;
  memo?: string | null;
};

export type InsightStaff = {
  id: string;
  name: string;
  color?: string;
  baseWage?: number;
  targetWage: number;
  expectedSales?: number;
  capacity?: number;
  performanceBonus?: number;
  incentive?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  otherAllowance?: number;
  employmentType?: "HOURLY" | "MONTHLY";
  monthlySalary?: number;
  expectedMonthlyHours?: number;
  weeklyWorkingDays?: number;
  insuranceRate?: number;
};

export type InsightSchedule = {
  timeUnit?: number;
  assignments?: Record<string, Record<number, string[]>>;
  staffTemplates?: Record<string, Record<string, number[]>>;
  absenceOverrides?: Record<string, string[]>;
} | null;

export type InsightLog = {
  date: number;
  dayLabel: string;
  startTime: number;
  endTime: number;
  breakHours: number;
  grossHours: number;
  netHours: number;
};

export type InsightExpenseItem = InsightFinanceItem & {
  computedAmount: number;
};

export type InsightStaffMonthMetrics = {
  grossHours: number;
  netHours: number;
  extraAllowance: number;
  payroll: number;
  employeePay: number;
  employerCost: number;
  expectedRevenue: number;
  ownerContribution: number;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const SLOTS_BY_DAY = ["월", "화", "수", "목", "금", "토", "일"] as const;

function createEmptyAssignments() {
  return Object.fromEntries(SLOTS_BY_DAY.map((day) => [day, {} as Record<number, string[]>])) as Record<string, Record<number, string[]>>;
}

export function calcBreakHours(grossHours: number) {
  if (grossHours > 8) return 1;
  if (grossHours > 4) return 0.5;
  return 0;
}

export function entryAmount(item: Pick<InsightFinanceItem, "type" | "inputMode" | "ratioPercent" | "amount">, revenueBase: number) {
  return item.type === "EXPENSE" && item.inputMode === "RATIO"
    ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100))
    : Number(item.amount) || 0;
}

export function getScheduleAssignments(schedule: InsightSchedule) {
  const base = createEmptyAssignments();
  if (!schedule) return base;

  if (schedule.staffTemplates && Object.keys(schedule.staffTemplates).length > 0) {
    Object.entries(schedule.staffTemplates).forEach(([staffId, dayMap]) => {
      SLOTS_BY_DAY.forEach((day) => {
        (dayMap?.[day] ?? []).forEach((slot) => {
          const numericSlot = Number(slot);
          if (!Number.isFinite(numericSlot)) return;
          const current = base[day][numericSlot] ?? [];
          if (!current.includes(staffId)) base[day][numericSlot] = [...current, staffId];
        });
      });
    });
    return base;
  }

  Object.entries(schedule.assignments ?? {}).forEach(([day, slotMap]) => {
    base[day] = Object.fromEntries(
      Object.entries(slotMap ?? {}).map(([slot, ids]) => [Number(slot), Array.isArray(ids) ? ids : []]),
    );
  });
  return base;
}

function absenceKey(year: number, month: number, date: number) {
  return `${year}-${month}-${date}`;
}

export function getMonthStaffLogs(schedule: InsightSchedule, staffId: string, year: number, month: number) {
  const assignments = getScheduleAssignments(schedule);
  const absenceOverrides = schedule?.absenceOverrides ?? {};
  const timeUnit = schedule?.timeUnit === 30 || schedule?.timeUnit === 60 ? schedule.timeUnit : 20;
  const slots = Array.from({ length: (24 * 60) / timeUnit }, (_, index) => index * timeUnit);
  const daysInMonth = new Date(year, month, 0).getDate();
  const logs: InsightLog[] = [];

  for (let date = 1; date <= daysInMonth; date += 1) {
    if ((absenceOverrides[absenceKey(year, month, date)] ?? []).includes(staffId)) continue;
    const dayLabel = DAYS[new Date(year, month - 1, date).getDay()];
    const matched = slots.filter((slot) => assignments?.[dayLabel]?.[slot]?.includes(staffId));
    if (!matched.length) continue;
    const startTime = Math.min(...matched);
    const endTime = Math.max(...matched) + timeUnit;
    const grossHours = (endTime - startTime) / 60;
    const breakHours = calcBreakHours(grossHours);
    logs.push({
      date,
      dayLabel,
      startTime,
      endTime,
      breakHours,
      grossHours,
      netHours: Math.max(0, grossHours - breakHours),
    });
  }

  return logs;
}

export function getStaffMonthlyCompensation(
  member: Pick<
    InsightStaff,
    | "targetWage"
    | "expectedSales"
    | "capacity"
    | "performanceBonus"
    | "incentive"
    | "mealAllowance"
    | "transportAllowance"
    | "otherAllowance"
    | "employmentType"
    | "monthlySalary"
    | "expectedMonthlyHours"
    | "insuranceRate"
  >,
  grossHours: number,
  netHours: number,
  expectedProfitMarginRate = 25,
): InsightStaffMonthMetrics {
  const effectiveGrossHours = grossHours > 0 ? grossHours : Number(member.expectedMonthlyHours) || 160;
  const effectiveNetHours = netHours > 0 ? netHours : effectiveGrossHours;
  const extraAllowance =
    (Number(member.mealAllowance) || 0) +
    (Number(member.transportAllowance) || 0) +
    (Number(member.otherAllowance) || 0) +
    (Number(member.performanceBonus) || Number(member.incentive) || 0);
  const payroll =
    member.employmentType === "MONTHLY" && (Number(member.monthlySalary) || 0) > 0
      ? Number(member.monthlySalary) || 0
      : Math.round((Number(member.targetWage) || 0) * effectiveNetHours);
  const employeePay = payroll + extraAllowance;
  const employerCost = Math.round(employeePay * (1 + (Number(member.insuranceRate) || 0) / 100));
  const expectedRevenue = Math.round((Number(member.expectedSales) || Number(member.capacity) || 0) * effectiveGrossHours);
  const ownerContribution = Math.round(expectedRevenue * (expectedProfitMarginRate / 100)) - employerCost;

  return {
    grossHours: effectiveGrossHours,
    netHours: effectiveNetHours,
    extraAllowance,
    payroll,
    employeePay,
    employerCost,
    expectedRevenue,
    ownerContribution,
  };
}

export function getMonthFinanceBreakdown(
  items: InsightFinanceItem[],
  year: number,
  month: number,
  expectedMonthlyRevenue = 0,
) {
  const monthItems = items
    .filter((item) => {
      const date = new Date(item.targetDate);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    })
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));
  const realRevenue = monthItems
    .filter((item) => item.type === "REVENUE")
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const revenueBase = realRevenue > 0 ? realRevenue : Number(expectedMonthlyRevenue) || 0;
  const expenseItems = monthItems
    .filter((item) => item.type === "EXPENSE")
    .map((item) => ({ ...item, computedAmount: entryAmount(item, revenueBase) }));
  const totalExpense = expenseItems.reduce((sum, item) => sum + item.computedAmount, 0);

  return {
    monthItems,
    realRevenue,
    revenueBase,
    expenseItems,
    totalExpense,
  };
}

export function getStoreMonthInsights({
  staff,
  financeItems,
  schedule,
  year,
  month,
  expectedMonthlyRevenue = 0,
  expectedProfitMarginRate = 25,
  estimatedTaxRate = 10,
}: {
  staff: InsightStaff[];
  financeItems: InsightFinanceItem[];
  schedule: InsightSchedule;
  year: number;
  month: number;
  expectedMonthlyRevenue?: number;
  expectedProfitMarginRate?: number;
  estimatedTaxRate?: number;
}) {
  const finance = getMonthFinanceBreakdown(financeItems, year, month, expectedMonthlyRevenue);
  const staffMetrics = staff.map((member) => {
    const logs = getMonthStaffLogs(schedule, member.id, year, month);
    const grossHours = logs.reduce((sum, log) => sum + log.grossHours, 0);
    const netHours = logs.reduce((sum, log) => sum + log.netHours, 0);
    const compensation = getStaffMonthlyCompensation(member, grossHours, netHours, expectedProfitMarginRate);
    return {
      ...member,
      logs,
      workedDays: logs.length,
      ...compensation,
    };
  });
  const laborCost = staffMetrics.reduce((sum, member) => sum + member.employerCost, 0);
  const preTaxProfit = finance.revenueBase - finance.totalExpense - laborCost;
  const estimatedTax = Math.max(preTaxProfit, 0) * ((Number(estimatedTaxRate) || 0) / 100);
  const netProfit = preTaxProfit - estimatedTax;

  return {
    ...finance,
    staffMetrics,
    laborCost,
    preTaxProfit,
    estimatedTax,
    netProfit,
    laborRatio: finance.revenueBase > 0 ? (laborCost / finance.revenueBase) * 100 : 0,
  };
}
