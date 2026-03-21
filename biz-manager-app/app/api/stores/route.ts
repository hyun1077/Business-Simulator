import { NextResponse } from "next/server";
import { readAppData } from "@/lib/file-db";

export async function GET() {
  const data = await readAppData();

  return NextResponse.json(
    data.stores.map((store) => {
      const entries = data.finance.filter((item) => item.storeId === store.id);
      const revenue = entries.filter((entry) => entry.type === "REVENUE").reduce((sum, entry) => sum + entry.amount, 0);
      const expense = entries.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + entry.amount, 0);

      return {
        id: store.id,
        code: store.code,
        name: store.name,
        businessType: store.businessType,
        revenue,
        expense,
      };
    }),
  );
}
