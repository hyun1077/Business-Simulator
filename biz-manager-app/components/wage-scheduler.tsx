"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, Save, TrendingDown, TrendingUp, Users } from "lucide-react";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Staff = {
  id: string;
  name: string;
  color: string;
  targetWage: number;
  capacity: number;
};

type ScheduleShape = Record<string, Record<number, string[]>>;

const createInitialSchedule = (): ScheduleShape =>
  Object.fromEntries(DAYS.map((day) => [day, {} as Record<number, string[]>]));

const formatTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function WageScheduler({ staff }: { staff: Staff[] }) {
  const [schedule, setSchedule] = useState<ScheduleShape>(createInitialSchedule);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id ?? "");
  const [timeUnit] = useState(20);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [hourlySalesProjection, setHourlySalesProjection] = useState<Record<number, number>>({
    10: 100000,
    11: 300000,
    12: 350000,
    13: 250000,
    18: 500000,
    19: 550000,
    20: 450000,
  });

  const assignedSlotCount = useMemo(
    () =>
      Object.values(schedule).reduce(
        (sum, slots) => sum + Object.values(slots).filter((ids) => ids.length > 0).length,
        0,
      ),
    [schedule],
  );

  useEffect(() => {
    if (!selectedStaffId && staff[0]?.id) {
      setSelectedStaffId(staff[0].id);
    }
  }, [selectedStaffId, staff]);

  useEffect(() => {
    async function loadSchedule() {
      const response = await fetch("/api/schedule");
      const result = await response.json();
      if (result.schedule) {
        setSchedule(result.schedule.assignments);
        setHourlySalesProjection(result.schedule.hourlySalesProjection);
      }
      setLoading(false);
    }
    void loadSchedule();
  }, []);

  const activeSlots = useMemo(
    () => Array.from({ length: (24 * 60) / timeUnit }, (_, i) => i * timeUnit),
    [timeUnit],
  );

  const handleCellToggle = (day: string, time: number) => {
    if (!selectedStaffId) return;
    setSchedule((prev) => {
      const prevDay = prev[day] || {};
      const ids = prevDay[time] || [];
      const has = ids.includes(selectedStaffId);
      const next = has ? ids.filter((id) => id !== selectedStaffId) : [...ids, selectedStaffId];
      return { ...prev, [day]: { ...prevDay, [time]: next } };
    });
  };

  async function saveSchedule() {
    setSaving(true);
    setSaveMessage("");
    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeUnit,
        hourlySalesProjection,
        assignments: schedule,
      }),
    });
    const result = await response.json();
    setSaving(false);
    setSaveMessage(response.ok ? "스케줄이 저장되었습니다." : result.message ?? "스케줄 저장에 실패했습니다.");
  }

  const hourlyChartData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const sales = hourlySalesProjection[hour] || 0;
      const slotStart = hour * 60;
      const slotEnd = slotStart + 60;
      const slots = activeSlots.filter((slot) => slot >= slotStart && slot < slotEnd);
      let laborCost = 0;
      let capacity = 0;
      slots.forEach((slot) => {
        DAYS.forEach((day) => {
          const ids = schedule[day]?.[slot] || [];
          ids.forEach((id) => {
            const found = staff.find((member) => member.id === id);
            if (!found) return;
            laborCost += found.targetWage * (timeUnit / 60) / 7;
            capacity += found.capacity * (timeUnit / 60) / 7;
          });
        });
      });
      return { hour, sales, laborCost, capacity };
    });
  }, [activeSlots, hourlySalesProjection, schedule, staff, timeUnit]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#020617", color: "#e2e8f0" }} onMouseUp={() => setDragging(false)}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 }}>
        <header style={headerStyle}>
          <div>
            <div style={{ color: "#6ee7b7", marginBottom: 8 }}>저장 가능한 스케줄 워크스페이스</div>
            <h1 style={{ margin: 0, fontSize: 32 }}>스케줄 작성과 시간대별 효율 분석</h1>
            <p style={{ color: "#cbd5e1", maxWidth: 760 }}>
              등록한 직원이 그대로 나타나며, 배정한 근무표와 시간대별 예상 매출을 함께 저장할 수 있습니다.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
            <button onClick={saveSchedule} disabled={saving || loading} style={saveButtonStyle}>
              <Save size={16} />
              {saving ? "저장 중..." : "스케줄 저장"}
            </button>
            <div style={{ color: saveMessage ? "#6ee7b7" : "#94a3b8", fontSize: 14 }}>
              {loading ? "저장된 스케줄을 불러오는 중..." : saveMessage || "변경 내용은 저장 버튼을 눌러야 반영됩니다."}
            </div>
          </div>
        </header>

        <section style={cardGridStyle}>
          <InfoCard icon={<Users size={18} />} title="실제 직원 연동" body="직원 관리에서 등록한 사람이 그대로 스케줄 선택 목록에 나타납니다." />
          <InfoCard icon={<Activity size={18} />} title="저장형 스케줄" body="작성한 배정표는 API를 통해 매장 단위로 저장됩니다." />
          <InfoCard icon={<TrendingUp size={18} />} title="효율 분석" body="시간대별 매출, 인건비, 처리용량을 비교해 근무표를 조정할 수 있습니다." />
        </section>

        <section style={summaryGridStyle}>
          <SummaryCard label="등록 직원 수" value={`${staff.length}명`} />
          <SummaryCard label="배정 슬롯 수" value={`${assignedSlotCount}칸`} />
          <SummaryCard label="분석 입력 시간대" value={`${Object.keys(hourlySalesProjection).length}개`} />
        </section>

        <section style={gridSectionStyle}>
          <aside style={sidePanelStyle}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>직원 선택</div>
            <div style={{ display: "grid", gap: 8 }}>
              {staff.length === 0 ? <div style={{ color: "#94a3b8" }}>먼저 직원을 등록해주세요.</div> : null}
              {staff.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStaffId(member.id)}
                  style={{
                    borderRadius: 999,
                    padding: "10px 14px",
                    border: member.id === selectedStaffId ? "1px solid #34d399" : "1px solid #334155",
                    background: member.id === selectedStaffId ? "#111827" : "#020617",
                    color: "#e2e8f0",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </aside>

          <div style={tablePanelStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>시간</th>
                  {DAYS.map((day) => (
                    <th key={day} style={thStyle}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSlots.filter((slot) => slot >= 9 * 60 && slot <= 22 * 60).map((slot) => (
                  <tr key={slot}>
                    <td style={timeCellStyle}>{formatTime(slot)}</td>
                    {DAYS.map((day) => {
                      const assignedIds = schedule[day]?.[slot] || [];
                      return (
                        <td
                          key={`${day}-${slot}`}
                          onMouseDown={() => {
                            setDragging(true);
                            handleCellToggle(day, slot);
                          }}
                          onMouseEnter={() => {
                            if (dragging) handleCellToggle(day, slot);
                          }}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #1e293b",
                            cursor: selectedStaffId ? "pointer" : "not-allowed",
                            background: assignedIds.includes(selectedStaffId) ? "rgba(52,211,153,0.12)" : "transparent",
                          }}
                        >
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {assignedIds.map((id) => {
                              const member = staff.find((item) => item.id === id);
                              if (!member) return null;
                              return (
                                <span key={id} style={{ padding: "2px 8px", borderRadius: 999, background: member.color, color: "white", fontSize: 10 }}>
                                  {member.name}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={chartPanelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginTop: 0 }}>시간대별 효율 분석</h2>
              <p style={{ color: "#94a3b8" }}>
                저장된 근무표를 기준으로 시간대별 인건비와 처리용량을 계산합니다.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, color: "#cbd5e1", fontSize: 12 }}>
              <Legend color="rgba(59,130,246,0.6)" label="매출" />
              <Legend color="rgba(239,68,68,0.6)" label="인건비" />
              <Legend color="#34d399" label="처리용량" line />
            </div>
          </div>
          <div style={{ height: 260, display: "flex", alignItems: "end", gap: 6, marginTop: 18 }}>
            {hourlyChartData.map((item) => {
              const maxVal = 600000;
              const salesHeight = Math.min((item.sales / maxVal) * 100, 100);
              const laborHeight = Math.min((item.laborCost / maxVal) * 100, 100);
              const capacityHeight = Math.min((item.capacity / maxVal) * 100, 100);
              const overload = item.sales > item.capacity && item.capacity > 0;
              return (
                <div key={item.hour} style={{ flex: 1, minWidth: 24, position: "relative", height: "100%" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: `${capacityHeight}%`, borderTop: "1px dashed #34d399" }} />
                  <div style={{ display: "flex", alignItems: "end", height: "100%", gap: 2 }}>
                    <div style={{ width: "50%", height: `${salesHeight}%`, background: "rgba(59,130,246,0.6)", borderRadius: "6px 6px 0 0" }} />
                    <div style={{ width: "50%", height: `${laborHeight}%`, background: overload ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.55)", borderRadius: "6px 6px 0 0" }} />
                  </div>
                  <div style={{ marginTop: 8, textAlign: "center", color: "#64748b", fontSize: 11 }}>{item.hour}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))", gap: 8 }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <label key={hour} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span>
                <input
                  type="number"
                  value={hourlySalesProjection[hour] || 0}
                  onChange={(event) =>
                    setHourlySalesProjection((prev) => ({
                      ...prev,
                      [hour]: Number(event.target.value),
                    }))
                  }
                  style={salesInputStyle}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12, color: "#94a3b8", fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} color="#34d399" />
              수익이 높은 시간대를 빠르게 확인
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingDown size={14} color="#fb923c" />
              저효율 시간대 인력 배치 조정
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={{ color: "#34d399", marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 24 }}>{value}</div>
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: line ? 2 : 12, background: color }} />
      {label}
    </span>
  );
}

const headerStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 20,
  border: "1px solid #1e293b",
  background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(8,47,73,0.9))",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};
const saveButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#10b981",
  color: "#052e16",
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};
const cardGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 };
const infoCardStyle: React.CSSProperties = { borderRadius: 18, padding: 18, border: "1px solid #1e293b", background: "#0f172a" };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 };
const summaryCardStyle: React.CSSProperties = { borderRadius: 18, padding: 18, border: "1px solid #1e293b", background: "#0f172a" };
const gridSectionStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" };
const sidePanelStyle: React.CSSProperties = { borderRadius: 18, padding: 18, border: "1px solid #1e293b", background: "#0f172a" };
const tablePanelStyle: React.CSSProperties = { borderRadius: 18, padding: 18, border: "1px solid #1e293b", background: "#0f172a", overflow: "auto" };
const thStyle: React.CSSProperties = { padding: 8, borderBottom: "1px solid #334155" };
const timeCellStyle: React.CSSProperties = { padding: 8, borderBottom: "1px solid #1e293b", color: "#94a3b8" };
const chartPanelStyle: React.CSSProperties = { borderRadius: 18, padding: 18, border: "1px solid #1e293b", background: "#0f172a" };
const salesInputStyle: React.CSSProperties = { width: "100%", background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 6px", textAlign: "center" };
