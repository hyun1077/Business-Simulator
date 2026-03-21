import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    revenue: 43000000,
    expense: 17500000,
    laborCost: 8900000,
    profit: 16600000,
    laborRatio: 20.7,
    notes: [
      "저녁 피크 시간대에 매출 대비 인건비 효율이 가장 높습니다.",
      "오후 3시~5시는 매출 대비 인력 과배치 가능성이 있습니다.",
    ],
  };

  return NextResponse.json(data);
}
