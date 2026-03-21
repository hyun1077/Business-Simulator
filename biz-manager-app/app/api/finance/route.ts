import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createId, readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  type: z.enum(["REVENUE", "EXPENSE"]),
  category: z.string().min(1),
  amount: z.number().int().min(0),
  memo: z.string().optional(),
  targetDate: z.string().min(8),
});

export async function GET() {
  const session = await requireSession();
  const data = await readAppData();
  const items = data.finance
    .filter((item) => item.storeId === session.storeId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const entry = {
    id: createId(),
    storeId: session.storeId,
    type: body.type,
    category: body.category,
    amount: body.amount,
    memo: body.memo || null,
    targetDate: body.targetDate,
  };
  data.finance.push(entry);
  await writeAppData(data);

  return NextResponse.json({
    entry,
  });
}
