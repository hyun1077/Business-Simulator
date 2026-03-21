"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  Lock,
  PieChart,
  RotateCcw,
  Save,
  Store,
  TrendingDown,
  Users,
} from "lucide-react";

const CALENDAR_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const SCHEDULE_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

type TabId = "schedule" | "analysis" | "summary";
type ScheduleShape = Record<string, Record<number, string[]>>;
type Pattern = { id: string; name: string; data: Record<number, number> };
type MonthlyLog = { startTime: number; endTime: number; breakHours: number };
type Snapshot = { isSaved: boolean; staffSnapshot: Staff[]; dailyLogs: Record<string, MonthlyLog> };

type Staff = {
  id: string;
  name: string;
  color: string;
  baseWage: number;
  targetWage: number;
  holidayWage: number;
  bonusWage: number;
  capacity: number;
  incentive: number;
};

type FinanceItem = {
  id: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  memo?: string | null;
};

type EditForm = {
  start: string;
  end: string;
  break: number | string;
};

const DEFAULT_PATTERNS: Pattern[] = [
  { id: "p1", name: "평일 (학기중)", data: createHourlyPattern(300000, 400000, 100000, 11, 13, 18, 20, 9, 22) },
  { id: "p2", name: "금요일/주말 (피크)", data: createHourlyPattern(500000, 800000, 200000, 11, 13, 17, 22, 9, 23) },
  { id: "p3", name: "방학 기간 (비수기)", data: createHourlyPattern(200000, 250000, 80000, 11, 13, 18, 20, 10, 21) },
];

function createHourlyPattern(
  lunch: number,
  dinner: number,
  normal: number,
  lunchStart: number,
  lunchEnd: number,
  dinnerStart: number,
  dinnerEnd: number,
  open: number,
  close: number,
) {
  return Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [
      hour,
      hour >= lunchStart && hour <= lunchEnd
        ? lunch
        : hour >= dinnerStart && hour <= dinnerEnd
          ? dinner
          : hour >= open && hour <= close
            ? normal
            : 0,
    ]),
  ) as Record<number, number>;
}

function createInitialSchedule(): ScheduleShape {
  return Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, {} as Record<number, string[]>]));
}

