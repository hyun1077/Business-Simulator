import { StaffManager } from "@/components/staff-manager";
import { requireRole } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";

export default async function StaffPage() {
  const session = await requireRole("MANAGER");
  const data = await readAppData();
  const staff = data.staff.filter((item) => item.storeId === session.storeId).reverse();
  const schedule = data.schedules.find((item) => item.storeId === session.storeId) ?? null;
  const store = data.stores.find((item) => item.id === session.storeId);
  const owner = store?.ownerUserId ? data.users.find((item) => item.id === store.ownerUserId) : null;

  return (
    <StaffManager
      initialStaff={staff}
      role={session.role}
      schedule={schedule}
      storeInfo={{
        storeName: store?.name ?? "매장명 미등록",
        ownerName: owner?.name ?? session.loginId,
        businessType: store?.businessType ?? "",
      }}
    />
  );
}
