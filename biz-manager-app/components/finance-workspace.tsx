"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { DollarSign, PencilLine, Receipt, Save, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { patchWorkspaceCache, readWorkspaceCache } from "@/lib/browser-cache";
import { readApiResponse } from "@/lib/client-api";
import { entryAmount, getScheduleAssignments, getStoreMonthInsights } from "@/lib/store-insights";
import type { SystemRole } from "@/types/domain";

type FinanceItem = {
  id: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  memo: string | null;
  targetDate: string;
  inputMode: "AMOUNT" | "RATIO";
  ratioPercent: number | null;
};

type StaffMember = {
  id: string;
  name: string;
  color: string;
  targetWage: number;
  expectedSales: number;
  capacity: number;
  performanceBonus: number;
  incentive: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  employmentType: "HOURLY" | "MONTHLY";
  monthlySalary: number;
  expectedMonthlyHours: number;
  insuranceRate: number;
};

type FinanceSettings = {
  expectedProfitMarginRate: number;
  estimatedTaxRate: number;
  expectedMonthlyRevenue: number;
};

type SeasonProfile = {
  id: string;
  name: string;
  dayTypes: Record<string, "NORMAL" | "PEAK">;
  normalHourlyProjection: Record<number, number>;
  peakHourlyProjection: Record<number, number>;
};

type ScheduleSnapshot = {
  timeUnit: number;
  assignments: Record<string, Record<number, string[]>>;
  staffTemplates?: Record<string, Record<string, number[]>>;
  absenceOverrides?: Record<string, string[]>;
  seasonProfiles?: SeasonProfile[];
  activeSeasonProfileId?: string | null;
} | null;

type EntryForm = {
  id?: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  inputMode: "AMOUNT" | "RATIO";
  ratioPercent: number;
  memo: string;
  targetDate: string;
};

