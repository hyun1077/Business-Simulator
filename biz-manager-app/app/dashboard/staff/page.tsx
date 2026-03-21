import { requireRole } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";
import { StaffManager } from "@/components/staff-manager";

export default async function StaffPage() {
  const session = await requireRole("MANAGER");
  const data = await readAppData();
  const staff = data.staff.filter((item) => item.storeId === session.storeId).reverse();
  const schedule = data.schedules.find((item) => item.storeId === session.storeId) ?? null;

  return <StaffManager initialStaff={staff} role={session.role} schedule={schedule} />;
}
