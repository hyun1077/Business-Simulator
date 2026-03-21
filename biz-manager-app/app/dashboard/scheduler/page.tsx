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
      targetWage: item.targetWage,
      capacity: item.capacity,
    }));

  return (
    <>
      <div style={{ minHeight: "100vh", background: "#020617", padding: 24, paddingBottom: 0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <DashboardTabs current="/dashboard/scheduler" role={session.role} />
        </div>
      </div>
      <WageScheduler staff={staff} />
    </>
  );
}