type Tab = "overview" | "calendar" | "entries" | "efficiency" | "simulator";
type DayTotals = { revenue: number; expense: number };

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const REVENUE_PRESETS = ["홀 매출", "배달앱", "포장", "단체 주문", "기타 매출"];
const EXPENSE_PRESETS = ["임대료", "재료비", "배달대행", "광고비", "수수료", "공과금", "소모품", "기타 지출"];
const AMOUNT_PRESETS = [30000, 50000, 100000, 300000, 500000];
const RATIO_PRESETS = [1, 3, 5, 10, 15];
const TABS: Array<[Tab, string]> = [["overview", "개요"], ["calendar", "달력 입력"], ["entries", "입력 목록"], ["efficiency", "효율 분석"], ["simulator", "순수익 계산"]];
const DEFAULT_PROFILES: SeasonProfile[] = [
  { id: "semester", name: "학기중", dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" }, normalHourlyProjection: makePattern(300000, 400000, 100000, 9, 22), peakHourlyProjection: makePattern(500000, 800000, 200000, 9, 23) },
  { id: "vacation", name: "방학기간", dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" }, normalHourlyProjection: makePattern(200000, 250000, 80000, 10, 21), peakHourlyProjection: makePattern(420000, 650000, 170000, 10, 23) },
];

export function FinanceWorkspace({
  initialItems,
  role,
  storageScope,
  initialSettings,
  initialStaff,
  schedule,
}: {
  initialItems: FinanceItem[];
  role: SystemRole;
  storageScope: string;
  initialSettings: FinanceSettings;
  initialStaff: StaffMember[];
  schedule: ScheduleSnapshot;
}) {
  const [pending, startTransition] = useTransition();
  const [settingsPending, startSettingsTransition] = useTransition();
  const [efficiencyPending, startEfficiencyTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [tab, setTab] = useState<Tab>("overview");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<"ALL" | "REVENUE" | "EXPENSE">("ALL");
  const [message, setMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [efficiencyMessage, setEfficiencyMessage] = useState("");
  const [businessHours, setBusinessHours] = useState({ start: 10, end: 22 });
  const [form, setForm] = useState<EntryForm>({ type: "REVENUE", category: REVENUE_PRESETS[0], amount: 0, inputMode: "AMOUNT", ratioPercent: 0, memo: "", targetDate: new Date().toISOString().slice(0, 10) });
  const [editing, setEditing] = useState<EntryForm | null>(null);
  const [scheduleState, setScheduleState] = useState(() => normalizeSchedule(schedule));
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const cache = readWorkspaceCache(storageScope);
    if (Array.isArray(cache?.financeItems)) {
      setItems(cache.financeItems as FinanceItem[]);
    }
    if (cache?.financeSettings && typeof cache.financeSettings === "object") {
      setSettings(cache.financeSettings as FinanceSettings);
    }
    if (cache?.schedule && typeof cache.schedule === "object") {
      setScheduleState(normalizeSchedule(cache.schedule as ScheduleSnapshot));
    }
    setCacheReady(true);
  }, [schedule, storageScope]);

  useEffect(() => {
    if (!cacheReady) return;
    patchWorkspaceCache(storageScope, {
      financeItems: items,
      financeSettings: settings,
      schedule: scheduleState as unknown as Record<string, unknown>,
    });
  }, [cacheReady, items, scheduleState, settings, storageScope]);

  const monthItems = useMemo(
    () =>
      items
        .filter((item) => {
          const d = new Date(item.targetDate);
          return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
        })
        .sort((a, b) => b.targetDate.localeCompare(a.targetDate)),
    [items, targetMonth, targetYear],
  );
  const financeSummary = useMemo(
    () =>
      getStoreMonthInsights({
        staff: initialStaff,
        financeItems: items,
        schedule: scheduleState,
        year: targetYear,
        month: targetMonth,
        expectedMonthlyRevenue: settings.expectedMonthlyRevenue,
        expectedProfitMarginRate: settings.expectedProfitMarginRate,
        estimatedTaxRate: settings.estimatedTaxRate,
      }),
    [initialStaff, items, scheduleState, settings.estimatedTaxRate, settings.expectedMonthlyRevenue, settings.expectedProfitMarginRate, targetMonth, targetYear],
  );
  const realRevenue = financeSummary.realRevenue;
  const revenueBase = financeSummary.revenueBase;
  const expenseItems = financeSummary.expenseItems;
  const totalExpense = financeSummary.totalExpense;
  const dailyTotals = useMemo(() => {
    const map = new Map<string, DayTotals>();
    monthItems.forEach((item) => {
      const key = item.targetDate.slice(0, 10);
      const now = map.get(key) ?? { revenue: 0, expense: 0 };
      if (item.type === "REVENUE") now.revenue += item.amount; else now.expense += entryAmount(item, revenueBase);
      map.set(key, now);
    });
    return map;
  }, [monthItems, revenueBase]);
  const selectedDateItems = useMemo(() => monthItems.filter((item) => item.targetDate.slice(0, 10) === selectedDate), [monthItems, selectedDate]);
  const filtered = useMemo(() => filter === "ALL" ? monthItems : monthItems.filter((item) => item.type === filter), [filter, monthItems]);
  const activeProfile = useMemo(() => scheduleState.seasonProfiles.find((profile) => profile.id === scheduleState.activeSeasonProfileId) ?? scheduleState.seasonProfiles[0] ?? null, [scheduleState]);
  const avgProjection = useMemo(() => activeProfile ? averageProfile(activeProfile) : makePattern(0, 0, 0, 0, 0), [activeProfile]);
  const assignmentView = useMemo(() => getScheduleAssignments(scheduleState), [scheduleState]);
  const hourlyChart = useMemo(() => Array.from({ length: 24 }, (_, hour) => {
    const sales = avgProjection[hour] || 0;
    const slots = Array.from({ length: Math.ceil(60 / scheduleState.timeUnit) }, (_, i) => hour * 60 + i * scheduleState.timeUnit).filter((slot) => slot < (hour + 1) * 60);
    let labor = 0;
    let expected = 0;
    slots.forEach((slot) => WORK_DAYS.forEach((day) => (assignmentView[day]?.[slot] || []).forEach((staffId) => {
      const member = initialStaff.find((item) => item.id === staffId);
      if (!member) return;
      labor += member.targetWage * (scheduleState.timeUnit / 60) / 7;
      expected += (member.expectedSales || member.capacity || 0) * (scheduleState.timeUnit / 60) / 7;
    })));
    return { hour, sales, labor, expected };
  }), [assignmentView, avgProjection, initialStaff, scheduleState.timeUnit]);
  const chartMax = useMemo(() => Math.max(300000, ...hourlyChart.flatMap((item) => [item.sales, item.labor, item.expected])), [hourlyChart]);
  const staffContribution = financeSummary.staffMetrics.map((member) => ({
    ...member,
    hours: member.grossHours,
  }));
  const laborCost = financeSummary.laborCost;
  const preTaxProfit = financeSummary.preTaxProfit;
  const estimatedTax = financeSummary.estimatedTax;
  const netProfit = financeSummary.netProfit;

  async function saveEntry(next: EntryForm, method: "POST" | "PATCH") {
    setMessage("");
    startTransition(async () => {
      try {
        const payload = { ...(method === "PATCH" ? { id: next.id } : {}), type: next.type, category: next.category.trim(), amount: next.type === "EXPENSE" && next.inputMode === "RATIO" ? 0 : Number(next.amount), inputMode: next.type === "EXPENSE" ? next.inputMode : "AMOUNT", ratioPercent: next.type === "EXPENSE" && next.inputMode === "RATIO" ? Number(next.ratioPercent) : null, memo: next.memo, targetDate: next.targetDate };
        const response = await fetch("/api/finance", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const { data, message: apiMessage } = await readApiResponse<{ entry?: FinanceItem; message?: string }>(response);
        if (!response.ok || !data?.entry) { setMessage(apiMessage ?? (method === "POST" ? "항목 저장에 실패했습니다." : "항목 수정에 실패했습니다.")); return; }
        setItems((prev) => method === "POST" ? [data.entry!, ...prev] : prev.map((item) => item.id === data.entry!.id ? data.entry! : item));
        setEditing(null);
        setForm((prev) => ({ ...prev, amount: 0, ratioPercent: 0, memo: "" }));
        setSelectedDate(next.targetDate);
        setTab("entries");
        setMessage(method === "POST" ? "새 항목을 저장했습니다." : "항목을 수정했습니다.");
      } catch { setMessage(method === "POST" ? "항목 저장 중 오류가 발생했습니다." : "항목 수정 중 오류가 발생했습니다."); }
    });
  }

  async function removeEntry(id: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/finance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        const { message: apiMessage } = await readApiResponse<{ id?: string; message?: string }>(response);
        if (!response.ok) { setMessage(apiMessage ?? "항목 삭제에 실패했습니다."); return; }
        setItems((prev) => prev.filter((item) => item.id !== id));
        setEditing((prev) => prev?.id === id ? null : prev);
        setMessage("항목을 삭제했습니다.");
      } catch { setMessage("항목 삭제 중 오류가 발생했습니다."); }
    });
  }

  async function saveSettings() {
    setSettingsMessage("");
    startSettingsTransition(async () => {
      try {
        const response = await fetch("/api/finance-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
        const { data, message: apiMessage } = await readApiResponse<{ settings?: FinanceSettings; message?: string }>(response);
        if (!response.ok || !data?.settings) { setSettingsMessage(apiMessage ?? "재무 설정 저장에 실패했습니다."); return; }
        setSettings(data.settings);
        setSettingsMessage("재무 설정을 저장했습니다.");
      } catch { setSettingsMessage("재무 설정 저장 중 오류가 발생했습니다."); }
    });
  }

  async function saveEfficiency() {
    setEfficiencyMessage("");
    startEfficiencyTransition(async () => {
      try {
        const response = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeUnit: scheduleState.timeUnit, hourlySalesProjection: avgProjection, assignments: assignmentView, staffTemplates: scheduleState.staffTemplates, absenceOverrides: scheduleState.absenceOverrides, seasonProfiles: scheduleState.seasonProfiles, activeSeasonProfileId: scheduleState.activeSeasonProfileId }) });
        const { message: apiMessage } = await readApiResponse<{ message?: string }>(response);
        if (!response.ok) { setEfficiencyMessage(apiMessage ?? "효율 분석 설정 저장에 실패했습니다."); return; }
        setEfficiencyMessage("효율 분석 설정을 저장했습니다.");
      } catch { setEfficiencyMessage("효율 분석 저장 중 오류가 발생했습니다."); }
    });
  }

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <DashboardTabs current="/dashboard/finance" role={role} />
        <section style={S.hero}><div style={S.eyebrow}>Finance Studio</div><h1 style={S.title}>재무관리, 순수익 계산, 효율 분석을 한 화면에서 관리</h1><p style={S.desc}>월별 입력 항목은 목록에서 바로 수정되도록 바꿨고, 금액과 매출 대비 % 지출을 함께 계산할 수 있게 정리했습니다.</p></section>
        <div style={S.metrics}>
          <Metric title="월 매출 기준" value={`${revenueBase.toLocaleString()}원`} helper={realRevenue > 0 ? "실제 입력 매출" : "예상 월매출"} icon={<TrendingUp size={18} color="#34d399" />} />
          <Metric title="총 지출" value={`${totalExpense.toLocaleString()}원`} helper="금액 + 비율 항목 합산" icon={<TrendingDown size={18} color="#f87171" />} />
          <Metric title="예상 세금" value={`${Math.round(estimatedTax).toLocaleString()}원`} helper={`${settings.estimatedTaxRate.toFixed(1)}%`} icon={<Receipt size={18} color="#fbbf24" />} />
          <Metric title="예상 순수익" value={`${Math.round(netProfit).toLocaleString()}원`} helper={`인건비 ${laborCost.toLocaleString()}원 반영`} icon={<DollarSign size={18} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} />} />
        </div>
        <section style={S.panel}>
          <div style={S.head}><div><h2 style={S.h2}>빠른 항목 추가</h2><p style={S.sub}>카테고리는 나중에 월별 구조를 볼 때 묶이는 이름입니다. 수수료처럼 비율 지출은 `매출 대비 %`를 선택하세요.</p></div><div style={S.row}><button type="button" onClick={() => setForm((prev) => ({ ...prev, targetDate: new Date().toISOString().slice(0, 10) }))} style={S.chip}>오늘</button><button type="button" onClick={() => setForm((prev) => ({ ...prev, targetDate: selectedDate }))} style={S.chip}>선택 날짜</button></div></div>
          <div style={S.formGrid}>
            <label style={S.label}>구분<div style={S.row}><button type="button" onClick={() => setForm((prev) => ({ ...prev, type: "REVENUE", inputMode: "AMOUNT", category: REVENUE_PRESETS[0] }))} style={form.type === "REVENUE" ? S.activeChip : S.chip}>매출</button><button type="button" onClick={() => setForm((prev) => ({ ...prev, type: "EXPENSE", category: EXPENSE_PRESETS[0] }))} style={form.type === "EXPENSE" ? S.activeChip : S.chip}>지출</button></div></label>
            <label style={S.label}>날짜<input type="date" value={form.targetDate} onChange={(e) => { setSelectedDate(e.target.value); setForm((prev) => ({ ...prev, targetDate: e.target.value })); }} style={S.input} /></label>
            <label style={S.label}>카테고리<input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="예: 홀 매출, 재료비, 임대료" style={S.input} /></label>
            <div style={S.presetWrap}>{(form.type === "REVENUE" ? REVENUE_PRESETS : EXPENSE_PRESETS).map((preset) => <button key={preset} type="button" onClick={() => setForm((prev) => ({ ...prev, category: preset }))} style={form.category === preset ? S.activeChip : S.chip}>{preset}</button>)}</div>
            <label style={S.label}>입력 방식{form.type === "EXPENSE" ? <div style={S.row}><button type="button" onClick={() => setForm((prev) => ({ ...prev, inputMode: "AMOUNT" }))} style={form.inputMode === "AMOUNT" ? S.activeChip : S.chip}>금액</button><button type="button" onClick={() => setForm((prev) => ({ ...prev, inputMode: "RATIO" }))} style={form.inputMode === "RATIO" ? S.activeChip : S.chip}>매출 대비 %</button></div> : <div style={S.inputMuted}>매출은 금액 입력만 사용합니다.</div>}</label>
            {form.type === "EXPENSE" && form.inputMode === "RATIO" ? <label style={S.label}>비율(%)<input type="number" step="0.1" value={form.ratioPercent} onChange={(e) => setForm((prev) => ({ ...prev, ratioPercent: Number(e.target.value) }))} style={S.input} /><div style={S.presetWrap}>{RATIO_PRESETS.map((n) => <button key={n} type="button" onClick={() => setForm((prev) => ({ ...prev, ratioPercent: n }))} style={S.chip}>{n}%</button>)}</div></label> : <label style={S.label}>금액<input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} style={S.input} /><div style={S.presetWrap}>{AMOUNT_PRESETS.map((n) => <button key={n} type="button" onClick={() => setForm((prev) => ({ ...prev, amount: n }))} style={S.chip}>{n.toLocaleString()}원</button>)}</div></label>}
            <label style={S.label}>메모<input value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} placeholder="예: 테스트 데이터, 카드 결제" style={S.input} /></label>
          </div>
          {message ? <div style={S.notice}>{message}</div> : null}
          <button type="button" onClick={() => void saveEntry(form, "POST")} disabled={pending || !form.category.trim()} style={S.primary}>{pending ? "저장 중..." : "항목 저장"}</button>
        </section>
        <div style={S.tabs}>{TABS.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} style={tab === id ? S.activeTab : S.tab}>{label}</button>)}</div>
        <section style={S.filterBar}><label style={S.label}>연도<select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} style={S.mini}>{[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}</select></label><label style={S.label}>월<select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))} style={S.mini}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}</select></label><label style={S.label}>선택 날짜<input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={S.mini} /></label></section>
        {tab === "overview" ? <div style={S.grid3}>
          <Block title="지출 구조">{expenseItems.length === 0 ? <div style={S.muted}>이번 달 지출 항목이 없습니다.</div> : expenseItems.map((item) => <Row key={item.id} title={item.category} meta={item.inputMode === "RATIO" ? `매출 대비 ${(item.ratioPercent ?? 0).toFixed(1)}%` : "금액 직접 입력"} value={`${item.computedAmount.toLocaleString()}원`} valueColor="#f87171" />)}</Block>
          <Block title="최근 입력">{monthItems.slice(0, 6).length === 0 ? <div style={S.muted}>최근 입력 내역이 없습니다.</div> : monthItems.slice(0, 6).map((item) => <Row key={item.id} title={item.category} meta={`${item.targetDate.slice(0, 10)} · ${item.memo || "메모 없음"}`} value={`${item.type === "REVENUE" ? "+" : "-"}${entryAmount(item, revenueBase).toLocaleString()}원`} valueColor={item.type === "REVENUE" ? "#34d399" : "#f87171"} />)}</Block>
          <Block title="직원 매출 기여도">{staffContribution.length === 0 ? <div style={S.muted}>직원 데이터가 없습니다.</div> : staffContribution.map((member) => <Row key={member.id} title={member.name ?? "직원"} meta={`근무 ${member.hours.toFixed(1)}h · 기대매출 ${member.expectedRevenue.toLocaleString()}원 · 총고용비 ${member.employerCost.toLocaleString()}원`} value={`${member.ownerContribution.toLocaleString()}원`} valueColor={member.ownerContribution >= 0 ? "#34d399" : "#f87171"} />)}</Block>
        </div> : null}
        {tab === "calendar" ? <div style={S.grid2}>
          <Block title="달력 입력"><div style={S.calendar}>{DAYS.map((day) => <div key={day} style={S.dayHead}>{day}</div>)}{renderCalendar(targetYear, targetMonth, dailyTotals, selectedDate, setSelectedDate, setForm)}</div></Block>
          <Block title="선택 날짜 내역">{selectedDateItems.length === 0 ? <div style={S.muted}>선택한 날짜에 입력된 항목이 없습니다.</div> : selectedDateItems.map((item) => <Row key={item.id} title={item.category} meta={item.memo || "메모 없음"} value={`${item.type === "REVENUE" ? "+" : "-"}${entryAmount(item, revenueBase).toLocaleString()}원`} valueColor={item.type === "REVENUE" ? "#34d399" : "#f87171"} action={<button type="button" onClick={() => { setTab("entries"); setEditing({ id: item.id, type: item.type, category: item.category, amount: item.amount, inputMode: item.inputMode, ratioPercent: item.ratioPercent ?? 0, memo: item.memo ?? "", targetDate: item.targetDate.slice(0, 10) }); }} style={S.inline}>목록에서 수정</button>} />)}</Block>
        </div> : null}
        {tab === "entries" ? <Block title="월별 입력 항목" subtitle="이 목록에서 바로 수정하거나 삭제할 수 있습니다.">
          <div style={S.row}>{[["ALL", "전체"], ["REVENUE", "매출"], ["EXPENSE", "지출"]].map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id as "ALL" | "REVENUE" | "EXPENSE")} style={filter === id ? S.activeChip : S.chip}>{label}</button>)}</div>
          <div style={S.stack}>{filtered.length === 0 ? <div style={S.muted}>이번 달 입력 내역이 없습니다.</div> : filtered.map((item) => {
            const isEditing = editing?.id === item.id;
            return <div key={item.id} style={S.entry}><div style={S.entryTop}><div><strong>{item.category}</strong><div style={S.meta}>{item.targetDate.slice(0, 10)} · {item.inputMode === "RATIO" ? `매출 대비 ${(item.ratioPercent ?? 0).toFixed(1)}%` : "금액 직접 입력"} · {item.memo || "메모 없음"}</div></div><div style={S.amountBox}><strong style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171" }}>{item.type === "REVENUE" ? "+" : "-"}{entryAmount(item, revenueBase).toLocaleString()}원</strong><div style={S.row}><button type="button" onClick={() => setEditing({ id: item.id, type: item.type, category: item.category, amount: item.amount, inputMode: item.inputMode, ratioPercent: item.ratioPercent ?? 0, memo: item.memo ?? "", targetDate: item.targetDate.slice(0, 10) })} style={S.secondary}><PencilLine size={14} />바로 수정</button><button type="button" onClick={() => void removeEntry(item.id)} style={S.danger}><Trash2 size={14} />삭제</button></div></div></div>{isEditing && editing ? <div style={S.editBox}><div style={S.editGrid}><label style={S.label}>구분<select value={editing.type} onChange={(e) => setEditing((prev) => prev ? { ...prev, type: e.target.value as "REVENUE" | "EXPENSE", inputMode: e.target.value === "REVENUE" ? "AMOUNT" : prev.inputMode } : prev)} style={S.input}><option value="REVENUE">매출</option><option value="EXPENSE">지출</option></select></label><label style={S.label}>날짜<input type="date" value={editing.targetDate} onChange={(e) => setEditing((prev) => prev ? { ...prev, targetDate: e.target.value } : prev)} style={S.input} /></label><label style={S.label}>카테고리<input value={editing.category} onChange={(e) => setEditing((prev) => prev ? { ...prev, category: e.target.value } : prev)} style={S.input} /></label><label style={S.label}>입력 방식<select value={editing.type === "REVENUE" ? "AMOUNT" : editing.inputMode} onChange={(e) => setEditing((prev) => prev ? { ...prev, inputMode: e.target.value as "AMOUNT" | "RATIO" } : prev)} disabled={editing.type === "REVENUE"} style={S.input}><option value="AMOUNT">금액</option><option value="RATIO">매출 대비 %</option></select></label>{editing.type === "EXPENSE" && editing.inputMode === "RATIO" ? <label style={S.label}>비율(%)<input type="number" step="0.1" value={editing.ratioPercent} onChange={(e) => setEditing((prev) => prev ? { ...prev, ratioPercent: Number(e.target.value) } : prev)} style={S.input} /></label> : <label style={S.label}>금액<input type="number" value={editing.amount} onChange={(e) => setEditing((prev) => prev ? { ...prev, amount: Number(e.target.value) } : prev)} style={S.input} /></label>}<label style={S.label}>메모<input value={editing.memo} onChange={(e) => setEditing((prev) => prev ? { ...prev, memo: e.target.value } : prev)} style={S.input} /></label></div><div style={S.row}><button type="button" onClick={() => setEditing(null)} style={S.secondary}>취소</button><button type="button" onClick={() => void saveEntry(editing, "PATCH")} disabled={pending || !editing.category.trim()} style={S.primary}>{pending ? "저장 중..." : "수정 저장"}</button></div></div> : null}</div>;
          })}</div>
        </Block> : null}
        {tab === "efficiency" ? <div style={S.grid2Wide}>
          <Block title="시즌별 매출 패턴" subtitle="학기중, 방학기간처럼 시즌을 나눠서 요일 그룹과 시간대별 기대매출을 저장합니다.">
            {activeProfile ? <>
              <label style={S.label}>시즌 선택<select value={scheduleState.activeSeasonProfileId ?? activeProfile.id} onChange={(e) => setScheduleState((prev) => ({ ...prev, activeSeasonProfileId: e.target.value }))} style={S.input}>{scheduleState.seasonProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label style={S.label}>시즌 이름<input value={activeProfile.name} onChange={(e) => setScheduleState((prev) => ({ ...prev, seasonProfiles: prev.seasonProfiles.map((profile) => profile.id === activeProfile.id ? { ...profile, name: e.target.value } : profile) }))} style={S.input} /></label>
              <div style={S.presetWrap}>{WORK_DAYS.map((day) => { const isPeak = activeProfile.dayTypes[day] === "PEAK"; return <button key={day} type="button" onClick={() => setScheduleState((prev) => ({ ...prev, seasonProfiles: prev.seasonProfiles.map((profile) => profile.id === activeProfile.id ? { ...profile, dayTypes: { ...profile.dayTypes, [day]: isPeak ? "NORMAL" : "PEAK" } } : profile) }))} style={isPeak ? S.activeChip : S.chip}>{day} {isPeak ? "피크" : "일반"}</button>; })}</div>
              <HourGrid title="일반일 시간대별 기대매출" values={activeProfile.normalHourlyProjection} onChange={(hour, value) => setScheduleState((prev) => ({ ...prev, seasonProfiles: prev.seasonProfiles.map((profile) => profile.id === activeProfile.id ? { ...profile, normalHourlyProjection: { ...profile.normalHourlyProjection, [hour]: value } } : profile) }))} />
              <HourGrid title="피크일 시간대별 기대매출" values={activeProfile.peakHourlyProjection} onChange={(hour, value) => setScheduleState((prev) => ({ ...prev, seasonProfiles: prev.seasonProfiles.map((profile) => profile.id === activeProfile.id ? { ...profile, peakHourlyProjection: { ...profile.peakHourlyProjection, [hour]: value } } : profile) }))} />
              <div style={S.row}><button type="button" onClick={() => { const id = `season-${Date.now()}`; setScheduleState((prev) => ({ ...prev, seasonProfiles: [...prev.seasonProfiles, { id, name: `시즌 ${prev.seasonProfiles.length + 1}`, dayTypes: { ...activeProfile.dayTypes }, normalHourlyProjection: { ...activeProfile.normalHourlyProjection }, peakHourlyProjection: { ...activeProfile.peakHourlyProjection } }], activeSeasonProfileId: id })); }} style={S.secondary}>시즌 추가</button><button type="button" onClick={() => void saveEfficiency()} disabled={efficiencyPending} style={S.primary}><Save size={14} />{efficiencyPending ? "저장 중..." : "효율 분석 저장"}</button></div>
              <div style={S.meta}>{efficiencyMessage || "스케줄 화면이 아니라 재무관리 안에서 시즌별 효율 분석을 관리합니다."}</div>
            </> : <div style={S.muted}>시즌 데이터가 없습니다.</div>}
          </Block>
          <Block title="시간대별 효율 분석" subtitle="저장된 시즌별 기대매출과 스케줄 배정을 기준으로 시간대 효율을 봅니다.">
            <div style={S.row}><label style={S.label}>시작<input type="number" min="0" max="23" value={businessHours.start} onChange={(e) => setBusinessHours((prev) => ({ ...prev, start: Number(e.target.value) }))} style={S.mini} /></label><label style={S.label}>종료<input type="number" min="0" max="23" value={businessHours.end} onChange={(e) => setBusinessHours((prev) => ({ ...prev, end: Number(e.target.value) }))} style={S.mini} /></label></div>
            <div style={S.row}><Legend color="#3b82f6" label="매출" /><Legend color="#ef4444" label="인건비" /><Legend color="#10b981" label="직원 기대매출" line /></div>
            <div style={S.chart}>{hourlyChart.map((item) => { const sales = Math.min((item.sales / chartMax) * 100, 100); const labor = Math.min((item.labor / chartMax) * 100, 100); const expected = Math.min((item.expected / chartMax) * 100, 100); const inBiz = item.hour >= businessHours.start && item.hour <= businessHours.end; return <div key={item.hour} style={{ ...S.chartCol, opacity: inBiz ? 1 : 0.35 }}><div style={{ minHeight: 16 }}>{inBiz && item.sales > item.expected ? <Zap size={14} color="#f87171" /> : null}</div><div style={S.barWrap}><div style={{ ...S.capLine, bottom: `${expected}%` }} /><div style={{ ...S.bar, height: `${sales}%`, background: "#3b82f6" }} /><div style={{ ...S.bar, height: `${labor}%`, background: "#ef4444" }} /></div><div style={S.chartLabel}>{item.hour}시</div></div>; })}</div>
          </Block>
        </div> : null}
        {tab === "simulator" ? <div style={S.grid2}>
          <Block title="순수익 계산 설정" subtitle="인건비 제외 수익률과 세율을 저장해 예상 순수익을 계산합니다.">
            <label style={S.label}>인건비 제외 기대수익률(%)<input type="number" step="0.1" value={settings.expectedProfitMarginRate} onChange={(e) => setSettings((prev) => ({ ...prev, expectedProfitMarginRate: Number(e.target.value) }))} style={S.input} /></label>
            <label style={S.label}>예상 세율(%)<input type="number" step="0.1" value={settings.estimatedTaxRate} onChange={(e) => setSettings((prev) => ({ ...prev, estimatedTaxRate: Number(e.target.value) }))} style={S.input} /></label>
            <label style={S.label}>예상 월매출<input type="number" value={settings.expectedMonthlyRevenue} onChange={(e) => setSettings((prev) => ({ ...prev, expectedMonthlyRevenue: Number(e.target.value) }))} style={S.input} /></label>
            <div style={S.meta}>{settingsMessage || "실제 월매출 입력이 없을 때 예상 월매출을 기준으로 계산합니다."}</div>
            <button type="button" onClick={() => void saveSettings()} disabled={settingsPending} style={S.primary}>{settingsPending ? "저장 중..." : "재무 설정 저장"}</button>
          </Block>
          <Block title="예상 순수익">
            <Sim label="월 매출 기준" value={`${revenueBase.toLocaleString()}원`} color="#34d399" />
            <Sim label="총 지출" value={`-${totalExpense.toLocaleString()}원`} color="#f87171" />
            <Sim label="총 인건비" value={`-${laborCost.toLocaleString()}원`} color="#fb923c" />
            <Sim label="세전 이익" value={`${preTaxProfit.toLocaleString()}원`} color={preTaxProfit >= 0 ? "#cbd5e1" : "#f87171"} />
            <Sim label="예상 세금" value={`-${Math.round(estimatedTax).toLocaleString()}원`} color="#fbbf24" />
            <Sim label="예상 순수익" value={`${Math.round(netProfit).toLocaleString()}원`} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} strong />
          </Block>
        </div> : null}
      </div>
    </main>
  );
}

