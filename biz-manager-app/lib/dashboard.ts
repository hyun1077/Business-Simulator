import type { EntryType, FinanceEntry, StaffProfile, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashboardKpi, StoreSummary } from "@/types/domain";

type StoreWithRelations = Store & {
  financeEntries: FinanceEntry[];
  staffProfiles: StaffProfile[];
};

export function calculateDashboardData(store: StoreWithRelations): {
  kpi: DashboardKpi;
  summary: StoreSummary;
} {
  const revenue = sumFinance(store.financeEntries, "REVENUE");
  const expense = sumFinance(store.financeEntries, "EXPENSE");
  const laborCost = store.staffProfiles.reduce((sum, member) => sum + member.targetWage * 160 + member.incentive, 0);
  const profit = revenue - expense - laborCost;
  const laborRatio = revenue > 0 ? (laborCost / revenue) * 100 : 0;

  return {
    kpi: {
      revenue,
      expense,
      laborCost,
      profit,
      laborRatio,
    },
    summary: {
      id: store.id,
      name: store.name,
      code: store.code,
      businessType: store.businessType,
      monthlyRevenue: revenue,
      monthlyExpense: expense,
      monthlyLaborCost: laborCost,
    },
  };
}

function sumFinance(entries: FinanceEntry[], type: EntryType) {
  return entries.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0);
}

export async function getStoreDashboard(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      financeEntries: true,
      staffProfiles: true,
    },
  });

  if (!store) {
    return null;
  }

  return calculateDashboardData(store);
}
