"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, AlertTriangle, Calendar, Check, ChevronDown, ChevronUp, Clock, FolderOpen, Lock, PieChart, RotateCcw, Save, Store, TrendingDown } from "lucide-react";
import { readApiResponse } from "@/lib/client-api";
import styles from "./wage-scheduler.module.css";

const CALENDAR_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const SCHEDULE_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const TODAY = new Date();
const COLOR_FALLBACKS: Record<string, string> = { "bg-red-500": "#ef4444", "bg-orange-500": "#f97316", "bg-amber-500": "#f59e0b", "bg-yellow-500": "#eab308", "bg-lime-500": "#84cc16", "bg-green-500": "#22c55e", "bg-emerald-500": "#10b981", "bg-teal-500": "#14b8a6", "bg-cyan-500": "#06b6d4", "bg-sky-500": "#0ea5e9", "bg-blue-500": "#3b82f6", "bg-indigo-500": "#6366f1", "bg-violet-500": "#8b5cf6", "bg-purple-500": "#a855f7", "bg-fuchsia-500": "#d946ef", "bg-pink-500": "#ec4899", "bg-rose-500": "#f43f5e" };

type TabId = "schedule" | "analysis" | "summary";
type ScheduleShape = Record<string, Record<number, string[]>>;
type Pattern = { id: string; name: string; data: Record<number, number> };
type SeasonProfile = {
  id: string;
  name: string;
  dayTypes: Record<string, "NORMAL" | "PEAK">;
  normalHourlyProjection: Record<number, number>;
  peakHourlyProjection: Record<number, number>;
};
type MonthlyLog = { startTime: number; endTime: number; breakHours: number };
type Snapshot = { isSaved: boolean; staffSnapshot: Staff[]; dailyLogs: Record<string, MonthlyLog> };
type Staff = { id: string; name: string; color: string; baseWage: number; targetWage: number; holidayWage: number; bonusWage: number; capacity: number; incentive: number; expectedSales?: number; performanceBonus?: number; mealAllowance?: number; transportAllowance?: number; otherAllowance?: number; employmentType?: "HOURLY" | "MONTHLY"; monthlySalary?: number; expectedMonthlyHours?: number; insuranceType?: "NONE" | "FREELANCER" | "FOUR_INSURANCE"; insuranceRate?: number };
type FinanceItem = { id: string; type: "REVENUE" | "EXPENSE"; category: string; amount: number; memo?: string | null };
type EditForm = { start: string; end: string; break: number | string };

const DEFAULT_PATTERNS: Pattern[] = [
  { id: "p1", name: "평일 (학기중)", data: createHourlyPattern(300000, 400000, 100000, 11, 13, 18, 20, 9, 22) },
  { id: "p2", name: "금요일/주말 (피크)", data: createHourlyPattern(500000, 800000, 200000, 11, 13, 17, 22, 9, 23) },
  { id: "p3", name: "방학 기간 (비수기)", data: createHourlyPattern(200000, 250000, 80000, 11, 13, 18, 20, 10, 21) },
];

const DEFAULT_SEASON_PROFILES: SeasonProfile[] = [
  {
    id: "semester",
    name: "학기중",
    dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
    normalHourlyProjection: { ...DEFAULT_PATTERNS[0].data },
    peakHourlyProjection: { ...DEFAULT_PATTERNS[1].data },
  },
  {
    id: "vacation",
    name: "방학기간",
    dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
    normalHourlyProjection: { ...DEFAULT_PATTERNS[2].data },
    peakHourlyProjection: { ...DEFAULT_PATTERNS[1].data },
  },
];