function formatTime(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "--:--";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function calcBreakHours(grossHours: number) {
  if (grossHours > 8) return 1;
  if (grossHours > 4) return 0.5;
  return 0;
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function buildWeeklyStaffSummary(staffList: Staff[], schedule: ScheduleShape, timeUnit: number, activeSlots: number[]) {
  const hourRatio = timeUnit / 60;

  return staffList.map((member) => {
    const weeklyNet = sum(
      SCHEDULE_DAYS.map((day) => {
        const slots = activeSlots.filter((slot) => schedule?.[day]?.[slot]?.includes(member.id));
        const grossHours = slots.length * hourRatio;
        return Math.max(0, grossHours - calcBreakHours(grossHours));
      }),
    );

    const workPayWeekly = Math.round(
      sum(
        SCHEDULE_DAYS.map((day) => {
          const slots = activeSlots.filter((slot) => schedule?.[day]?.[slot]?.includes(member.id));
          return slots.length * (member.baseWage + member.bonusWage) * hourRatio;
        }),
      ),
    );

    const holidayAllowanceAmount = Math.round((weeklyNet >= 15 ? (weeklyNet / 40) * 8 : 0) * member.baseWage);

    return {
      staffId: member.id,
      staffName: member.name,
      weeklyNet,
      workPayWeekly,
      monthlyTotalPay: (workPayWeekly + holidayAllowanceAmount) * 4 + member.incentive,
    };
  });
}

export function WageScheduler({
  staff,
  financeItems,
  canEdit,
}: {
  staff: Staff[];
  financeItems: FinanceItem[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<TabId>("schedule");
  const [timeUnit, setTimeUnit] = useState<20 | 30 | 60>(20);
  const [showEarlyHours, setShowEarlyHours] = useState(false);
  const [businessHours, setBusinessHours] = useState({ start: 10, end: 22 });
  const [schedule, setSchedule] = useState<ScheduleShape>(createInitialSchedule);
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? "");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [patterns, setPatterns] = useState<Pattern[]>(DEFAULT_PATTERNS);
  const [selectedPatternId, setSelectedPatternId] = useState(DEFAULT_PATTERNS[0].id);
  const [newPatternName, setNewPatternName] = useState("");
  const [hourlySalesProjection, setHourlySalesProjection] = useState<Record<number, number>>({
    ...DEFAULT_PATTERNS[0].data,
  });
  const [targetYear, setTargetYear] = useState(2026);
  const [targetMonth, setTargetMonth] = useState(3);
  const [monthlySnapshots, setMonthlySnapshots] = useState<Record<string, Snapshot>>({});
  const [manualEdits, setManualEdits] = useState<Record<string, MonthlyLog | "DELETE">>({});
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ start: "", end: "", break: 0 });

  const row11AmRef = useRef<HTMLTableRowElement | null>(null);

  const activeSlots = useMemo(
    () => Array.from({ length: (24 * 60) / timeUnit }, (_, index) => index * timeUnit),
    [timeUnit],
  );
  const visibleSlots = useMemo(
    () => activeSlots.filter((slot) => (showEarlyHours ? true : slot >= 540)),
    [activeSlots, showEarlyHours],
  );

  const weeklySummary = useMemo(
    () => buildWeeklyStaffSummary(staff, schedule, timeUnit, activeSlots),
    [staff, schedule, timeUnit, activeSlots],
  );

  const totalRevenue = useMemo(
    () => sum(financeItems.filter((item) => item.type === "REVENUE").map((item) => item.amount)),
    [financeItems],
  );
  const totalExpense = useMemo(
    () => sum(financeItems.filter((item) => item.type === "EXPENSE").map((item) => item.amount)),
    [financeItems],
  );
  const assignedSlotCount = useMemo(
    () => Object.values(schedule).reduce((acc, slots) => acc + Object.values(slots).filter((ids) => ids.length > 0).length, 0),
    [schedule],
  );

  useEffect(() => {
    if (!selectedStaffId && staff[0]?.id) setSelectedStaffId(staff[0].id);
  }, [selectedStaffId, staff]);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response = await fetch("/api/schedule");
        const result = await response.json();
        if (result.schedule) {
          setSchedule(result.schedule.assignments ?? createInitialSchedule());
          setTimeUnit(result.schedule.timeUnit ?? 20);
          setHourlySalesProjection((prev) => ({ ...prev, ...(result.schedule.hourlySalesProjection ?? {}) }));
        }
      } finally {
        setLoading(false);
      }
    }

    void loadSchedule();
  }, []);

  useEffect(() => {
    if (tab === "schedule" && row11AmRef.current) {
      row11AmRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tab, timeUnit, showEarlyHours]);

  function handleCellToggle(day: string, slot: number) {
    if (!canEdit || !selectedStaffId) return;
    setSchedule((prev) => {
      const daySlots = prev[day] || {};
      const currentIds = daySlots[slot] || [];
      const nextIds = currentIds.includes(selectedStaffId)
        ? currentIds.filter((id) => id !== selectedStaffId)
        : [...currentIds, selectedStaffId];
      return { ...prev, [day]: { ...daySlots, [slot]: nextIds } };
    });
  }

  async function saveSchedule() {
    if (!canEdit) return;
    setSaving(true);
    setSaveMessage("");

    try {
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
      setSaveMessage(response.ok ? "스케줄이 저장되었습니다." : result.message ?? "스케줄 저장에 실패했습니다.");
    } catch {
      setSaveMessage("스케줄 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function generateDefaultLogsForMonth(year: number, month: number) {
    const logs: Record<string, MonthlyLog> = {};
    const daysInMonth = new Date(year, month, 0).getDate();

    staff.forEach((member) => {
      for (let date = 1; date <= daysInMonth; date += 1) {
        const dayLabel = CALENDAR_DAYS[new Date(year, month - 1, date).getDay()];
        const dateKey = `${year}-${month}-${date}-${member.id}`;
        const slots = activeSlots.filter((slot) => schedule?.[dayLabel]?.[slot]?.includes(member.id));
        if (slots.length > 0) {
          const startTime = Math.min(...slots);
          const endTime = Math.max(...slots) + timeUnit;
          logs[dateKey] = {
            startTime,
            endTime,
            breakHours: calcBreakHours((endTime - startTime) / 60),
          };
        }
      }
    });

    return logs;
  }

  const currentMonthLogs = useMemo(() => {
    const monthKey = `${targetYear}-${targetMonth}`;
    if (monthlySnapshots[monthKey]) return monthlySnapshots[monthKey].dailyLogs;

    const merged = { ...generateDefaultLogsForMonth(targetYear, targetMonth) };
    Object.entries(manualEdits).forEach(([key, value]) => {
      const [year, month] = key.split("-").map(Number);
      if (year === targetYear && month === targetMonth) {
        if (value === "DELETE") delete merged[key];
        else merged[key] = value;
      }
    });
    return merged;
  }, [activeSlots, manualEdits, monthlySnapshots, schedule, staff, targetMonth, targetYear, timeUnit]);

  const monthlyStats = useMemo(() => {
    const monthKey = `${targetYear}-${targetMonth}`;
    const sourceStaff = monthlySnapshots[monthKey]?.staffSnapshot ?? staff;
    let totalLabor = 0;

    const staffStats = sourceStaff.map((member) => {
      let monthlyGross = 0;
      let totalPay = member.incentive;
      let workedDays = 0;

      Object.entries(currentMonthLogs).forEach(([key, log]) => {
        if (key.endsWith(`-${member.id}`)) {
          const gross = (log.endTime - log.startTime) / 60;
          const net = Math.max(0, gross - log.breakHours);
          monthlyGross += gross;
          totalPay += net * member.targetWage;
          workedDays += 1;
        }
      });

      totalLabor += totalPay;
      return { ...member, monthlyGross, totalPay, workedDays };
    });

    return {
      totalLabor,
      staffStats,
      isSaved: Boolean(monthlySnapshots[monthKey]),
    };
  }, [currentMonthLogs, monthlySnapshots, staff, targetMonth, targetYear]);

  const monthlyProfit = totalRevenue - totalExpense - monthlyStats.totalLabor;
  const laborRatio = totalRevenue > 0 ? (monthlyStats.totalLabor / totalRevenue) * 100 : 0;

  const hourlyChartData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => {
        const sales = hourlySalesProjection[hour] || 0;
        const slotsInHour = activeSlots.filter((slot) => slot >= hour * 60 && slot < (hour + 1) * 60);
        let laborCost = 0;
        let capacity = 0;

        slotsInHour.forEach((slot) => {
          SCHEDULE_DAYS.forEach((day) => {
            (schedule[day]?.[slot] || []).forEach((staffId) => {
              const member = staff.find((item) => item.id === staffId);
              if (!member) return;
              laborCost += member.targetWage * (timeUnit / 60) / 7;
              capacity += member.capacity * (timeUnit / 60) / 7;
            });
          });
        });

        return { hour, sales, laborCost, capacity };
      }),
    [activeSlots, hourlySalesProjection, schedule, staff, timeUnit],
  );

  function loadPattern(patternId: string) {
    const pattern = patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    setSelectedPatternId(patternId);
    setHourlySalesProjection({ ...pattern.data });
  }

  function saveCurrentAsPattern() {
    if (!newPatternName.trim()) {
      alert("패턴 이름을 입력해주세요.");
      return;
    }

    const next = {
      id: `custom-${Date.now()}`,
      name: newPatternName.trim(),
      data: { ...hourlySalesProjection },
    };
    setPatterns((prev) => [...prev, next]);
    setSelectedPatternId(next.id);
    setNewPatternName("");
  }

  function saveMonthlySnapshot() {
    const monthKey = `${targetYear}-${targetMonth}`;
    setMonthlySnapshots((prev) => ({
      ...prev,
      [monthKey]: {
        isSaved: true,
        staffSnapshot: JSON.parse(JSON.stringify(staff)) as Staff[],
        dailyLogs: JSON.parse(JSON.stringify(currentMonthLogs)) as Record<string, MonthlyLog>,
      },
    }));
    setManualEdits((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const [year, month] = key.split("-").map(Number);
        if (year === targetYear && month === targetMonth) delete next[key];
      });
      return next;
    });
  }

  function cancelMonthlySnapshot() {
    const monthKey = `${targetYear}-${targetMonth}`;
    setMonthlySnapshots((prev) => {
      const next = { ...prev };
      delete next[monthKey];
      return next;
    });
  }

  function startEditing(dateKey: string, log?: MonthlyLog) {
    setEditingDate(dateKey);
    if (log) {
      setEditForm({
        start: formatTime(log.startTime),
        end: formatTime(log.endTime),
        break: log.breakHours,
      });
      return;
    }
    setEditForm({ start: "11:00", end: "20:00", break: 1 });
  }

  function saveEditing() {
    if (!editingDate) return;
    const [startHour, startMinute] = editForm.start.split(":").map(Number);
    const [endHour, endMinute] = editForm.end.split(":").map(Number);
    setManualEdits((prev) => ({
      ...prev,
      [editingDate]: {
        startTime: startHour * 60 + startMinute,
        endTime: endHour * 60 + endMinute,
        breakHours: Number(editForm.break) || 0,
      },
    }));
    setEditingDate(null);
  }

  function deleteLog(dateKey: string) {
    setManualEdits((prev) => ({ ...prev, [dateKey]: "DELETE" }));
    setEditingDate(null);
  }

  function revertLog(dateKey: string) {
    setManualEdits((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
    setEditingDate(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-4 text-slate-50 md:px-6" onMouseUp={() => setDragging(false)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">Scheduler Workspace</div>
              <h1 className="mt-2 text-2xl font-bold">스케줄, 분석, 월별 근무일지를 한 화면에서 관리</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                시간 단위 전환, 밀도 높은 주간 배정표, 시간대별 효율 차트, 월별 급여 마감 흐름을 다시 묶었습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveSchedule}
                disabled={!canEdit || saving || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                <Save className="h-4 w-4" />
                {saving ? "저장 중..." : "스케줄 저장"}
              </button>
              <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                {loading ? "불러오는 중..." : saveMessage || "변경 후 저장을 눌러 현재 매장 스케줄에 반영하세요."}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="등록 직원 수" value={`${staff.length}명`} helper="직원 관리와 연동" />
          <MetricCard label="배정 슬롯" value={`${assignedSlotCount}칸`} helper={`${timeUnit}분 단위 기준`} />
          <MetricCard label="월 예상 손익" value={`${monthlyProfit.toLocaleString()}원`} helper={`인건비율 ${laborRatio.toFixed(1)}%`} />
          <MetricCard label="권한" value={canEdit ? "편집 가능" : "읽기 전용"} helper={canEdit ? "직접 수정 가능" : "조회 중심"} />
        </section>

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {[
            { id: "schedule", label: `스케줄 (${timeUnit}분)`, icon: Clock },
            { id: "analysis", label: "효율 분석", icon: PieChart },
            { id: "summary", label: "월별 근무일지", icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as TabId)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                  tab === item.id ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-700 bg-slate-900 text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "schedule" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">주간 배정표</div>
                  <div className="text-xs text-slate-400">표를 먼저 보고 바로 수정할 수 있도록 구조를 정리했습니다.</div>
                </div>
                {!canEdit ? <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">직원 계정은 읽기 전용입니다.</div> : null}
              </div>

              <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  {[20, 30, 60].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setTimeUnit(unit as 20 | 30 | 60)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${timeUnit === unit ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
                    >
                      {unit}분
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowEarlyHours((prev) => !prev)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300">
                  {showEarlyHours ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showEarlyHours ? "새벽 접기" : "새벽 펼치기"}
                </button>
                <div className="flex flex-wrap gap-2">
                  {staff.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedStaffId(member.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        selectedStaffId === member.id ? "border-emerald-500 bg-slate-800 text-white" : "border-slate-700 bg-slate-900 text-slate-300"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[700px] overflow-auto rounded-xl border border-slate-800">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-20 bg-slate-900 text-slate-300">
                    <tr>
                      <th className="w-24 border-b border-r border-slate-700 px-3 py-2 text-left">시간</th>
                      {SCHEDULE_DAYS.map((day) => (
                        <th key={day} className="min-w-[108px] border-b border-r border-slate-700 px-3 py-2 text-center">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-slate-950/50">
                    {!showEarlyHours ? (
                      <tr>
                        <td colSpan={8} className="cursor-pointer border-b border-slate-800 bg-slate-900/70 py-2 text-center text-[10px] text-slate-500" onClick={() => setShowEarlyHours(true)}>
                          새벽 시간 숨김 (눌러서 펼치기)
                        </td>
                      </tr>
                    ) : null}

                    {visibleSlots.map((slot) => {
                      const isHourStart = slot % 60 === 0;
                      const borderClass = isHourStart ? "border-t-2 border-slate-600" : "border-t border-slate-800/60";
                      return (
                        <tr key={slot} ref={slot === 660 ? row11AmRef : null}>
                          <td className={`border-r border-slate-700 bg-slate-900/60 px-3 py-1 font-mono ${isHourStart ? "font-bold text-slate-200" : "text-[10px] text-slate-500"} ${borderClass}`}>
                            {formatTime(slot)}
                          </td>
                          {SCHEDULE_DAYS.map((day) => {
                            const assignedIds = schedule[day]?.[slot] || [];
                            return (
                              <td
                                key={`${day}-${slot}`}
                                onMouseDown={() => {
                                  if (!canEdit) return;
                                  setDragging(true);
                                  handleCellToggle(day, slot);
                                }}
                                onMouseEnter={() => {
                                  if (dragging) handleCellToggle(day, slot);
                                }}
                                className={`h-9 border-r border-slate-800 px-2 py-1 hover:bg-slate-800/60 ${canEdit ? "cursor-pointer" : "cursor-default"} ${borderClass}`}
                              >
                                <div className="flex min-h-[24px] flex-wrap items-center gap-1">
                                  {assignedIds.map((staffId) => {
                                    const member = staff.find((item) => item.id === staffId);
                                    if (!member) return null;
                                    return (
                                      <span key={staffId} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: member.color }}>
                                        {member.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 text-sm font-semibold">현재 보기</div>
                <p className="text-xs leading-5 text-slate-400">
                  기본값은 오전 9시 이후만 표시합니다. 필요하면 새벽 시간도 펼쳐서 확인할 수 있습니다.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-3 text-sm font-semibold">주간 요약</div>
                <div className="grid gap-2">
                  {weeklySummary.map((item) => (
                    <div key={item.staffId} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{item.staffName}</span>
                        <span className="text-emerald-400">{item.weeklyNet.toFixed(1)}h</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        주급 {item.workPayWeekly.toLocaleString()}원 · 월 예상 {item.monthlyTotalPay.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {tab === "analysis" ? (
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <FolderOpen className="h-4 w-4 text-emerald-400" />
                  매출 패턴 불러오기
                </div>
                <div className="space-y-3">
                  <select value={selectedPatternId} onChange={(event) => loadPattern(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                    {patterns.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.name}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-2 text-xs text-slate-400">현재 패턴 저장</div>
                    <div className="flex gap-2">
                      <input value={newPatternName} onChange={(event) => setNewPatternName(event.target.value)} placeholder="예: 금요일 피크" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                      <button type="button" onClick={saveCurrentAsPattern} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4 text-emerald-400" />
                  월 손익 개요
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">총 매출</span><span className="font-semibold text-emerald-400">{totalRevenue.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">총 지출</span><span className="font-semibold text-red-400">-{totalExpense.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">예상 인건비</span><span className="font-semibold text-orange-400">-{monthlyStats.totalLabor.toLocaleString()}원</span></div>
                  <div className="border-t border-slate-800 pt-3"><div className="flex justify-between"><span className="font-semibold">예상 순이익</span><span className={monthlyProfit >= 0 ? "font-bold text-emerald-400" : "font-bold text-red-500"}>{monthlyProfit.toLocaleString()}원</span></div></div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-emerald-400" />시간대별 효율성 분석</div>
                  <p className="mt-1 text-sm text-slate-400">매출, 인건비, 처리 용량을 같은 축으로 비교합니다.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
                  <span className="text-slate-400">영업시간</span>
                  <input type="number" min="0" max="23" value={businessHours.start} onChange={(event) => setBusinessHours((prev) => ({ ...prev, start: Number(event.target.value) }))} className="w-10 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-center" />
                  <span className="text-slate-500">시 ~</span>
                  <input type="number" min="0" max="23" value={businessHours.end} onChange={(event) => setBusinessHours((prev) => ({ ...prev, end: Number(event.target.value) }))} className="w-10 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-center" />
                  <span className="text-slate-500">시</span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-400">
                <Legend color="bg-blue-500/60" label="매출" />
                <Legend color="bg-red-500/60" label="인건비" />
                <Legend color="bg-emerald-500" label="처리 용량" line />
              </div>

              <div className="flex h-72 items-end gap-1 overflow-x-auto border-b border-slate-800 pb-6">
                {hourlyChartData.map((item) => {
                  const maxValue = 600000;
                  const salesHeight = Math.min((item.sales / maxValue) * 100, 100);
                  const laborHeight = Math.min((item.laborCost / maxValue) * 100, 100);
                  const capacityHeight = Math.min((item.capacity / maxValue) * 100, 100);
                  const overload = item.sales > item.capacity && item.capacity > 0;
                  const idle = item.sales < item.capacity * 0.3 && item.laborCost > 0;
                  const inBusiness = item.hour >= businessHours.start && item.hour <= businessHours.end;

                  return (
                    <div key={item.hour} className={`group relative flex h-full min-w-[34px] flex-1 flex-col justify-end ${!inBusiness ? "opacity-35" : ""}`}>
                      <div className="mb-1 flex h-4 items-center justify-center">
                        {inBusiness && overload ? <AlertTriangle className="h-3 w-3 text-red-500" /> : null}
                        {inBusiness && !overload && idle ? <TrendingDown className="h-3 w-3 text-orange-400" /> : null}
                      </div>
                      <div className="relative flex h-full items-end gap-[2px]">
                        <div className="absolute left-0 right-0 border-t border-dashed border-emerald-500" style={{ bottom: `${capacityHeight}%` }} />
                        <div className="w-1/2 rounded-t-sm bg-blue-500/60" style={{ height: `${salesHeight}%` }} />
                        <div className="w-1/2 rounded-t-sm bg-red-500/60" style={{ height: `${laborHeight}%` }} />
                      </div>
                      <div className="mt-2 text-center text-[10px] text-slate-500">{item.hour}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-6 gap-2 md:grid-cols-12">
                {Array.from({ length: 24 }, (_, hour) => (
                  <label key={hour} className="flex flex-col gap-1">
                    <span className="text-center text-[10px] text-slate-500">{hour}시</span>
                    <input
                      type="number"
                      value={hourlySalesProjection[hour] || 0}
                      onChange={(event) => setHourlySalesProjection((prev) => ({ ...prev, [hour]: Number(event.target.value) }))}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-[11px]"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "summary" ? (
          <div className="space-y-5">
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <select value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value))} className="bg-transparent text-sm outline-none">
                    {[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}년</option>)}
                  </select>
                  <select value={targetMonth} onChange={(event) => setTargetMonth(Number(event.target.value))} className="bg-transparent text-sm outline-none">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}
                  </select>
                </div>
                {monthlyStats.isSaved ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs font-semibold text-emerald-400">
                    <Lock className="h-3 w-3" />
                    확정 저장됨
                  </div>
                ) : null}
              </div>

              {canEdit ? (
                monthlyStats.isSaved ? (
                  <button type="button" onClick={cancelMonthlySnapshot} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-red-400">
                    확정 취소
                  </button>
                ) : (
                  <button type="button" onClick={saveMonthlySnapshot} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                    이번 달 근무 확정
                  </button>
                )
              ) : null}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">직원</th>
                    <th className="px-4 py-3 text-right">근무일수</th>
                    <th className="px-4 py-3 text-right">총 근무</th>
                    <th className="px-4 py-3 text-right">총 급여</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.staffStats.map((member) => (
                    <tr key={member.id} onClick={() => setSelectedStaffId(member.id)} className={`cursor-pointer border-t border-slate-800 ${selectedStaffId === member.id ? "bg-slate-800" : "hover:bg-slate-800/50"}`}>
                      <td className="px-4 py-3 font-semibold"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />{member.name}</div></td>
                      <td className="px-4 py-3 text-right text-slate-400">{member.workedDays}일</td>
                      <td className="px-4 py-3 text-right text-slate-300">{member.monthlyGross.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-400">{member.totalPay.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-emerald-400" />
                월별 상세 근무 일지
              </div>

              <div className="grid grid-cols-7 gap-2">
                {CALENDAR_DAYS.map((day) => (
                  <div key={day} className="py-1 text-center text-xs text-slate-500">{day}</div>
                ))}

                {(() => {
                  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
                  const firstDay = new Date(targetYear, targetMonth - 1, 1).getDay();
                  const selectedMember = monthlyStats.staffStats.find((member) => member.id === selectedStaffId) ?? monthlyStats.staffStats[0];
                  const cells: ReactNode[] = [];

                  for (let index = 0; index < firstDay; index += 1) {
                    cells.push(<div key={`empty-${index}`} className="h-24 rounded-lg border border-transparent" />);
                  }

                  for (let date = 1; date <= daysInMonth; date += 1) {
                    const dateKey = `${targetYear}-${targetMonth}-${date}-${selectedMember?.id}`;
                    const log = currentMonthLogs[dateKey];
                    const isOverridden = manualEdits[dateKey] !== undefined;

                    cells.push(
                      <div
                        key={date}
                        onClick={() => {
                          if (!canEdit || monthlyStats.isSaved) return;
                          startEditing(dateKey, log);
                        }}
                        className={`flex h-24 flex-col justify-between rounded-lg border p-2 ${log ? "border-slate-700 bg-slate-800 hover:border-emerald-500" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"} ${editingDate === dateKey ? "ring-2 ring-emerald-500" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-500">{date}</div>
                          {isOverridden && !monthlyStats.isSaved ? <div className="h-2 w-2 rounded-full bg-orange-500" title="수동 수정됨" /> : null}
                        </div>
                        {log ? (
                          <>
                            <div className="text-[11px] font-semibold text-slate-200">{formatTime(log.startTime)} ~ {formatTime(log.endTime)}</div>
                            <div className="text-right text-[10px] text-orange-400">
                              {Math.round((((log.endTime - log.startTime) / 60) - log.breakHours) * (selectedMember?.targetWage || 0)).toLocaleString()}원
                            </div>
                          </>
                        ) : (
                          <div className="text-center text-[11px] text-slate-600">휴무</div>
                        )}
                      </div>,
                    );
                  }

                  return cells;
                })()}
              </div>

              {editingDate ? (
                <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <label className="grid gap-1 text-xs text-slate-500">
                    출근
                    <input type="time" value={editForm.start} onChange={(event) => setEditForm((prev) => ({ ...prev, start: event.target.value }))} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none" />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-500">
                    퇴근
                    <input type="time" value={editForm.end} onChange={(event) => setEditForm((prev) => ({ ...prev, end: event.target.value }))} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none" />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-500">
                    휴게 시간
                    <input type="number" step="0.5" value={editForm.break} onChange={(event) => setEditForm((prev) => ({ ...prev, break: event.target.value }))} className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none" />
                  </label>

                  <div className="ml-auto flex flex-wrap gap-2">
                    {manualEdits[editingDate] ? (
                      <button type="button" onClick={() => revertLog(editingDate)} className="inline-flex items-center gap-1 rounded-lg bg-blue-900/30 px-3 py-2 text-xs text-blue-400">
                        <RotateCcw className="h-3 w-3" />
                        스케줄 복구
                      </button>
                    ) : null}
                    <button type="button" onClick={() => deleteLog(editingDate)} className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">
                      휴무 처리
                    </button>
                    <button type="button" onClick={() => setEditingDate(null)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
                      취소
                    </button>
                    <button type="button" onClick={saveEditing} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                      <Check className="h-3 w-3" />
                      수정 완료
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{helper}</div>
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${color} ${line ? "h-[2px] w-4" : "h-3 w-3"} inline-block rounded-sm`} />
      {label}
    </span>
  );
}