function renderCalendar(year: number, month: number, dailyTotals: Map<string, DayTotals>, selectedDate: string, setSelectedDate: (value: string) => void, setForm: Dispatch<SetStateAction<EntryForm>>) {
  const cells: ReactNode[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  for (let i = 0; i < firstDay; i += 1) cells.push(<div key={`empty-${i}`} style={S.empty} />);
  for (let date = 1; date <= daysInMonth; date += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    const totals = dailyTotals.get(key);
    const active = key === selectedDate;
    cells.push(<button key={key} type="button" onClick={() => { setSelectedDate(key); setForm((prev) => ({ ...prev, targetDate: key })); }} style={{ ...S.dayCell, border: active ? "1px solid #10b981" : "1px solid #1e293b" }}><div style={{ color: "#94a3b8", fontSize: 12 }}>{date}</div><div style={{ color: "#34d399", fontSize: 12 }}>{totals ? `+${totals.revenue.toLocaleString()}` : "+0"}</div><div style={{ color: "#f87171", fontSize: 12 }}>{totals ? `-${totals.expense.toLocaleString()}` : "-0"}</div></button>);
  }
  return cells;
}

function normalizeSchedule(schedule: ScheduleSnapshot) {
  return {
    timeUnit: schedule?.timeUnit ?? 20,
    assignments: Object.fromEntries(WORK_DAYS.map((day) => [day, schedule?.assignments?.[day] ?? {}])) as Record<string, Record<number, string[]>>,
    staffTemplates: schedule?.staffTemplates ?? {},
    absenceOverrides: schedule?.absenceOverrides ?? {},
    seasonProfiles: schedule?.seasonProfiles?.length ? schedule.seasonProfiles : DEFAULT_PROFILES,
    activeSeasonProfileId: schedule?.activeSeasonProfileId ?? schedule?.seasonProfiles?.[0]?.id ?? DEFAULT_PROFILES[0].id,
  };
}

function averageProfile(profile: SeasonProfile) {
  const normalDays = WORK_DAYS.filter((day) => profile.dayTypes[day] !== "PEAK").length;
  const peakDays = WORK_DAYS.filter((day) => profile.dayTypes[day] === "PEAK").length;
  return Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, Math.round(((profile.normalHourlyProjection[hour] || 0) * normalDays + (profile.peakHourlyProjection[hour] || 0) * peakDays) / 7)])) as Record<number, number>;
}

