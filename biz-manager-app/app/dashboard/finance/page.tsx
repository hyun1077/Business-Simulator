import { requireRole } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";
import { FinanceManager } from "@/components/finance-manager";

export default async function FinancePage() {
  const session = await requireRole("OWNER");
  const data = await readAppData();
  const items = data.finance
    .filter((item) => item.storeId === session.storeId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));

  return <FinanceManager initialItems={items} role={session.role} />;
}
