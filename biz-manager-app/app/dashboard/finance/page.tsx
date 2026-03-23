import { requireRole } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";
import { FinanceWorkspace } from "@/components/finance-workspace";

export default async function FinancePage() {
  const session = await requireRole("OWNER");
  const data = await readAppData();
  const items = data.finance
    .filter((item) => item.storeId === session.storeId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));
  const store = data.stores.find((item) => item.id === session.storeId);
  const staff = data.staff.filter((item) => item.storeId === session.storeId);
  const schedule = data.schedules.find((item) => item.storeId === session.storeId) ?? null;

  return (
    <FinanceWorkspace
      initialItems={items}
      role={session.role}
      initialSettings={{
        expectedProfitMarginRate: Number(store?.expectedProfitMarginRate) || 25,
        estimatedTaxRate: Number(store?.estimatedTaxRate) || 10,
        expectedMonthlyRevenue: Number(store?.expectedMonthlyRevenue) || 0,
      }}
      initialStaff={staff}
      schedule={schedule}
    />
  );
}