function makePattern(lunch: number, dinner: number, normal: number, open: number, close: number) {
  return Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, hour >= 11 && hour <= 13 ? lunch : hour >= 17 && hour <= 22 ? dinner : hour >= open && hour <= close ? normal : 0])) as Record<number, number>;
}

function Metric({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: ReactNode }) {
  return <div style={S.metric}><div style={{ marginBottom: 8 }}>{icon}</div><div style={{ color: "#94a3b8", marginBottom: 6 }}>{title}</div><div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div><div style={S.meta}>{helper}</div></div>;
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section style={S.panel}><div style={S.head}><div><h2 style={S.h2}>{title}</h2>{subtitle ? <p style={S.sub}>{subtitle}</p> : null}</div></div><div style={S.stack}>{children}</div></section>;
}

function Row({ title, meta, value, valueColor, action }: { title: string; meta: string; value: string; valueColor: string; action?: ReactNode }) {
  return <div style={S.rowBox}><div><strong>{title}</strong><div style={S.meta}>{meta}</div></div><div style={{ display: "grid", justifyItems: "end", gap: 6 }}><strong style={{ color: valueColor }}>{value}</strong>{action}</div></div>;
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}><span style={line ? { width: 18, height: 2, borderRadius: 999, background: color } : { width: 12, height: 12, borderRadius: 4, background: color }} />{label}</span>;
}

