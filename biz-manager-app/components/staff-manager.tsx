"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Calendar, Wallet, Users } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import type { SystemRole } from "@/types/domain";

type StaffMember = {
  id: string;
  name: string;
  color: string;
  baseWage: number;
  targetWage: number;
  holidayWage: number;
  bonusWage: number;
  capacity: number;
  incentive: number;
  expectedSales: number;
  performanceBonus: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  employmentType: "HOURLY" | "MONTHLY";
  monthlySalary: number;
  expectedMonthlyHours: number;
  insuranceType: "NONE" | "FREELANCER" | "FOUR_INSURANCE";
  insuranceRate: number;
};

type ScheduleSnapshot = {
  timeUnit: number;
  assignments: Record<string, Record<number, string[]>>;
} | null;

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function StaffManager({
  initialStaff,
  role,
  schedule,
}: {
  initialStaff: StaffMember[];
  role: SystemRole;
  schedule: ScheduleSnapshot;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [staff, setStaff] = useState(initialStaff);
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaff[0]?.id ?? "");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [form, setForm] = useState({
    name: "",
    color: "#10b981",
    baseWage: 10030,
    targetWage: 12000,
    expectedSales: 100000,
    performanceBonus: 0,
    mealAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    employmentType: "HOURLY" as "HOURLY" | "MONTHLY",
    monthlySalary: 0,
    expectedMonthlyHours: 160,
    insuranceType: "NONE" as "NONE" | "FREELANCER" | "FOUR_INSURANCE",
    insuranceRate: 0,
  });

  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === selectedStaffId) ?? staff[0] ?? null,
    [selectedStaffId, staff],
  );

  const averageFinalHourly = useMemo(() => {
    if (!staff.length) return 0;
    return Math.round(staff.reduce((sum, member) => sum + getDisplayedFinalHourly(member), 0) / staff.length);
  }, [staff]);

  const totalExpectedSales = useMemo(
    () => staff.reduce((sum, member) => sum + (member.expectedSales || member.capacity || 0), 0),
    [staff],
  );

  const calendarLogs = useMemo(() => {
    if (!schedule || !selectedStaff) return {};
    const logs: Record<string, { startTime: number; endTime: number; hours: number }> = {};
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const activeSlots = Array.from({ length: (24 * 60) / schedule.timeUnit }, (_, index) => index * schedule.timeUnit);

    for (let date = 1; date <= daysInMonth; date += 1) {
      const dayLabel = DAYS[new Date(targetYear, targetMonth - 1, date).getDay()];
      const slots = activeSlots.filter((slot) => schedule.assignments?.[dayLabel]?.[slot]?.includes(selectedStaff.id));
      if (slots.length > 0) {
        const startTime = Math.min(...slots);
        const endTime = Math.max(...slots) + schedule.timeUnit;
        logs[String(date)] = {
          startTime,
          endTime,
          hours: (endTime - startTime) / 60,
        };
      }
    }

    return logs;
  }, [schedule, selectedStaff, targetMonth, targetYear]);

  const selectedMonthlyHours = useMemo(
    () => Object.values(calendarLogs).reduce((sum, item) => sum + item.hours, 0),
    [calendarLogs],
  );

  async function submit() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "직원 저장에 실패했습니다.");
        return;
      }

      setStaff((prev) => [result.staff, ...prev]);
      setSelectedStaffId(result.staff.id);
      setForm({
        name: "",
        color: "#10b981",
        baseWage: 10030,
        targetWage: 12000,
        expectedSales: 100000,
        performanceBonus: 0,
        mealAllowance: 0,
        transportAllowance: 0,
        otherAllowance: 0,
        employmentType: "HOURLY",
        monthlySalary: 0,
        expectedMonthlyHours: 160,
        insuranceType: "NONE",
        insuranceRate: 0,
      });
    });
  }

  const selectedSummary = selectedStaff
    ? buildStaffSummary(selectedStaff, selectedMonthlyHours || selectedStaff.expectedMonthlyHours)
    : null;

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 }}>
        <DashboardTabs current="/dashboard/staff" role={role} />

        <section style={heroStyle}>
          <div>
            <div style={{ color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Staff Workspace
            </div>
            <h1 style={{ margin: "8px 0", fontSize: 34 }}>직원 비용 구조와 월별 근무 달력을 같이 관리</h1>
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6 }}>
              최저시급, 주휴수당, 상여, 추가수당, 성과급, 보험부담, 월급 환산 시급까지 한 화면에서 보이도록 정리했습니다.
            </p>
          </div>
        </section>

        <div style={summaryGridStyle}>
          <SummaryCard label="등록 직원 수" value={`${staff.length}명`} />
          <SummaryCard label="평균 최종시급" value={`${averageFinalHourly.toLocaleString()}원`} />
          <SummaryCard label="시간당 기대매출" value={`${totalExpectedSales.toLocaleString()}원`} />
        </div>

        <div style={layoutStyle}>
          <section style={panelStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Users size={18} color="#34d399" />
              <h2 style={{ margin: 0 }}>직원 추가</h2>
            </div>

            <div style={formGridStyle}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="직원 이름" style={inputStyle} />
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#10b981" style={inputStyle} />
              <input type="number" value={form.baseWage} onChange={(e) => setForm({ ...form, baseWage: Number(e.target.value) })} placeholder="최저시급" style={inputStyle} />
              <input type="number" value={form.targetWage} onChange={(e) => setForm({ ...form, targetWage: Number(e.target.value) })} placeholder="최종시급" style={inputStyle} />
              <input type="number" value={form.expectedSales} onChange={(e) => setForm({ ...form, expectedSales: Number(e.target.value) })} placeholder="기대매출(시간당)" style={inputStyle} />
              <input type="number" value={form.performanceBonus} onChange={(e) => setForm({ ...form, performanceBonus: Number(e.target.value) })} placeholder="성과급" style={inputStyle} />
              <input type="number" value={form.mealAllowance} onChange={(e) => setForm({ ...form, mealAllowance: Number(e.target.value) })} placeholder="식비" style={inputStyle} />
              <input type="number" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: Number(e.target.value) })} placeholder="교통비" style={inputStyle} />
              <input type="number" value={form.otherAllowance} onChange={(e) => setForm({ ...form, otherAllowance: Number(e.target.value) })} placeholder="기타 수당" style={inputStyle} />
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as "HOURLY" | "MONTHLY" })} style={inputStyle}>
                <option value="HOURLY">시급제</option>
                <option value="MONTHLY">월급제</option>
              </select>
              <input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} placeholder="월급 총액" style={inputStyle} />
              <input type="number" value={form.expectedMonthlyHours} onChange={(e) => setForm({ ...form, expectedMonthlyHours: Number(e.target.value) })} placeholder="월 예상 근무시간" style={inputStyle} />
              <select value={form.insuranceType} onChange={(e) => setForm({ ...form, insuranceType: e.target.value as "NONE" | "FREELANCER" | "FOUR_INSURANCE" })} style={inputStyle}>
                <option value="NONE">보험 없음</option>
                <option value="FREELANCER">프리랜서 3.3%</option>
                <option value="FOUR_INSURANCE">사대보험</option>
              </select>
              <input type="number" step="0.1" value={form.insuranceRate} onChange={(e) => setForm({ ...form, insuranceRate: Number(e.target.value) })} placeholder="회사 부담률(%)" style={inputStyle} />
            </div>

            {error ? <div style={{ color: "#fca5a5", marginTop: 10 }}>{error}</div> : null}
            <button onClick={submit} disabled={pending} style={{ ...primaryButtonStyle, marginTop: 14 }}>
              {pending ? "저장 중..." : "직원 저장"}
            </button>
          </section>

          <div style={{ display: "grid", gap: 16 }}>
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Wallet size={18} color="#34d399" />
                <h2 style={{ margin: 0 }}>직원 상세 보상 구조</h2>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {staff.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedStaffId(member.id)}
                    style={{
                      ...staffChipStyle,
                      border: selectedStaffId === member.id ? "1px solid #10b981" : "1px solid #1e293b",
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: member.color, display: "inline-block" }} />
                    {member.name}
                  </button>
                ))}
              </div>

              {!selectedStaff || !selectedSummary ? (
                <div style={{ color: "#64748b" }}>직원을 선택하면 상세 계산이 보입니다.</div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={detailGridStyle}>
                    <InfoCard label="최저시급" value={`${selectedStaff.baseWage.toLocaleString()}원`} />
                    <InfoCard label="주휴수당" value={`${selectedStaff.holidayWage.toLocaleString()}원`} />
                    <InfoCard label="상여" value={`${selectedStaff.bonusWage.toLocaleString()}원`} />
                    <InfoCard label="최종시급" value={`${selectedStaff.targetWage.toLocaleString()}원`} />
                    <InfoCard label="기대매출" value={`${selectedStaff.expectedSales.toLocaleString()}원/h`} />
                    <InfoCard label="성과급" value={`${selectedStaff.performanceBonus.toLocaleString()}원`} />
                    <InfoCard label="추가수당" value={`${selectedSummary.extraAllowance.toLocaleString()}원`} helper="식비+교통비+기타" />
                    <InfoCard label="보험/부담률" value={`${getInsuranceLabel(selectedStaff.insuranceType)} / ${selectedStaff.insuranceRate.toFixed(1)}%`} />
                    <InfoCard label="월급 환산 시급" value={`${selectedSummary.salaryHourly.toLocaleString()}원`} helper="월급제 기준" />
                    <InfoCard label="실질 시급" value={`${selectedSummary.realHourly.toLocaleString()}원`} helper="수당 포함" />
                    <InfoCard label="월 총고용비" value={`${selectedSummary.employerMonthlyCost.toLocaleString()}원`} helper="회사 부담 포함" />
                    <InfoCard label="월 기대매출" value={`${selectedSummary.monthlyExpectedSales.toLocaleString()}원`} helper="선택 월 기준" />
                  </div>

                  <div style={selectedPanelStyle}>
                    <strong style={{ display: "block", marginBottom: 8 }}>{selectedStaff.name} 상세</strong>
                    <div style={{ display: "grid", gap: 8, color: "#94a3b8", lineHeight: 1.6 }}>
                      <div>식비 {selectedStaff.mealAllowance.toLocaleString()}원 / 교통비 {selectedStaff.transportAllowance.toLocaleString()}원 / 기타 {selectedStaff.otherAllowance.toLocaleString()}원</div>
                      <div>근무형태: {selectedStaff.employmentType === "MONTHLY" ? "월급제" : "시급제"} / 월 예상 근무시간 {selectedStaff.expectedMonthlyHours}h</div>
                      <div>선택 월 스케줄 기준 근무시간: {selectedMonthlyHours.toFixed(1)}h</div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={18} color="#34d399" />
                  <h2 style={{ margin: 0 }}>직원 스케줄 달력</h2>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} style={miniInputStyle}>
                    {[2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                  <select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))} style={miniInputStyle}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {month}월
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedStaff ? (
                <div style={{ color: "#64748b" }}>직원을 먼저 선택해주세요.</div>
              ) : !schedule ? (
                <div style={{ color: "#64748b" }}>저장된 스케줄이 아직 없습니다.</div>
              ) : (
                <>
                  <div style={{ color: "#94a3b8", marginBottom: 12 }}>
                    {selectedStaff.name} · 현재 스케줄 단위 {schedule.timeUnit}분
                  </div>
                  <div style={calendarGridStyle}>
                    {DAYS.map((day) => (
                      <div key={day} style={calendarHeadStyle}>
                        {day}
                      </div>
                    ))}
                    {(() => {
                      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
                      const firstDay = new Date(targetYear, targetMonth - 1, 1).getDay();
                      const cells: ReactNode[] = [];

                      for (let index = 0; index < firstDay; index += 1) {
                        cells.push(<div key={`empty-${index}`} style={emptyCellStyle} />);
                      }

                      for (let date = 1; date <= daysInMonth; date += 1) {
                        const log = calendarLogs[String(date)];
                        cells.push(
                          <div key={date} style={calendarCellStyle}>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{date}</div>
                            {log ? (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{formatTime(log.startTime)}</div>
                                <div style={{ fontSize: 12, color: "#34d399" }}>{formatTime(log.endTime)}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>{log.hours.toFixed(1)}h</div>
                              </>
                            ) : (
                              <div style={{ fontSize: 11, color: "#475569" }}>휴무</div>
                            )}
                          </div>,
                        );
                      }

                      return cells;
                    })()}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function getDisplayedFinalHourly(member: StaffMember) {
  if (member.employmentType === "MONTHLY" && member.monthlySalary > 0 && member.expectedMonthlyHours > 0) {
    return Math.round(member.monthlySalary / member.expectedMonthlyHours);
  }
  return member.targetWage;
}

function buildStaffSummary(member: StaffMember, monthlyHours: number) {
  const hours = monthlyHours > 0 ? monthlyHours : member.expectedMonthlyHours;
  const extraAllowance = member.mealAllowance + member.transportAllowance + member.otherAllowance;
  const baseCompensation =
    member.employmentType === "MONTHLY" && member.monthlySalary > 0
      ? member.monthlySalary
      : member.targetWage * hours;
  const salaryHourly =
    member.monthlySalary > 0 && member.expectedMonthlyHours > 0
      ? Math.round(member.monthlySalary / member.expectedMonthlyHours)
      : member.targetWage;
  const subtotal = baseCompensation + extraAllowance + member.performanceBonus;
  const employerMonthlyCost = Math.round(subtotal * (1 + member.insuranceRate / 100));
  const realHourly = hours > 0 ? Math.round(employerMonthlyCost / hours) : salaryHourly;
  const monthlyExpectedSales = Math.round((member.expectedSales || member.capacity || 0) * hours);

  return {
    extraAllowance,
    salaryHourly,
    realHourly,
    employerMonthlyCost,
    monthlyExpectedSales,
  };
}

function getInsuranceLabel(type: StaffMember["insuranceType"]) {
  if (type === "FREELANCER") return "프리랜서 3.3%";
  if (type === "FOUR_INSURANCE") return "사대보험";
  return "보험 없음";
}

function formatTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 24 }}>{value}</div>
    </div>
  );
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{value}</div>
      {helper ? <div style={{ color: "#64748b", marginTop: 6, fontSize: 12 }}>{helper}</div> : null}
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#020617", padding: 24 };
const heroStyle: React.CSSProperties = { padding: 24, borderRadius: 24, background: "linear-gradient(180deg, #0f172a 0%, #0b1220 100%)", border: "1px solid #1e293b" };
const summaryGridStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
const layoutStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "420px 1fr" };
const panelStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const summaryCardStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const formGridStyle: React.CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" };
const inputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const miniInputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" };
const primaryButtonStyle: React.CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const staffChipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, background: "#020617", color: "#e2e8f0", cursor: "pointer" };
const detailGridStyle: React.CSSProperties = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" };
const infoCardStyle: React.CSSProperties = { padding: 14, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" };
const selectedPanelStyle: React.CSSProperties = { padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" };
const calendarGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 };
const calendarHeadStyle: React.CSSProperties = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 };
const calendarCellStyle: React.CSSProperties = { minHeight: 92, padding: 10, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const emptyCellStyle: React.CSSProperties = { minHeight: 92 };
