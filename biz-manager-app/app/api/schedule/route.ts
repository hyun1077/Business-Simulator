import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  timeUnit: z.number().int().positive(),
  hourlySalesProjection: z.record(z.string(), z.number().int().min(0)),
  assignments: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
});

export async function GET() {
  const session = await requireSession();
  const data = await readAppData();
  const schedule = data.schedules.find((item) => item.storeId === session.storeId);

  return NextResponse.json({
    schedule: schedule ?? null,
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();

  const nextSchedule = {
    storeId: session.storeId,
    timeUnit: body.timeUnit,
    hourlySalesProjection: Object.fromEntries(
      Object.entries(body.hourlySalesProjection).map(([key, value]) => [Number(key), value]),
    ) as Record<number, number>,
    assignments: Object.fromEntries(
      Object.entries(body.assignments).map(([day, slots]) => [
        day,
        Object.fromEntries(Object.entries(slots).map(([time, staffIds]) => [Number(time), staffIds])),
      ]),
    ) as Record<string, Record<number, string[]>>,
  };

  const index = data.schedules.findIndex((item) => item.storeId === session.storeId);
  if (index >= 0) {
    data.schedules[index] = nextSchedule;
  } else {
    data.schedules.push(nextSchedule);
  }

  await writeAppData(data);
  return NextResponse.json({ schedule: nextSchedule });
}