function HourGrid({ title, values, onChange }: { title: string; values: Record<number, number>; onChange: (hour: number, value: number) => void }) {
  return <div><div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>{title}</div><div style={S.hours}>{Array.from({ length: 24 }, (_, hour) => <label key={hour} style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span><input type="number" value={values[hour] || 0} onChange={(e) => onChange(hour, Number(e.target.value))} style={{ ...S.mini, textAlign: "center" }} /></label>)}</div></div>;
}

function Sim({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: strong ? 800 : 600 }}><span style={{ color: strong ? "#e2e8f0" : "#94a3b8" }}>{label}</span><span style={{ color }}>{value}</span></div>;
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#020617", padding: 24 },
  wrap: { maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 },
  hero: { padding: 24, borderRadius: 24, background: "linear-gradient(180deg,#0f172a 0%,#0b1220 100%)", border: "1px solid #1e293b" },
  eyebrow: { color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" },
  title: { margin: "8px 0", fontSize: 34, lineHeight: 1.2 },
  desc: { margin: 0, color: "#94a3b8", lineHeight: 1.6 },
  metrics: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" },
  metric: { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" },
  panel: { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" },
  head: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  h2: { margin: 0 },
  sub: { margin: "6px 0 0", color: "#94a3b8", lineHeight: 1.55 },
  meta: { color: "#64748b", fontSize: 12, lineHeight: 1.5 },
  formGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))" },
  label: { display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 },
  input: { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", width: "100%", boxSizing: "border-box" },
  mini: { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" },
  inputMuted: { background: "#020617", color: "#64748b", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  chip: { padding: "8px 12px", borderRadius: 999, border: "1px solid #334155", background: "#020617", color: "#cbd5e1", cursor: "pointer" },
  activeChip: { padding: "8px 12px", borderRadius: 999, border: "1px solid #10b981", background: "rgba(16,185,129,0.16)", color: "#d1fae5", cursor: "pointer" },
  presetWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
  primary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" },
  secondary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", fontWeight: 600, cursor: "pointer" },
  danger: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 14px", fontWeight: 600, cursor: "pointer" },
  inline: { background: "transparent", color: "#93c5fd", border: "none", padding: 0, cursor: "pointer", fontSize: 12 },
  notice: { marginTop: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.12)", color: "#d1fae5" },
  tabs: { display: "flex", gap: 10, flexWrap: "wrap" },
  tab: { padding: "10px 14px", borderRadius: 999, border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer" },
  activeTab: { padding: "10px 14px", borderRadius: 999, border: "1px solid #10b981", background: "rgba(16,185,129,0.14)", color: "#d1fae5", cursor: "pointer" },
  filterBar: { padding: 16, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b", display: "flex", gap: 12, flexWrap: "wrap" },
  grid3: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))" },
  grid2: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))" },
  grid2Wide: { display: "grid", gap: 16, gridTemplateColumns: "minmax(340px,420px) minmax(0,1fr)" },
  stack: { display: "grid", gap: 10 },
  rowBox: { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", alignItems: "center" },
  muted: { color: "#64748b" },
  calendar: { display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 8 },
  dayHead: { textAlign: "center", color: "#64748b", fontSize: 12, paddingBottom: 6 },
  dayCell: { minHeight: 92, padding: 10, borderRadius: 14, background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left", cursor: "pointer" },
  empty: { minHeight: 92 },
  entry: { display: "grid", gap: 12, padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" },
  entryTop: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" },
  amountBox: { display: "grid", gap: 8, justifyItems: "end" },
  editBox: { display: "grid", gap: 12, paddingTop: 12, borderTop: "1px solid #1e293b" },
  editGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" },
  hours: { display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 8 },
  chart: { display: "flex", gap: 6, alignItems: "flex-end", overflowX: "auto", padding: "12px 0 18px", minHeight: 320 },
  chartCol: { minWidth: 36, flex: "1 0 36px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  barWrap: { width: "100%", height: 220, display: "flex", alignItems: "flex-end", gap: 3, position: "relative" },
  bar: { width: "50%", borderRadius: "8px 8px 2px 2px" },
  capLine: { position: "absolute", left: 0, right: 0, borderTop: "1px dashed #10b981" },
  chartLabel: { color: "#94a3b8", fontSize: 11 },
};
