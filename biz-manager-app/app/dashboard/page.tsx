import { DashboardHome } from "@/components/dashboard-home";
import { requireSession } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";
import { getStoreMonthInsights } from "@/lib/store-insights";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await readAppData();
  const user = data.users.find((item) => item.id === session.userId);
  const store = data.stores.find((item) => item.id === session.storeId);

  if (!user || !store) {
    return <div style={{ padding: 24 }}>대시보드를 불러오지 못했습니다.</div>;
  }

  const storeFinance = data.finance.filter((item) => item.storeId === store.id);
  const storeStaff = data.staff.filter((item) => item.storeId === store.id);
  const schedule = data.schedules.find((item) => item.storeId === store.id) ?? null;
  const today = new Date();
  const insights = getStoreMonthInsights({
    staff: storeStaff,
    financeItems: storeFinance,
    schedule,
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    expectedMonthlyRevenue: Number(store.expectedMonthlyRevenue) || 0,
    expectedProfitMarginRate: Number(store.expectedProfitMarginRate) || 25,
    estimatedTaxRate: Number(store.estimatedTaxRate) || 10,
  });

  return (
    <DashboardHome
      userName={user.name}
      loginId={session.loginId}
      role={session.role}
      staffCount={storeStaff.length}
      financeCount={storeFinance.length}
      store={{
        id: store.id,
        name: store.name,
        code: store.code,
        businessType: store.businessType,
        monthlyRevenue: insights.revenueBase,
        monthlyExpense: insights.totalExpense,
        monthlyLaborCost: insights.laborCost,
      }}
      kpi={{
        revenue: insights.revenueBase,
        expense: insights.totalExpense,
        laborCost: insights.laborCost,
        profit: insights.netProfit,
        laborRatio: insights.laborRatio,
      }}
    />
  );
}
