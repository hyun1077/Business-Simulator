import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { createId, readAppData, writeAppData } from "@/lib/file-db";

const bodySchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  baseWage: z.number().int().min(0),
  targetWage: z.number().int().min(0),
  expectedSales: z.number().int().min(0),
  performanceBonus: z.number().int().min(0),
  mealAllowance: z.number().int().min(0),
  transportAllowance: z.number().int().min(0),
  otherAllowance: z.number().int().min(0),
  employmentType: z.enum(["HOURLY", "MONTHLY"]),
  monthlySalary: z.number().int().min(0),
  expectedMonthlyHours: z.number().int().min(1),
  insuranceType: z.enum(["NONE", "FREELANCER", "FOUR_INSURANCE"]),
  insuranceRate: z.number().min(0).max(100),
  freelancerTaxRate: z.number().min(0).max(100).default(3.3),
  nationalPensionEmployeeRate: z.number().min(0).max(100).default(0),
  nationalPensionEmployerRate: z.number().min(0).max(100).default(0),
  healthInsuranceEmployeeRate: z.number().min(0).max(100).default(0),
  healthInsuranceEmployerRate: z.number().min(0).max(100).default(0),
  longTermCareEmployeeRate: z.number().min(0).max(100).default(0),
  longTermCareEmployerRate: z.number().min(0).max(100).default(0),
  employmentInsuranceEmployeeRate: z.number().min(0).max(100).default(0),
  employmentInsuranceEmployerRate: z.number().min(0).max(100).default(0),
  industrialAccidentEmployerRate: z.number().min(0).max(100).default(0),
});

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const data = await readAppData();
  const staff = data.staff.filter((item) => item.storeId === session.storeId).reverse();

  return NextResponse.json(staff);
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const holidayWage = Math.round(body.baseWage * 0.2);
  const bonusWage = Math.max(0, body.targetWage - (body.baseWage + holidayWage));
  const employerInsuranceRate =
    Number(body.nationalPensionEmployerRate) +
    Number(body.healthInsuranceEmployerRate) +
    Number(body.longTermCareEmployerRate) +
    Number(body.employmentInsuranceEmployerRate) +
    Number(body.industrialAccidentEmployerRate);

  const staff = {
    id: createId(),
    storeId: session.storeId,
    ...body,
    insuranceRate: employerInsuranceRate,
    capacity: body.expectedSales,
    incentive: body.performanceBonus,
    holidayWage,
    bonusWage,
  };
  data.staff.push(staff);
  await writeAppData(data);

  return NextResponse.json({ staff });
}
