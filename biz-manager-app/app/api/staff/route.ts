import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createId, readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  baseWage: z.number().int().min(0),
  targetWage: z.number().int().min(0),
  capacity: z.number().int().min(0),
  incentive: z.number().int().min(0),
});

export async function GET() {
  const session = await requireSession();
  const data = await readAppData();
  const staff = data.staff.filter((item) => item.storeId === session.storeId).reverse();

  return NextResponse.json(staff);
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const holidayWage = Math.round(body.baseWage * 0.2);
  const bonusWage = Math.max(0, body.targetWage - (body.baseWage + holidayWage));

  const staff = {
    id: createId(),
    storeId: session.storeId,
    ...body,
    holidayWage,
    bonusWage,
  };
  data.staff.push(staff);
  await writeAppData(data);

  return NextResponse.json({ staff });
}
