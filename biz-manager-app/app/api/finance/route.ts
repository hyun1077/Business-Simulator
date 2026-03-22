import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { createId, readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  type: z.enum(["REVENUE", "EXPENSE"]),
  category: z.string().min(1),
  amount: z.number().int().min(0),
  inputMode: z.enum(["AMOUNT", "RATIO"]).default("AMOUNT"),
  ratioPercent: z.number().min(0).max(100).nullable().optional(),
  memo: z.string().optional(),
  targetDate: z.string().min(8),
});

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const data = await readAppData();
  const items = data.finance
    .filter((item) => item.storeId === session.storeId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const entry = {
    id: createId(),
    storeId: session.storeId,
    type: body.type,
    category: body.category,
    amount: body.amount,
    inputMode: body.inputMode,
    ratioPercent: body.inputMode === "RATIO" ? Number(body.ratioPercent) || 0 : null,
    memo: body.memo || null,
    targetDate: body.targetDate,
  };
  data.finance.push(entry);
  await writeAppData(data);

  return NextResponse.json({
    entry,
  });
}
