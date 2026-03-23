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
const updateSchema = bodySchema.extend({
  id: z.string().min(1),
});
const deleteSchema = z.object({
  id: z.string().min(1),
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

export async function PATCH(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const body = updateSchema.parse(await request.json());
  const data = await readAppData();
  const entry = data.finance.find((item) => item.id === body.id && item.storeId === session.storeId);

  if (!entry) {
    return NextResponse.json({ message: "수정할 항목을 찾지 못했습니다." }, { status: 404 });
  }

  entry.type = body.type;
  entry.category = body.category;
  entry.amount = body.amount;
  entry.inputMode = body.inputMode;
  entry.ratioPercent = body.inputMode === "RATIO" ? Number(body.ratioPercent) || 0 : null;
  entry.memo = body.memo || null;
  entry.targetDate = body.targetDate;
  await writeAppData(data);

  return NextResponse.json({ entry });
}

export async function DELETE(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const body = deleteSchema.parse(await request.json());
  const data = await readAppData();
  const index = data.finance.findIndex((item) => item.id === body.id && item.storeId === session.storeId);

  if (index < 0) {
    return NextResponse.json({ message: "삭제할 항목을 찾지 못했습니다." }, { status: 404 });
  }

  data.finance.splice(index, 1);
  await writeAppData(data);

  return NextResponse.json({ id: body.id });
}
