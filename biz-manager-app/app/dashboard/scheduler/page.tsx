import { requireSession } from "@/lib/auth";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { readAppData } from "@/lib/file-db";
import { WageScheduler } from "@/components/wage-scheduler";

export default async function SchedulerPage() {
  const session = await requireSession();
  const data = await readAppData();
  const store = data.stores.find((item) => item.id === session.storeId);
  const staff = data.staff
    .filter((item) => item.storeId === session.storeId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      baseWage: item.baseWage,
      targetWage: item.targetWage,
      holidayWage: item.holidayWage,
      bonusWage: item.bonusWage,
      capacity: item.capacity,
      incentive: item.incentive,
      expectedSales: item.expectedSales,
      performanceBonus: item.performanceBonus,
      mealAllowance: item.mealAllowance,
      transportAllowance: item.transportAllowance,
      otherAllowance: item.otherAllowance,
      employmentType: item.employmentType,
      monthlySalary: item.monthlySalary,
      expectedMonthlyHours: item.expectedMonthlyHours,
      insuranceType: item.insuranceType,
      insuranceRate: item.insuranceRate,
    }));
  const financeItems = data.finance.filter((item) => item.storeId === session.storeId);

  return (
    <>
      <div style={{ background: "#020617", padding: 24, paddingBottom: 0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <DashboardTabs current="/dashboard/scheduler" role={session.role} />
        </div>
      </div>
      <WageScheduler
        staff={staff}
        financeItems={financeItems}
        canEdit={session.role !== "STAFF"}
        storageScope={`${session.loginId}:${session.storeId}`}
        financeSettings={{
          expectedMonthlyRevenue: Number(store?.expectedMonthlyRevenue) || 0,
          expectedProfitMarginRate: Number(store?.expectedProfitMarginRate) || 25,
          estimatedTaxRate: Number(store?.estimatedTaxRate) || 10,
        }}
      />
    </>
  );
}
