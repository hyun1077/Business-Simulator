import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  expectedProfitMarginRate: z.number().min(0).max(100),
  estimatedTaxRate: z.number().min(0).max(100),
  expectedMonthlyRevenue: z.number().int().min(0),
});

export async function GET() {
  const session = await requireRole("OWNER");
  const data = await readAppData();
  const store = data.stores.find((item) => item.id === session.storeId);

  return NextResponse.json({
    settings: {
      expectedProfitMarginRate: Number(store?.expectedProfitMarginRate) || 25,
      estimatedTaxRate: Number(store?.estimatedTaxRate) || 10,
      expectedMonthlyRevenue: Number(store?.expectedMonthlyRevenue) || 0,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireRole("OWNER");
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const store = data.stores.find((item) => item.id === session.storeId);

  if (!store) {
    return NextResponse.json({ message: "매장을 찾을 수 없습니다." }, { status: 404 });
  }

  store.expectedProfitMarginRate = body.expectedProfitMarginRate;
  store.estimatedTaxRate = body.estimatedTaxRate;
  store.expectedMonthlyRevenue = body.expectedMonthlyRevenue;
  await writeAppData(data);

  return NextResponse.json({
    settings: {
      expectedProfitMarginRate: store.expectedProfitMarginRate,
      estimatedTaxRate: store.estimatedTaxRate,
      expectedMonthlyRevenue: store.expectedMonthlyRevenue,
    },
  });
}
