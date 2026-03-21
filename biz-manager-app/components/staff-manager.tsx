"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Calendar, Users } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import type { SystemRole } from "@/types/domain";

type StaffMember = {
  id: string;
  name: string;
  color: string;
  baseWage: number;
  targetWage: number;
  capacity: number;
  incentive: number;
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
  const [targetYear, setTargetYear] = useState(2026);
  const [targetMonth, setTargetMonth] = useState(3);
  const [form, setForm] = useState({
    name: "",
    color: "#10b981",
    baseWage: 10030,
    targetWage: 12000,
    capacity: 100000,
    incentive: 0,
  });

  const avgTargetWage = useMemo(
    () => (staff.length ? Math.round(staff.reduce((sum, member) => sum + member.targetWage, 0) / staff.length) : 0),
    [staff],
  );
  const totalCapacity = useMemo(() => staff.reduce((sum, member) => sum + member.capacity, 0), [staff]);
  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === selectedStaffId) ?? staff[0],
    [selectedStaffId, staff],
  );

  const calendarLogs = useMemo(() => {
    if (!schedule || !selectedStaff) return {};
    const logs: Record<string, { startTime: number; endTime: number }> = {};
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const activeSlots = Array.from({ length: (24 * 60) / schedule.timeUnit }, (_, index) => index * schedule.timeUnit);

    for (let date = 1; date <= daysInMonth; date += 1) {
      const dayLabel = DAYS[new Date(targetYear, targetMonth - 1, date).getDay()];
      const slots = activeSlots.filter((slot) => schedule.assignments?.[dayLabel]?.[slot]?.includes(selectedStaff.id));
      if (slots.length > 0) {
        logs[String(date)] = {
          startTime: Math.min(...slots),
          endTime: Math.max(...slots) + schedule.timeUnit,
        };
      }
    }

    return logs;
  }, [schedule, selectedStaff, targetMonth, targetYear]);

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
        capacity: 100000,
        incentive: 0,
      });
    });
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <DashboardTabs current="/dashboard/staff" role={role} />

        <div style={summaryGridStyle}>
          <SummaryCard label="등록 직원 수" value={`${staff.length}명`} />
          <SummaryCard label="평균 목표시급" value={`${avgTargetWage.toLocaleString()}원`} />
          <SummaryCard label="총 처리용량" value={`${totalCapacity.toLocaleString()}원/h`} />
        </div>

        <div style={containerStyle}>
          <div style={panelStyle}>
            <h1 style={{ marginTop: 0 }}>직원 관리</h1>
            <p style={{ color: "#94a3b8" }}>
              직원 정보를 등록하면 스케줄과 급여 계산에 바로 반영됩니다.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="직원 이름" style={inputStyle} />
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#10b981" style={inputStyle} />
              <input type="number" value={form.baseWage} onChange={(e) => setForm({ ...form, baseWage: Number(e.target.value) })} placeholder="기본 시급" style={inputStyle} />
              <input type="number" value={form.targetWage} onChange={(e) => setForm({ ...form, targetWage: Number(e.target.value) })} placeholder="목표 시급" style={inputStyle} />
              <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} placeholder="시간당 처리용량" style={inputStyle} />
              <input type="number" value={form.incentive} onChange={(e) => setForm({ ...form, incentive: Number(e.target.value) })} placeholder="월 인센티브" style={inputStyle} />
              {error ? <div style={{ color: "#fca5a5" }}>{error}</div> : null}
              <button onClick={submit} disabled={pending} style={primaryButtonStyle}>
                {pending ? "저장 중..." : "직원 추가"}
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <Link href="/dashboard/scheduler" style={continueLinkStyle}>
                스케줄 작성으로 이동
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Users size={18} color="#34d399" />
                <h2 style={{ margin: 0 }}>등록된 직원</h2>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {staff.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedStaffId(member.id)}
                    style={{
                      ...staffCardStyle,
                      border: selectedStaffId === member.id ? "1px solid #10b981" : "1px solid #1e293b",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{member.name}</strong>
                      <span style={{ color: member.color }}>{member.color}</span>
                    </div>
                    <div style={{ color: "#94a3b8", marginTop: 8 }}>
                      기본 {member.baseWage.toLocaleString()}원 · 목표 {member.targetWage.toLocaleString()}원 · 처리용량 {member.capacity.toLocaleString()}원/h
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={18} color="#34d399" />
                  <h2 style={{ margin: 0 }}>직원 스케줄 달력</h2>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} style={miniInputStyle}>
                    {[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}년</option>)}
                  </select>
                  <select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))} style={miniInputStyle}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}
                  </select>
                </div>
              </div>

              {!selectedStaff ? (
                <div style={{ color: "#64748b" }}>직원을 먼저 등록해주세요.</div>
              ) : !schedule ? (
                <div style={{ color: "#64748b" }}>아직 저장된 스케줄이 없습니다.</div>
              ) : (
                <>
                  <div style={{ color: "#94a3b8", marginBottom: 12 }}>
                    {selectedStaff.name} · 현재 스케줄 단위 {schedule.timeUnit}분
                  </div>
                  <div style={calendarGridStyle}>
                    {DAYS.map((day) => (
                      <div key={day} style={calendarHeadStyle}>{day}</div>
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
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

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#020617", padding: 24 };
const summaryGridStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 };
const containerStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "360px 1fr" };
const panelStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const summaryCardStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const inputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const miniInputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" };
const primaryButtonStyle: React.CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const continueLinkStyle: React.CSSProperties = { display: "inline-block", padding: "12px 16px", background: "#111827", border: "1px solid #334155", borderRadius: 12, color: "#e2e8f0", textDecoration: "none" };
const staffCardStyle: React.CSSProperties = { padding: 16, borderRadius: 16, background: "#020617", textAlign: "left", cursor: "pointer" };
const calendarGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 };
const calendarHeadStyle: React.CSSProperties = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 };
const calendarCellStyle: React.CSSProperties = { minHeight: 88, padding: 10, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const emptyCellStyle: React.CSSProperties = { minHeight: 88 };
