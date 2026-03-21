import { requireSession } from "@/lib/auth";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { readAppData } from "@/lib/file-db";
import { WageScheduler } from "@/components/wage-scheduler";

export default async function SchedulerPage() {
  const session = await requireSession();
  const data = await readAppData();
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
    }));
  const financeItems = data.finance.filter((item) => item.storeId === session.storeId);

  return (
    <>
      <div style={{ minHeight: "100vh", background: "#020617", padding: 24, paddingBottom: 0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <DashboardTabs current="/dashboard/scheduler" role={session.role} />
        </div>
      </div>
      <WageScheduler staff={staff} financeItems={financeItems} canEdit={session.role !== "STAFF"} />
    </>
  );
}