function createHourlyPattern(lunch: number, dinner: number, normal: number, lunchStart: number, lunchEnd: number, dinnerStart: number, dinnerEnd: number, open: number, close: number) {
  return Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, hour >= lunchStart && hour <= lunchEnd ? lunch : hour >= dinnerStart && hour <= dinnerEnd ? dinner : hour >= open && hour <= close ? normal : 0])) as Record<number, number>;
}
function createInitialSchedule(): ScheduleShape { return Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, {} as Record<number, string[]>])); }
function mergeSchedule(raw?: ScheduleShape | null) { const base = createInitialSchedule(); if (!raw) return base; SCHEDULE_DAYS.forEach((day) => { base[day] = raw[day] ?? {}; }); return base; }
function formatTime(minutes: number | null | undefined) { if (minutes === null || minutes === undefined) return "--:--"; const hour = Math.floor(minutes / 60); const minute = minutes % 60; return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`; }
function calcBreakHours(grossHours: number) { if (grossHours > 8) return 1; if (grossHours > 4) return 0.5; return 0; }
function sum(values: number[]) { return values.reduce((acc, value) => acc + (Number(value) || 0), 0); }
function resolveColor(color: string | undefined) { if (!color) return "#10b981"; if (color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl")) return color; return COLOR_FALLBACKS[color] ?? "#38bdf8"; }
function buildSeasonAverageProjection(profile: SeasonProfile) {
  const normalDays = SCHEDULE_DAYS.filter((day) => profile.dayTypes[day] !== "PEAK").length;
  const peakDays = SCHEDULE_DAYS.filter((day) => profile.dayTypes[day] === "PEAK").length;
  return Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => {
      const total = (profile.normalHourlyProjection[hour] || 0) * normalDays + (profile.peakHourlyProjection[hour] || 0) * peakDays;
      return [hour, Math.round(total / 7)];
    }),
  ) as Record<number, number>;
}
function buildWeeklyStaffSummary(staffList: Staff[], schedule: ScheduleShape, timeUnit: number, activeSlots: number[]) {
  const hourRatio = timeUnit / 60;
  return staffList.map((member) => {
    const weeklyNet = sum(SCHEDULE_DAYS.map((day) => { const slots = activeSlots.filter((slot) => schedule?.[day]?.[slot]?.includes(member.id)); const gross = slots.length * hourRatio; return Math.max(0, gross - calcBreakHours(gross)); }));
    const workPayWeekly = Math.round(sum(SCHEDULE_DAYS.map((day) => { const slots = activeSlots.filter((slot) => schedule?.[day]?.[slot]?.includes(member.id)); return slots.length * (member.baseWage + member.bonusWage) * hourRatio; })));
    const holidayAllowanceAmount = Math.round((weeklyNet >= 15 ? (weeklyNet / 40) * 8 : 0) * member.baseWage);
    return { staffId: member.id, staffName: member.name, weeklyNet, workPayWeekly, monthlyTotalPay: (workPayWeekly + holidayAllowanceAmount) * 4 + member.incentive };
  });
}

export function WageScheduler({ staff, financeItems, canEdit }: { staff: Staff[]; financeItems: FinanceItem[]; canEdit: boolean }) {
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
  const [seasonProfiles, setSeasonProfiles] = useState<SeasonProfile[]>(DEFAULT_SEASON_PROFILES);
  const [activeSeasonProfileId, setActiveSeasonProfileId] = useState(DEFAULT_SEASON_PROFILES[0].id);
  const [hourlySalesProjection, setHourlySalesProjection] = useState<Record<number, number>>({ ...DEFAULT_PATTERNS[0].data });
  const [targetYear, setTargetYear] = useState(TODAY.getFullYear());
  const [targetMonth, setTargetMonth] = useState(TODAY.getMonth() + 1);
  const [monthlySnapshots, setMonthlySnapshots] = useState<Record<string, Snapshot>>({});
  const [manualEdits, setManualEdits] = useState<Record<string, MonthlyLog | "DELETE">>({});
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ start: "", end: "", break: 0 });
  const row11AmRef = useRef<HTMLTableRowElement | null>(null);

  const activeSlots = useMemo(() => Array.from({ length: (24 * 60) / timeUnit }, (_, index) => index * timeUnit), [timeUnit]);
  const visibleSlots = useMemo(() => activeSlots.filter((slot) => (showEarlyHours ? true : slot >= 540)), [activeSlots, showEarlyHours]);
  const selectedStaff = useMemo(() => staff.find((member) => member.id === selectedStaffId) ?? staff[0] ?? null, [selectedStaffId, staff]);
  const weeklySummary = useMemo(() => buildWeeklyStaffSummary(staff, schedule, timeUnit, activeSlots), [staff, schedule, timeUnit, activeSlots]);
  const activeSeasonProfile = useMemo(
    () => seasonProfiles.find((profile) => profile.id === activeSeasonProfileId) ?? seasonProfiles[0] ?? null,
    [activeSeasonProfileId, seasonProfiles],
  );
  const totalRevenue = useMemo(() => sum(financeItems.filter((item) => item.type === "REVENUE").map((item) => item.amount)), [financeItems]);
  const totalExpense = useMemo(() => sum(financeItems.filter((item) => item.type === "EXPENSE").map((item) => item.amount)), [financeItems]);
  const assignedSlotCount = useMemo(() => Object.values(schedule).reduce((acc, slots) => acc + Object.values(slots).filter((ids) => ids.length > 0).length, 0), [schedule]);

  useEffect(() => {
    if (!staff.length) { setSelectedStaffId(""); return; }
    if (!selectedStaffId || !staff.some((member) => member.id === selectedStaffId)) setSelectedStaffId(staff[0].id);
  }, [selectedStaffId, staff]);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response = await fetch("/api/schedule");
        const { data, message } = await readApiResponse<{ schedule?: {
          assignments: ScheduleShape;
          timeUnit: number;
          seasonProfiles?: SeasonProfile[];
          activeSeasonProfileId?: string | null;
          hourlySalesProjection?: Record<number, number>;
        }; message?: string }>(response);
        if (data?.schedule) {
          setSchedule(mergeSchedule(data.schedule.assignments));
          const nextTimeUnit = data.schedule.timeUnit === 30 || data.schedule.timeUnit === 60 ? data.schedule.timeUnit : 20;
          setTimeUnit(nextTimeUnit);
          const loadedSeasonProfiles =
            Array.isArray(data.schedule.seasonProfiles) && data.schedule.seasonProfiles.length > 0
              ? data.schedule.seasonProfiles
              : DEFAULT_SEASON_PROFILES;
          const loadedSeasonId =
            data.schedule.activeSeasonProfileId ??
            loadedSeasonProfiles[0]?.id ??
            DEFAULT_SEASON_PROFILES[0].id;
          setSeasonProfiles(loadedSeasonProfiles);
          setActiveSeasonProfileId(loadedSeasonId);
          const activeProfile = loadedSeasonProfiles.find((profile: SeasonProfile) => profile.id === loadedSeasonId) ?? loadedSeasonProfiles[0];
          setHourlySalesProjection(activeProfile ? buildSeasonAverageProjection(activeProfile) : { ...DEFAULT_PATTERNS[0].data, ...(data.schedule.hourlySalesProjection ?? {}) });
        } else {
          setSchedule(createInitialSchedule());
          if (message) {
            setSaveMessage(message);
          }
        }
      } catch {
        setSaveMessage("스케줄을 불러오지 못했습니다. 현재 화면 기준으로 새로 작성할 수 있습니다.");
      } finally {
        setLoading(false);
      }
    }
    void loadSchedule();
  }, []);

  useEffect(() => {
    if (tab === "schedule" && row11AmRef.current) row11AmRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tab, timeUnit, showEarlyHours]);

  function handleCellToggle(day: string, slot: number) {
    if (!canEdit || !selectedStaff) return;
    setSchedule((prev) => {
      const daySlots = prev[day] || {};
      const currentIds = daySlots[slot] || [];
      const nextIds = currentIds.includes(selectedStaff.id) ? currentIds.filter((id) => id !== selectedStaff.id) : [...currentIds, selectedStaff.id];
      return { ...prev, [day]: { ...daySlots, [slot]: nextIds } };
    });
  }

  async function saveSchedule() {
    if (!canEdit) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeUnit, hourlySalesProjection, assignments: schedule, seasonProfiles, activeSeasonProfileId }) });
      const { message } = await readApiResponse<{ message?: string }>(response);
      setSaveMessage(response.ok ? "스케줄이 저장되었습니다." : message ?? "스케줄 저장에 실패했습니다.");
    } catch {
      setSaveMessage("스케줄 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

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
    const nextPattern = { id: `custom-${Date.now()}`, name: newPatternName.trim(), data: { ...hourlySalesProjection } };
    setPatterns((prev) => [...prev, nextPattern]);
    setSelectedPatternId(nextPattern.id);
    setNewPatternName("");
  }

  function deletePattern(patternId: string) {
    setPatterns((prev) => prev.filter((item) => item.id !== patternId));
    if (selectedPatternId === patternId) {
      setSelectedPatternId(DEFAULT_PATTERNS[0].id);
      setHourlySalesProjection({ ...DEFAULT_PATTERNS[0].data });
    }
  }

  function selectSeasonProfile(profileId: string) {
    const profile = seasonProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    setActiveSeasonProfileId(profileId);
    setHourlySalesProjection(buildSeasonAverageProjection(profile));
  }

  function addSeasonProfile() {
    const nextProfile: SeasonProfile = {
      id: `season-${Date.now()}`,
      name: `새 시즌 ${seasonProfiles.length + 1}`,
      dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
      normalHourlyProjection: { ...(activeSeasonProfile?.normalHourlyProjection ?? DEFAULT_PATTERNS[0].data) },
      peakHourlyProjection: { ...(activeSeasonProfile?.peakHourlyProjection ?? DEFAULT_PATTERNS[1].data) },
    };
    setSeasonProfiles((prev) => [...prev, nextProfile]);
    setActiveSeasonProfileId(nextProfile.id);
    setHourlySalesProjection(buildSeasonAverageProjection(nextProfile));
  }

  function updateSeasonProfile(patch: Partial<SeasonProfile>) {
    if (!activeSeasonProfile) return;
    const nextProfiles = seasonProfiles.map((profile) => {
      if (profile.id !== activeSeasonProfile.id) return profile;
      return { ...profile, ...patch };
    });
    setSeasonProfiles(nextProfiles);
    const nextActive = nextProfiles.find((profile) => profile.id === activeSeasonProfile.id);
    if (nextActive) setHourlySalesProjection(buildSeasonAverageProjection(nextActive));
  }

  function updateSeasonDay(day: string) {
    if (!activeSeasonProfile) return;
    const current = activeSeasonProfile.dayTypes[day] === "PEAK" ? "PEAK" : "NORMAL";
    updateSeasonProfile({
      dayTypes: {
        ...activeSeasonProfile.dayTypes,
        [day]: current === "PEAK" ? "NORMAL" : "PEAK",
      },
    });
  }

  function updateSeasonHourly(kind: "normalHourlyProjection" | "peakHourlyProjection", hour: number, value: number) {
    if (!activeSeasonProfile) return;
    updateSeasonProfile({
      [kind]: {
        ...activeSeasonProfile[kind],
        [hour]: value,
      },
    });
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
          logs[dateKey] = { startTime, endTime, breakHours: calcBreakHours((endTime - startTime) / 60) };
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
      if (year === targetYear && month === targetMonth) value === "DELETE" ? delete merged[key] : (merged[key] = value);
    });
    return merged;
  }, [activeSlots, manualEdits, monthlySnapshots, schedule, staff, targetMonth, targetYear, timeUnit]);

  const monthlyStats = useMemo(() => {
    const monthKey = `${targetYear}-${targetMonth}`;
    const sourceStaff = monthlySnapshots[monthKey]?.staffSnapshot ?? staff;
    let totalLabor = 0;
    const staffStats = sourceStaff.map((member) => {
      let monthlyGross = 0;
      let workedDays = 0;
      let totalPay = member.incentive;
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
    return { totalLabor, staffStats, isSaved: Boolean(monthlySnapshots[monthKey]) };
  }, [currentMonthLogs, monthlySnapshots, staff, targetMonth, targetYear]);

  const selectedMonthlyStaff = monthlyStats.staffStats.find((member) => member.id === selectedStaffId) ?? monthlyStats.staffStats[0] ?? null;
  const monthlyProfit = totalRevenue - totalExpense - monthlyStats.totalLabor;
  const laborRatio = totalRevenue > 0 ? (monthlyStats.totalLabor / totalRevenue) * 100 : 0;

  const hourlyChartData = useMemo(() => Array.from({ length: 24 }, (_, hour) => {
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
          capacity += (member.expectedSales ?? member.capacity) * (timeUnit / 60) / 7;
        });
      });
    });
    return { hour, sales, laborCost, capacity };
  }), [activeSlots, hourlySalesProjection, schedule, staff, timeUnit]);

  const chartMax = useMemo(() => Math.max(600000, ...hourlyChartData.flatMap((item) => [item.sales, item.laborCost, item.capacity])), [hourlyChartData]);

  function saveMonthlySnapshot() {
    const monthKey = `${targetYear}-${targetMonth}`;
    setMonthlySnapshots((prev) => ({ ...prev, [monthKey]: { isSaved: true, staffSnapshot: JSON.parse(JSON.stringify(staff)) as Staff[], dailyLogs: JSON.parse(JSON.stringify(currentMonthLogs)) as Record<string, MonthlyLog> } }));
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
    if (log) setEditForm({ start: formatTime(log.startTime), end: formatTime(log.endTime), break: log.breakHours });
    else setEditForm({ start: "11:00", end: "20:00", break: 1 });
  }

  function saveEditing() {
    if (!editingDate) return;
    const [sh, sm] = editForm.start.split(":").map(Number);
    const [eh, em] = editForm.end.split(":").map(Number);
    setManualEdits((prev) => ({ ...prev, [editingDate]: { startTime: sh * 60 + sm, endTime: eh * 60 + em, breakHours: Number(editForm.break) || 0 } }));
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
    <main className={styles.page} onMouseUp={() => setDragging(false)}>
      <div className={styles.container}>
        <section className={styles.panel}>
          <div className={styles.hero}>
            <div>
              <div className={styles.eyebrow}>Scheduler Workspace</div>
              <h1 className={styles.heroTitle}>스케줄, 분석, 월별 근무일지를 한 화면에서 관리</h1>
              <p className={styles.heroText}>표가 먼저 보이도록 배치를 다시 정리했고, 20분·30분·1시간 전환에 따라 주간 표와 월별 달력이 함께 계산되게 복구했습니다.</p>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={saveSchedule} disabled={!canEdit || saving || loading} className={styles.primaryButton}><Save size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{saving ? "저장 중..." : "스케줄 저장"}</button>
              <div className={styles.saveStatus}>{loading ? "저장된 스케줄을 불러오는 중입니다." : saveMessage || "변경 후 저장을 누르면 현재 매장 스케줄에 반영됩니다."}</div>
            </div>
          </div>
        </section>
        <section className={styles.metrics}>
          <MetricCard label="등록 직원 수" value={`${staff.length}명`} helper="직원 관리와 연동" />
          <MetricCard label="배정 슬롯" value={`${assignedSlotCount}칸`} helper={`${timeUnit}분 단위 기준`} />
          <MetricCard label="월 예상 손익" value={`${monthlyProfit.toLocaleString()}원`} helper={`인건비율 ${laborRatio.toFixed(1)}%`} />
          <MetricCard label="권한" value={canEdit ? "직접 수정 가능" : "읽기 전용"} helper={canEdit ? "드래그 배정 사용 가능" : "조회만 가능"} />
        </section>
        <div className={styles.tabRow}>
          {[
            { id: "schedule", label: `스케줄 (${timeUnit}분)`, icon: Clock },
            { id: "summary", label: "월별 근무일지", icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => setTab(item.id as TabId)} className={`${styles.tabButton} ${tab === item.id ? styles.tabActive : ""}`}><Icon size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{item.label}</button>;
          })}
        </div>
        {tab === "schedule" ? (
          <div className={styles.scheduleLayout}>
            <section className={`${styles.panel} ${styles.scheduleSurface}`}>
              <div className={styles.toolbar}>
                <div>
                  <h2 className={styles.toolbarTitle}>주간 배정표</h2>
                  <p className={styles.toolbarText}>스케줄 표를 먼저 보고 바로 수정할 수 있도록 공간을 압축했습니다.</p>
                </div>
                {!canEdit ? <div className={styles.saveStatus}>직원 계정은 읽기 전용입니다.</div> : null}
              </div>
              {!staff.length ? (
                <div className={styles.emptyState}>직원 관리에서 직원을 먼저 등록하면 여기서 바로 스케줄을 배정할 수 있습니다.</div>
              ) : (
                <>
                  <div className={styles.controlBlock}>
                    <div className={styles.controlTitle}>시간 단위</div>
                    <div className={styles.chipRow}>
                      {[20, 30, 60].map((unit) => <button key={unit} type="button" onClick={() => setTimeUnit(unit as 20 | 30 | 60)} className={`${styles.chipButton} ${timeUnit === unit ? styles.chipActive : ""}`}>{unit}분</button>)}
                      <button type="button" onClick={() => setShowEarlyHours((prev) => !prev)} className={styles.chipButton}>{showEarlyHours ? <ChevronUp size={15} style={{ verticalAlign: "middle", marginRight: 4 }} /> : <ChevronDown size={15} style={{ verticalAlign: "middle", marginRight: 4 }} />}{showEarlyHours ? "새벽 접기" : "새벽 펼치기"}</button>
                    </div>
                  </div>
                  <div className={styles.controlBlock}>
                    <div className={styles.controlTitle}>배정할 직원 선택</div>
                    <div className={styles.chipRow}>
                      {staff.map((member) => <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className={`${styles.chipButton} ${selectedStaffId === member.id ? styles.chipActive : ""}`}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: resolveColor(member.color), marginRight: 8 }} />{member.name}</button>)}
                    </div>
                  </div>
                  <div className={styles.hintRow}><span>현재 선택: <strong>{selectedStaff?.name ?? "없음"}</strong></span><span>{showEarlyHours ? "00:00부터 전체 표시" : "09:00 이후만 표시 중"}</span></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th className={styles.timeCell}>시간</th>{SCHEDULE_DAYS.map((day) => <th key={day}>{day}</th>)}</tr></thead>
                      <tbody>
                        {!showEarlyHours ? <tr><td colSpan={8} style={{ color: "#94a3b8", padding: 12, background: "#0b1220" }}>새벽 시간은 숨김 상태입니다. 필요하면 위에서 펼치기를 눌러 확인하세요.</td></tr> : null}
                        {visibleSlots.map((slot) => {
                          const isHourStart = slot % 60 === 0;
                          const is11Am = slot === 660;
                          return (
                            <tr key={slot} ref={is11Am ? row11AmRef : null}>
                              <td className={`${styles.timeCell} ${isHourStart ? styles.hourStart : ""}`} style={is11Am ? { background: "#062424", color: "#a7f3d0" } : undefined}>{formatTime(slot)}</td>
                              {SCHEDULE_DAYS.map((day) => {
                                const ids = schedule[day]?.[slot] || [];
                                return (
                                  <td key={`${day}-${slot}`} className={`${styles.slotCell} ${!canEdit ? styles.slotCellReadonly : ""} ${isHourStart ? styles.hourStart : ""}`} onMouseDown={() => { if (!canEdit) return; setDragging(true); handleCellToggle(day, slot); }} onMouseEnter={() => { if (!dragging || !canEdit) return; handleCellToggle(day, slot); }}>
                                    <div className={styles.slotStack}>{ids.map((id) => { const member = staff.find((item) => item.id === id); return member ? <span key={id} className={styles.slotBadge} style={{ background: resolveColor(member.color) }}>{member.name}</span> : null; })}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
            <aside className={styles.controlPanel}>
              <section className={styles.panel}><div className={styles.controlTitle}>현재 보기</div><p className={styles.controlText}>시간 단위를 바꾸면 표, 주간 근무시간, 월별 달력 로그가 함께 다시 계산됩니다.</p></section>
              <section className={styles.panel}><div className={styles.controlTitle}>주간 요약</div><div style={{ display: "grid", gap: 10 }}>{weeklySummary.map((item) => <div key={item.staffId} className={styles.weeklyCard}><div className={styles.weeklyNameRow}><span>{item.staffName}</span><span style={{ color: "#34d399" }}>{item.weeklyNet.toFixed(1)}h</span></div><div style={{ color: "#94a3b8", fontSize: 13 }}>주급 {item.workPayWeekly.toLocaleString()}원</div><div style={{ color: "#64748b", fontSize: 12 }}>월 예상 {item.monthlyTotalPay.toLocaleString()}원</div></div>)}</div></section>
              <section className={styles.panel}><div className={styles.controlTitle}>배정 안내</div><p className={styles.controlText}>{canEdit ? "직원을 먼저 선택한 뒤 칸을 클릭하거나 드래그해서 배정할 수 있습니다." : "이 계정은 조회 전용입니다. 관리자 계정으로 로그인하면 직접 수정할 수 있습니다."}</p></section>
            </aside>
          </div>
        ) : null}

        {tab === "analysis" ? (
          <div className={styles.analysisLayout}>
            <section style={{ display: "grid", gap: 16 }}>
              <div className={styles.panel}>
                <div className={styles.toolbarTitle} style={{ fontSize: 18 }}><FolderOpen size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />시즌별 매출 패턴 설정</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div className={styles.chipRow}>
                    <select value={activeSeasonProfileId} onChange={(event) => selectSeasonProfile(event.target.value)} className={styles.select}>{seasonProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
                    <button type="button" onClick={addSeasonProfile} className={styles.secondaryButton}>시즌 추가</button>
                  </div>
                  {activeSeasonProfile ? (
                    <>
                      <input value={activeSeasonProfile.name} onChange={(event) => updateSeasonProfile({ name: event.target.value })} className={styles.field} placeholder="예: 학기중, 방학기간" />
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>요일 그룹 설정</div>
                        <div className={styles.chipRow}>
                          {SCHEDULE_DAYS.map((day) => <button key={day} type="button" onClick={() => updateSeasonDay(day)} className={`${styles.chipButton} ${activeSeasonProfile.dayTypes[day] === "PEAK" ? styles.chipActive : ""}`}>{day} · {activeSeasonProfile.dayTypes[day] === "PEAK" ? "피크" : "일반"}</button>)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>일반일 시간대 매출</div>
                        <div className={styles.analysisInputs}>{Array.from({ length: 24 }, (_, hour) => <label key={`normal-${hour}`} style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span><input type="number" value={activeSeasonProfile.normalHourlyProjection[hour] || 0} onChange={(event) => updateSeasonHourly("normalHourlyProjection", hour, Number(event.target.value))} className={styles.field} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12 }} /></label>)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>피크일 시간대 매출</div>
                        <div className={styles.analysisInputs}>{Array.from({ length: 24 }, (_, hour) => <label key={`peak-${hour}`} style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span><input type="number" value={activeSeasonProfile.peakHourlyProjection[hour] || 0} onChange={(event) => updateSeasonHourly("peakHourlyProjection", hour, Number(event.target.value))} className={styles.field} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12 }} /></label>)}</div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={styles.panel}><div className={styles.toolbarTitle} style={{ fontSize: 18 }}><Store size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />월 손익 요약</div><div style={{ display: "grid", gap: 12, fontSize: 15 }}><SummaryRow label="총 매출" value={`${totalRevenue.toLocaleString()}원`} color="#34d399" /><SummaryRow label="총 지출" value={`-${totalExpense.toLocaleString()}원`} color="#f87171" /><SummaryRow label="예상 인건비" value={`-${monthlyStats.totalLabor.toLocaleString()}원`} color="#fb923c" /><SummaryRow label="예상 순이익" value={`${monthlyProfit.toLocaleString()}원`} color={monthlyProfit >= 0 ? "#34d399" : "#f87171"} strong /></div></div>
            </section>
            <section className={styles.panel}>
              <div className={styles.toolbar}>
                <div><h2 className={styles.toolbarTitle}><Activity size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />시간대별 효율성 분석</h2><p className={styles.toolbarText}>매출, 인건비, 직원 처리 용량을 같은 축에서 비교합니다.</p></div>
                <div className={styles.chipRow}>
                  <label style={{ color: "#94a3b8", fontSize: 13 }}>영업 시작<input type="number" min="0" max="23" value={businessHours.start} onChange={(event) => setBusinessHours((prev) => ({ ...prev, start: Number(event.target.value) }))} className={styles.timeInput} style={{ width: 76, marginLeft: 8 }} /></label>
                  <label style={{ color: "#94a3b8", fontSize: 13 }}>영업 종료<input type="number" min="0" max="23" value={businessHours.end} onChange={(event) => setBusinessHours((prev) => ({ ...prev, end: Number(event.target.value) }))} className={styles.timeInput} style={{ width: 76, marginLeft: 8 }} /></label>
                </div>
              </div>
              <div className={styles.hintRow}><div className={styles.chipRow}><Legend color="#3b82f6" label="매출" /><Legend color="#ef4444" label="인건비" /><Legend color="#10b981" label="직원 기대매출" line /></div><span>현재 시간 단위 {timeUnit}분</span></div>
              <div className={styles.analysisChart}>
                {hourlyChartData.map((item) => {
                  const salesHeight = Math.min((item.sales / chartMax) * 100, 100);
                  const laborHeight = Math.min((item.laborCost / chartMax) * 100, 100);
                  const capacityHeight = Math.min((item.capacity / chartMax) * 100, 100);
                  const overload = item.sales > item.capacity && item.capacity > 0;
                  const idle = item.sales < item.capacity * 0.3 && item.laborCost > 0;
                  const inBusiness = item.hour >= businessHours.start && item.hour <= businessHours.end;
                  return <div key={item.hour} className={styles.chartHour} style={{ opacity: inBusiness ? 1 : 0.34 }} title={`매출 ${item.sales.toLocaleString()}원 / 인건비 ${Math.round(item.laborCost).toLocaleString()}원 / 직원 기대매출 ${Math.round(item.capacity).toLocaleString()}원`}><div style={{ minHeight: 18 }}>{inBusiness && overload ? <AlertTriangle size={14} color="#ef4444" /> : null}{inBusiness && !overload && idle ? <TrendingDown size={14} color="#fb923c" /> : null}</div><div className={styles.barWrap}><div className={styles.capacityLine} style={{ bottom: `${capacityHeight}%` }} /><div className={styles.bar} style={{ height: `${salesHeight}%`, background: "#3b82f6" }} /><div className={styles.bar} style={{ height: `${laborHeight}%`, background: "#ef4444" }} /></div><div style={{ fontSize: 11, color: "#94a3b8" }}>{item.hour}시</div></div>;
                })}
              </div>
              <div style={{ marginBottom: 10, color: "#94a3b8", fontSize: 13 }}>현재 시즌 평균 시간대 매출</div>
              <div className={styles.analysisInputs}>{Array.from({ length: 24 }, (_, hour) => <label key={hour} style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span><input type="number" value={hourlySalesProjection[hour] || 0} readOnly className={styles.field} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, opacity: 0.72 }} /></label>)}</div>
            </section>
          </div>
        ) : null}
        {tab === "summary" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section className={styles.panel}>
              <div className={styles.toolbar}>
                <div className={styles.chipRow}>
                  <label style={{ color: "#94a3b8", fontSize: 13 }}>연도<select value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value))} className={styles.select} style={{ width: 110, marginLeft: 8 }}>{[TODAY.getFullYear() - 1, TODAY.getFullYear(), TODAY.getFullYear() + 1].map((year) => <option key={year} value={year}>{year}년</option>)}</select></label>
                  <label style={{ color: "#94a3b8", fontSize: 13 }}>월<select value={targetMonth} onChange={(event) => setTargetMonth(Number(event.target.value))} className={styles.select} style={{ width: 92, marginLeft: 8 }}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}</select></label>
                </div>
                <div className={styles.actions}>{monthlyStats.isSaved ? <div className={styles.lockedBadge}><Lock size={14} />확정 저장됨</div> : null}{canEdit ? monthlyStats.isSaved ? <button type="button" onClick={cancelMonthlySnapshot} className={styles.secondaryButton}>확정 취소</button> : <button type="button" onClick={saveMonthlySnapshot} className={styles.primaryButton}>이번 달 근무 확정</button> : null}</div>
              </div>
            </section>
            <section className={styles.summaryTableWrap}>
              <table className={styles.summaryTable}>
                <thead><tr><th>직원</th><th style={{ textAlign: "right" }}>근무일수</th><th style={{ textAlign: "right" }}>총 근무시간</th><th style={{ textAlign: "right" }}>총 급여</th></tr></thead>
                <tbody>{monthlyStats.staffStats.map((member) => <tr key={member.id} onClick={() => setSelectedStaffId(member.id)} className={`${styles.summaryTableRow} ${selectedStaffId === member.id ? styles.summaryTableActive : ""}`}><td><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: resolveColor(member.color) }} />{member.name}</div></td><td style={{ textAlign: "right", color: "#94a3b8" }}>{member.workedDays}일</td><td style={{ textAlign: "right" }}>{member.monthlyGross.toFixed(1)}h</td><td style={{ textAlign: "right", color: "#fb923c", fontWeight: 700 }}>{member.totalPay.toLocaleString()}원</td></tr>)}</tbody>
              </table>
            </section>
            <section className={styles.panel}>
              <div className={styles.toolbar}>
                <div><h2 className={styles.toolbarTitle}><Calendar size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />월별 상세 근무 일지</h2><p className={styles.toolbarText}>현재 선택 직원: <strong>{selectedMonthlyStaff?.name ?? "없음"}</strong></p></div>
                <div className={styles.dayChipRow}>{monthlyStats.staffStats.map((member) => <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className={`${styles.dayChip} ${selectedStaffId === member.id ? styles.dayChipActive : ""}`}>{member.name}</button>)}</div>
              </div>
              <div className={styles.calendarGrid}>
                {CALENDAR_DAYS.map((day) => <div key={day} className={styles.calendarHead}>{day}</div>)}
                {(() => {
                  const cells: ReactNode[] = [];
                  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
                  const firstDay = new Date(targetYear, targetMonth - 1, 1).getDay();
                  for (let index = 0; index < firstDay; index += 1) cells.push(<div key={`empty-${index}`} className={styles.calendarEmpty} />);
                  for (let date = 1; date <= daysInMonth; date += 1) {
                    const dateKey = `${targetYear}-${targetMonth}-${date}-${selectedMonthlyStaff?.id ?? ""}`;
                    const log = selectedMonthlyStaff ? currentMonthLogs[dateKey] : undefined;
                    const isOverridden = manualEdits[dateKey] !== undefined;
                    cells.push(<div key={date} onClick={() => { if (!selectedMonthlyStaff || !canEdit || monthlyStats.isSaved) return; startEditing(dateKey, log); }} className={`${styles.calendarCell} ${editingDate === dateKey ? styles.calendarCellActive : ""}`}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: "#94a3b8" }}>{date}</span>{isOverridden && !monthlyStats.isSaved ? <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fb923c" }} /> : null}</div>{log ? <><div style={{ fontSize: 13, fontWeight: 700 }}>{formatTime(log.startTime)} ~ {formatTime(log.endTime)}</div><div style={{ fontSize: 12, color: "#fb923c", textAlign: "right" }}>{Math.round((((log.endTime - log.startTime) / 60) - log.breakHours) * (selectedMonthlyStaff?.targetWage ?? 0)).toLocaleString()}원</div></> : <div style={{ marginTop: "auto", fontSize: 12, color: "#475569" }}>휴무</div>}</div>);
                  }
                  return cells;
                })()}
              </div>
              {editingDate ? <div className={`${styles.controlBlock} ${styles.editPanel}`} style={{ marginTop: 16 }}><label style={{ display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 }}>출근<input type="time" value={editForm.start} onChange={(event) => setEditForm((prev) => ({ ...prev, start: event.target.value }))} className={styles.timeInput} /></label><label style={{ display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 }}>퇴근<input type="time" value={editForm.end} onChange={(event) => setEditForm((prev) => ({ ...prev, end: event.target.value }))} className={styles.timeInput} /></label><label style={{ display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 }}>휴게 시간<input type="number" step="0.5" value={editForm.break} onChange={(event) => setEditForm((prev) => ({ ...prev, break: event.target.value }))} className={styles.timeInput} /></label><div className={styles.actions} style={{ marginLeft: "auto" }}>{manualEdits[editingDate] ? <button type="button" onClick={() => revertLog(editingDate)} className={styles.secondaryButton}><RotateCcw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />스케줄 복구</button> : null}<button type="button" onClick={() => deleteLog(editingDate)} className={styles.dangerButton}>휴무 처리</button><button type="button" onClick={() => setEditingDate(null)} className={styles.ghostButton}>취소</button><button type="button" onClick={saveEditing} className={styles.primaryButton}><Check size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />수정 완료</button></div></div> : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className={styles.metricCard}><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{value}</div><div className={styles.metricHelper}>{helper}</div></div>;
}
function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  const swatchStyle: CSSProperties = line ? { width: 18, height: 2, borderRadius: 999, background: color } : { width: 12, height: 12, borderRadius: 4, background: color };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}><span style={swatchStyle} />{label}</span>;
}
function SummaryRow({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontWeight: strong ? 800 : 600 }}><span style={{ color: strong ? "#e2e8f0" : "#94a3b8" }}>{label}</span><span style={{ color }}>{value}</span></div>;
}

export default WageScheduler;
