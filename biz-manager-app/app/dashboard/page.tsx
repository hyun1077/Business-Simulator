import { DashboardHome } from "@/components/dashboard-home";
import { requireSession } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";

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
  const revenue = storeFinance.filter((item) => item.type === "REVENUE").reduce((sum, item) => sum + item.amount, 0);
  const expense = storeFinance
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + (item.inputMode === "RATIO" ? Math.round(revenue * ((item.ratioPercent ?? 0) / 100)) : item.amount), 0);
  const laborCost = storeStaff.reduce((sum, item) => {
    const hours = item.expectedMonthlyHours || 160;
    const payroll = item.employmentType === "MONTHLY" && item.monthlySalary > 0 ? item.monthlySalary : item.targetWage * hours;
    const extra = item.mealAllowance + item.transportAllowance + item.otherAllowance + item.performanceBonus;
    return sum + Math.round((payroll + extra) * (1 + item.insuranceRate / 100));
  }, 0);
  const profit = revenue - expense - laborCost;

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
        monthlyRevenue: revenue,
        monthlyExpense: expense,
        monthlyLaborCost: laborCost,
      }}
      kpi={{
        revenue,
        expense,
        laborCost,
        profit,
        laborRatio: revenue > 0 ? (laborCost / revenue) * 100 : 0,
      }}
    />
  );
}
