"use client";

import { useMemo, useState, useTransition, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { BarChart3, Calendar, DollarSign, Receipt, Save, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { readApiResponse } from "@/lib/client-api";
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
  seasonProfiles?: SeasonProfile[];
  activeSeasonProfileId?: string | null;
} | null;

type QuickForm = {
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  inputMode: "AMOUNT" | "RATIO";
  ratioPercent: number;
  memo: string;
  targetDate: string;
};

type FinanceTab = "overview" | "calendar" | "entries" | "efficiency" | "simulator";

const CALENDAR_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const SCHEDULE_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const REVENUE_PRESETS = ["홀매출", "배달앱", "포장", "단체주문", "기타매출"];
const EXPENSE_PRESETS = ["재료비", "월세", "배달대행", "광고비", "수수료", "공과금", "소모품", "기타지출"];
const AMOUNT_PRESETS = [30000, 50000, 100000, 300000, 500000];
const RATIO_PRESETS = [1, 3, 5, 10, 15];
const DEFAULT_SEASON_PROFILES: SeasonProfile[] = [
  {
    id: "semester",
    name: "학기중",
    dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
    normalHourlyProjection: createHourlyPattern(300000, 400000, 100000, 11, 13, 18, 20, 9, 22),
    peakHourlyProjection: createHourlyPattern(500000, 800000, 200000, 11, 13, 17, 22, 9, 23),
  },
  {
    id: "vacation",
    name: "방학기간",
    dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
    normalHourlyProjection: createHourlyPattern(200000, 250000, 80000, 11, 13, 18, 20, 10, 21),
    peakHourlyProjection: createHourlyPattern(420000, 650000, 170000, 11, 13, 17, 22, 10, 23),
  },
];

export function FinanceManager({
  initialItems,
  role,
  initialSettings,
  initialStaff,
  schedule,
}: {
  initialItems: FinanceItem[];
  role: SystemRole;
  initialSettings: FinanceSettings;
  initialStaff: StaffMember[];
  schedule: ScheduleSnapshot;
}) {
  const [pending, startTransition] = useTransition();
  const [settingsPending, startSettingsTransition] = useTransition();
  const [efficiencyPending, startEfficiencyTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [efficiencyMessage, setEfficiencyMessage] = useState("");
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryFilter, setEntryFilter] = useState<"ALL" | "REVENUE" | "EXPENSE">("ALL");
  const [businessHours, setBusinessHours] = useState({ start: 10, end: 22 });
  const [form, setForm] = useState<QuickForm>({
    type: "REVENUE",
    category: "홀매출",
    amount: 0,
    inputMode: "AMOUNT",
    ratioPercent: 0,
    memo: "",
    targetDate: new Date().toISOString().slice(0, 10),
  });
  const [scheduleConfig, setScheduleConfig] = useState(() => createScheduleConfig(schedule));

  const monthItems = useMemo(
    () =>
      items.filter((item) => {
        const date = new Date(item.targetDate);
        return date.getFullYear() === targetYear && date.getMonth() + 1 === targetMonth;
      }),
    [items, targetMonth, targetYear],
  );

  const monthRevenueAmount = useMemo(
    () => monthItems.filter((item) => item.type === "REVENUE").reduce((sum, item) => sum + item.amount, 0),
    [monthItems],
  );

  const revenueBase = monthRevenueAmount > 0 ? monthRevenueAmount : settings.expectedMonthlyRevenue;

  const expenseBreakdown = useMemo(
    () =>
      monthItems
        .filter((item) => item.type === "EXPENSE")
        .map((item) => ({
          ...item,
          computedAmount: item.inputMode === "RATIO" ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100)) : item.amount,
        })),
    [monthItems, revenueBase],
  );

  const totalExpense = useMemo(
    () => expenseBreakdown.reduce((sum, item) => sum + item.computedAmount, 0),
    [expenseBreakdown],
  );

  const recentEntries = useMemo(
    () =>
      [...monthItems]
        .sort((left, right) => right.targetDate.localeCompare(left.targetDate))
        .slice(0, 6),
    [monthItems],
  );

  const dailyMap = useMemo(() => {
    const map = new Map<string, { revenue: number; expense: number }>();
    monthItems.forEach((item) => {
      const key = item.targetDate.slice(0, 10);
      const current = map.get(key) ?? { revenue: 0, expense: 0 };
      if (item.type === "REVENUE") {
        current.revenue += item.amount;
      } else {
        current.expense += item.inputMode === "RATIO" ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100)) : item.amount;
      }
      map.set(key, current);
    });
    return map;
  }, [monthItems, revenueBase]);

  const selectedDateEntries = useMemo(
    () => monthItems.filter((item) => item.targetDate.slice(0, 10) === selectedDate),
    [monthItems, selectedDate],
  );

  const laborByStaff = useMemo(
    () =>
      initialStaff.map((member) => {
        const hours = getMonthlyScheduledHours(scheduleConfig.timeUnit, scheduleConfig.assignments, member.id, targetYear, targetMonth) || member.expectedMonthlyHours;
        const extraAllowance = member.mealAllowance + member.transportAllowance + member.otherAllowance + (member.performanceBonus || member.incentive || 0);
        const payroll = member.employmentType === "MONTHLY" && member.monthlySalary > 0 ? member.monthlySalary : member.targetWage * hours;
        const employerCost = Math.round((payroll + extraAllowance) * (1 + member.insuranceRate / 100));
        const expectedRevenue = Math.round((member.expectedSales || member.capacity || 0) * hours);
        const grossProfitBeforeLabor = Math.round(expectedRevenue * (settings.expectedProfitMarginRate / 100));
        const ownerContribution = grossProfitBeforeLabor - employerCost;
        return { ...member, hours, employerCost, expectedRevenue, grossProfitBeforeLabor, ownerContribution };
      }),
    [initialStaff, scheduleConfig.assignments, scheduleConfig.timeUnit, settings.expectedProfitMarginRate, targetMonth, targetYear],
  );

  const totalLaborCost = useMemo(
    () => laborByStaff.reduce((sum, item) => sum + item.employerCost, 0),
    [laborByStaff],
  );

  const preTaxProfit = revenueBase - totalExpense - totalLaborCost;
  const estimatedTax = Math.max(preTaxProfit, 0) * (settings.estimatedTaxRate / 100);
  const netProfit = preTaxProfit - estimatedTax;

  const filteredEntries = useMemo(() => {
    if (entryFilter === "ALL") return monthItems;
    return monthItems.filter((item) => item.type === entryFilter);
  }, [entryFilter, monthItems]);

  const activeSeasonProfile = useMemo(
    () =>
      scheduleConfig.seasonProfiles.find((item) => item.id === scheduleConfig.activeSeasonProfileId) ??
      scheduleConfig.seasonProfiles[0] ??
      null,
    [scheduleConfig.activeSeasonProfileId, scheduleConfig.seasonProfiles],
  );

  const averagedProjection = useMemo(
    () => (activeSeasonProfile ? buildSeasonAverageProjection(activeSeasonProfile) : createHourlyPattern(0, 0, 0, 0, 0, 0, 0, 0, 0)),
    [activeSeasonProfile],
  );

  const hourlyChartData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => {
        const sales = averagedProjection[hour] || 0;
        const hourSlots = Array.from({ length: 60 / scheduleConfig.timeUnit }, (_, index) => hour * 60 + index * scheduleConfig.timeUnit).filter((slot) => slot < (hour + 1) * 60);
        let laborCost = 0;
        let expectedSales = 0;
        hourSlots.forEach((slot) => {
          SCHEDULE_DAYS.forEach((day) => {
            (scheduleConfig.assignments[day]?.[slot] || []).forEach((staffId) => {
              const member = initialStaff.find((item) => item.id === staffId);
              if (!member) return;
              laborCost += member.targetWage * (scheduleConfig.timeUnit / 60) / 7;
              expectedSales += (member.expectedSales || member.capacity || 0) * (scheduleConfig.timeUnit / 60) / 7;
            });
          });
        });
        return { hour, sales, laborCost, expectedSales };
      }),
    [averagedProjection, initialStaff, scheduleConfig.assignments, scheduleConfig.timeUnit],
  );

  const chartMax = useMemo(
    () => Math.max(300000, ...hourlyChartData.flatMap((item) => [item.sales, item.laborCost, item.expectedSales])),
    [hourlyChartData],
  );

  async function submitQuickEntry() {
    setError("");
    startTransition(async () => {
      try {
        const payload = {
          type: form.type,
          category: form.category.trim(),
          amount: form.type === "EXPENSE" && form.inputMode === "RATIO" ? 0 : Number(form.amount),
          inputMode: form.type === "EXPENSE" ? form.inputMode : "AMOUNT",
          ratioPercent: form.type === "EXPENSE" && form.inputMode === "RATIO" ? Number(form.ratioPercent) : null,
          memo: form.memo,
          targetDate: form.targetDate,
        };

        const response = await fetch("/api/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const { data, message } = await readApiResponse<{ entry?: FinanceItem; message?: string }>(response);
        if (!response.ok || !data?.entry) {
          setError(message ?? "항목 저장에 실패했습니다.");
          return;
        }

        setItems((prev) => [data.entry!, ...prev]);
        setSelectedDate(form.targetDate);
        setForm((prev) => ({
          ...prev,
          amount: 0,
          ratioPercent: 0,
          memo: "",
        }));
        setActiveTab("entries");
      } catch {
        setError("재무 항목 저장 중 오류가 발생했습니다.");
      }
    });
  }

  async function saveSettings() {
    setSettingsMessage("");
    startSettingsTransition(async () => {
      try {
        const response = await fetch("/api/finance-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        const { data, message } = await readApiResponse<{ settings?: FinanceSettings; message?: string }>(response);
        if (!response.ok || !data?.settings) {
          setSettingsMessage(message ?? "재무 설정 저장에 실패했습니다.");
          return;
        }
        setSettings(data.settings);
        setSettingsMessage("재무 설정을 저장했습니다.");
      } catch {
        setSettingsMessage("재무 설정 저장 중 오류가 발생했습니다.");
      }
    });
  }

  async function saveEfficiency() {
    setEfficiencyMessage("");
    startEfficiencyTransition(async () => {
      try {
        const response = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeUnit: scheduleConfig.timeUnit,
            hourlySalesProjection: averagedProjection,
            assignments: scheduleConfig.assignments,
            seasonProfiles: scheduleConfig.seasonProfiles,
            activeSeasonProfileId: scheduleConfig.activeSeasonProfileId,
          }),
        });
        const { message } = await readApiResponse<{ message?: string }>(response);
        if (!response.ok) {
          setEfficiencyMessage(message ?? "효율 분석 설정 저장에 실패했습니다.");
          return;
        }
        setEfficiencyMessage("효율 분석 설정을 저장했습니다.");
      } catch {
        setEfficiencyMessage("효율 분석 저장 중 오류가 발생했습니다.");
      }
    });
  }

  function selectPreset(category: string, type: "REVENUE" | "EXPENSE") {
    setForm((prev) => ({
      ...prev,
      type,
      category,
      inputMode: type === "REVENUE" ? "AMOUNT" : prev.inputMode,
    }));
  }

  function updateSeasonProfile(profileId: string, patch: Partial<SeasonProfile>) {
    setScheduleConfig((prev) => ({
      ...prev,
      seasonProfiles: prev.seasonProfiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile)),
    }));
  }

  function addSeasonProfile() {
    const nextProfile: SeasonProfile = {
      id: `season-${Date.now()}`,
      name: `시즌 ${scheduleConfig.seasonProfiles.length + 1}`,
      dayTypes: { 월: "NORMAL", 화: "NORMAL", 수: "NORMAL", 목: "NORMAL", 금: "PEAK", 토: "PEAK", 일: "PEAK" },
      normalHourlyProjection: { ...(activeSeasonProfile?.normalHourlyProjection ?? DEFAULT_SEASON_PROFILES[0].normalHourlyProjection) },
      peakHourlyProjection: { ...(activeSeasonProfile?.peakHourlyProjection ?? DEFAULT_SEASON_PROFILES[0].peakHourlyProjection) },
    };
    setScheduleConfig((prev) => ({
      ...prev,
      seasonProfiles: [...prev.seasonProfiles, nextProfile],
      activeSeasonProfileId: nextProfile.id,
    }));
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <DashboardTabs current="/dashboard/finance" role={role} />

        <section style={heroStyle}>
          <div style={eyebrowStyle}>Finance Studio</div>
          <h1 style={heroTitleStyle}>재무관리, 순수익 계산, 효율 분석을 한 화면에서 관리</h1>
          <p style={heroTextStyle}>빠른 항목 추가로 매출과 지출을 바로 넣고, 효율 분석은 재무 탭 안에서만 관리하도록 흐름을 정리했습니다.</p>
        </section>

        <div style={summaryGridStyle}>
          <MetricCard icon={<TrendingUp size={18} />} title="월 매출 기준" value={revenueBase} color="#34d399" helper={monthRevenueAmount > 0 ? "실제 입력 매출 기준" : "예상 월매출 기준"} />
          <MetricCard icon={<TrendingDown size={18} />} title="총 지출" value={totalExpense} color="#f87171" helper="금액 입력과 비율 입력 합산" />
          <MetricCard icon={<Receipt size={18} />} title="예상 세금" value={Math.round(estimatedTax)} color="#fbbf24" helper={`${settings.estimatedTaxRate.toFixed(1)}% 적용`} />
          <MetricCard icon={<DollarSign size={18} />} title="예상 순수익" value={Math.round(netProfit)} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} helper={`인건비 ${totalLaborCost.toLocaleString()}원 반영`} />
        </div>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>빠른 항목 추가</h2>
              <p style={sectionTextStyle}>재무관리에서 가장 많이 쓰는 입력을 위로 올렸습니다.</p>
            </div>
            <div style={chipRowStyle}>
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, targetDate: new Date().toISOString().slice(0, 10) }))} style={chipStyle}>오늘</button>
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, targetDate: selectedDate }))} style={chipStyle}>선택 날짜</button>
            </div>
          </div>
          <div style={quickGridStyle}>
            <div style={quickCardStyle}>
              <label style={labelStyle}>
                구분
                <div style={segmentedRowStyle}>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, type: "REVENUE", inputMode: "AMOUNT" }))} style={form.type === "REVENUE" ? activeChipStyle : chipStyle}>매출</button>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, type: "EXPENSE" }))} style={form.type === "EXPENSE" ? activeChipStyle : chipStyle}>지출</button>
                </div>
              </label>
              <label style={labelStyle}>
                날짜
                <input type="date" value={form.targetDate} onChange={(event) => { setSelectedDate(event.target.value); setForm((prev) => ({ ...prev, targetDate: event.target.value })); }} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                카테고리
                <input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="예: 홀매출, 재료비" style={inputStyle} />
              </label>
              <div style={chipWrapStyle}>
                {(form.type === "REVENUE" ? REVENUE_PRESETS : EXPENSE_PRESETS).map((preset) => (
                  <button key={preset} type="button" onClick={() => selectPreset(preset, form.type)} style={form.category === preset ? activeChipStyle : chipStyle}>{preset}</button>
                ))}
              </div>
            </div>

            <div style={quickCardStyle}>
              <label style={labelStyle}>
                입력 방식
                {form.type === "EXPENSE" ? (
                  <div style={segmentedRowStyle}>
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, inputMode: "AMOUNT" }))} style={form.inputMode === "AMOUNT" ? activeChipStyle : chipStyle}>금액</button>
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, inputMode: "RATIO" }))} style={form.inputMode === "RATIO" ? activeChipStyle : chipStyle}>매출 대비 %</button>
                  </div>
                ) : (
                  <div style={{ ...inputStyle, color: "#64748b" }}>매출은 금액 입력만 사용합니다.</div>
                )}
              </label>
              {form.type === "EXPENSE" && form.inputMode === "RATIO" ? (
                <>
                  <label style={labelStyle}>
                    비율
                    <input type="number" step="0.1" value={form.ratioPercent} onChange={(event) => setForm((prev) => ({ ...prev, ratioPercent: Number(event.target.value) }))} style={inputStyle} />
                  </label>
                  <div style={chipWrapStyle}>
                    {RATIO_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => setForm((prev) => ({ ...prev, ratioPercent: preset }))} style={chipStyle}>{preset}%</button>)}
                  </div>
                </>
              ) : (
                <>
                  <label style={labelStyle}>
                    금액
                    <input type="number" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))} style={inputStyle} />
                  </label>
                  <div style={chipWrapStyle}>
                    {AMOUNT_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => setForm((prev) => ({ ...prev, amount: preset }))} style={chipStyle}>{preset.toLocaleString()}원</button>)}
                  </div>
                </>
              )}
              <label style={labelStyle}>
                메모
                <input value={form.memo} onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))} placeholder="필요하면 간단한 메모" style={inputStyle} />
              </label>
              {error ? <div style={{ color: "#fca5a5" }}>{error}</div> : null}
              <button onClick={() => void submitQuickEntry()} disabled={pending || !form.category.trim()} style={primaryButtonStyle}>{pending ? "저장 중..." : "항목 저장"}</button>
            </div>
          </div>
        </section>

        <div style={tabRowStyle}>
          {[
            ["overview", "월 요약"],
            ["calendar", "달력 입력"],
            ["entries", "입력 목록"],
            ["efficiency", "효율 분석"],
            ["simulator", "순수익 계산"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id as FinanceTab)} style={activeTab === id ? activeTabStyle : tabStyle}>
              {label}
            </button>
          ))}
        </div>

        <section style={filterBarStyle}>
          <label style={labelStyle}>
            연도
            <select value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value))} style={miniInputStyle}>
              {[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            월
            <select value={targetMonth} onChange={(event) => setTargetMonth(Number(event.target.value))} style={miniInputStyle}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            선택 날짜
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={miniInputStyle} />
          </label>
        </section>

        {activeTab === "overview" ? (
          <div style={pageGridStyle}>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>지출 구조</h2>
              <div style={stackStyle}>
                {expenseBreakdown.length === 0 ? <div style={mutedStyle}>이번 달 지출 항목이 없습니다.</div> : expenseBreakdown.map((item) => (
                  <div key={item.id} style={summaryRowStyle}>
                    <div>
                      <strong>{item.category}</strong>
                      <div style={hintStyle}>{item.inputMode === "RATIO" ? `매출 대비 ${item.ratioPercent?.toFixed(1)}%` : "금액 직접 입력"}</div>
                    </div>
                    <strong style={{ color: "#f87171" }}>{item.computedAmount.toLocaleString()}원</strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>최근 입력</h2>
              <div style={stackStyle}>
                {recentEntries.length === 0 ? <div style={mutedStyle}>최근 입력 내역이 없습니다.</div> : recentEntries.map((item) => (
                  <div key={item.id} style={summaryRowStyle}>
                    <div>
                      <strong>{item.category}</strong>
                      <div style={hintStyle}>{item.targetDate.slice(0, 10)} · {item.memo || "메모 없음"}</div>
                    </div>
                    <strong style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171" }}>
                      {item.type === "REVENUE" ? "+" : "-"}
                      {(item.type === "EXPENSE" && item.inputMode === "RATIO"
                        ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100))
                        : item.amount).toLocaleString()}원
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>직원 매출 기여도</h2>
              <div style={stackStyle}>
                {laborByStaff.map((member) => (
                  <div key={member.id} style={summaryRowStyle}>
                    <div>
                      <strong>{member.name}</strong>
                      <div style={hintStyle}>
                        {member.hours.toFixed(1)}h · 기대매출 {member.expectedRevenue.toLocaleString()}원 · 고용비 {member.employerCost.toLocaleString()}원
                      </div>
                    </div>
                    <strong style={{ color: member.ownerContribution >= 0 ? "#34d399" : "#f87171" }}>
                      {member.ownerContribution.toLocaleString()}원
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "calendar" ? (
          <div style={pageGridStyle}>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>달력 입력</h2>
              <div style={calendarGridStyle}>
                {CALENDAR_DAYS.map((day) => <div key={day} style={calendarHeadStyle}>{day}</div>)}
                {renderCalendarCells(targetYear, targetMonth, dailyMap, selectedDate, setSelectedDate, setForm)}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>선택 날짜 내역</h2>
              <div style={stackStyle}>
                {selectedDateEntries.length === 0 ? <div style={mutedStyle}>선택한 날짜의 입력이 없습니다.</div> : selectedDateEntries.map((item) => (
                  <div key={item.id} style={summaryRowStyle}>
                    <div>
                      <strong>{item.category}</strong>
                      <div style={hintStyle}>{item.memo || "메모 없음"}</div>
                    </div>
                    <strong style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171" }}>
                      {item.type === "REVENUE" ? "+" : "-"}
                      {(item.type === "EXPENSE" && item.inputMode === "RATIO"
                        ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100))
                        : item.amount).toLocaleString()}원
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "entries" ? (
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>입력 목록</h2>
              <div style={chipRowStyle}>
                {[
                  ["ALL", "전체"],
                  ["REVENUE", "매출"],
                  ["EXPENSE", "지출"],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setEntryFilter(id as "ALL" | "REVENUE" | "EXPENSE")} style={entryFilter === id ? activeChipStyle : chipStyle}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={stackStyle}>
              {filteredEntries.length === 0 ? <div style={mutedStyle}>이번 달 입력 내역이 없습니다.</div> : filteredEntries.map((item) => (
                <div key={item.id} style={entryRowStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <strong>{item.category}</strong>
                      <div style={hintStyle}>
                        {item.targetDate.slice(0, 10)} · {item.inputMode === "RATIO" ? `매출 대비 ${item.ratioPercent?.toFixed(1)}%` : "금액 입력"} · {item.memo || "메모 없음"}
                      </div>
                    </div>
                    <strong style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171" }}>
                      {item.type === "REVENUE" ? "+" : "-"}
                      {(item.type === "EXPENSE" && item.inputMode === "RATIO"
                        ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100))
                        : item.amount).toLocaleString()}원
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "efficiency" ? (
          <div style={efficiencyLayoutStyle}>
            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>시즌별 매출 패턴</h2>
                <button type="button" onClick={addSeasonProfile} style={secondaryButtonStyle}>시즌 추가</button>
              </div>
              {activeSeasonProfile ? (
                <div style={stackStyle}>
                  <label style={labelStyle}>
                    시즌 이름
                    <select value={scheduleConfig.activeSeasonProfileId ?? activeSeasonProfile.id} onChange={(event) => setScheduleConfig((prev) => ({ ...prev, activeSeasonProfileId: event.target.value }))} style={inputStyle}>
                      {scheduleConfig.seasonProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                    </select>
                  </label>
                  <input value={activeSeasonProfile.name} onChange={(event) => updateSeasonProfile(activeSeasonProfile.id, { name: event.target.value })} style={inputStyle} placeholder="예: 학기중, 방학기간" />
                  <div>
                    <div style={labelTextStyle}>요일 그룹</div>
                    <div style={chipWrapStyle}>
                      {SCHEDULE_DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => updateSeasonProfile(activeSeasonProfile.id, { dayTypes: { ...activeSeasonProfile.dayTypes, [day]: activeSeasonProfile.dayTypes[day] === "PEAK" ? "NORMAL" : "PEAK" } })}
                          style={activeSeasonProfile.dayTypes[day] === "PEAK" ? activeChipStyle : chipStyle}
                        >
                          {day} {activeSeasonProfile.dayTypes[day] === "PEAK" ? "피크" : "일반"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <HourInputGrid
                    title="일반일 시간대별 매출"
                    values={activeSeasonProfile.normalHourlyProjection}
                    onChange={(hour, value) => updateSeasonProfile(activeSeasonProfile.id, { normalHourlyProjection: { ...activeSeasonProfile.normalHourlyProjection, [hour]: value } })}
                  />
                  <HourInputGrid
                    title="피크일 시간대별 매출"
                    values={activeSeasonProfile.peakHourlyProjection}
                    onChange={(hour, value) => updateSeasonProfile(activeSeasonProfile.id, { peakHourlyProjection: { ...activeSeasonProfile.peakHourlyProjection, [hour]: value } })}
                  />
                  <div style={hintStyle}>{efficiencyMessage || "스케줄 화면이 아니라 재무관리 안에서만 효율분석 설정을 관리합니다."}</div>
                  <button type="button" onClick={saveEfficiency} disabled={efficiencyPending} style={primaryButtonStyle}>
                    <Save size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {efficiencyPending ? "저장 중..." : "효율 분석 설정 저장"}
                  </button>
                </div>
              ) : (
                <div style={mutedStyle}>시즌 정보가 없습니다.</div>
              )}
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>시간대별 효율 분석</h2>
                  <p style={sectionTextStyle}>스케줄 배치와 매출 패턴을 합쳐 시간대별 효율을 봅니다.</p>
                </div>
                <div style={chipRowStyle}>
                  <label style={labelStyle}>
                    시작
                    <input type="number" min="0" max="23" value={businessHours.start} onChange={(event) => setBusinessHours((prev) => ({ ...prev, start: Number(event.target.value) }))} style={miniInputStyle} />
                  </label>
                  <label style={labelStyle}>
                    종료
                    <input type="number" min="0" max="23" value={businessHours.end} onChange={(event) => setBusinessHours((prev) => ({ ...prev, end: Number(event.target.value) }))} style={miniInputStyle} />
                  </label>
                </div>
              </div>
              <div style={legendRowStyle}>
                <Legend color="#3b82f6" label="매출" />
                <Legend color="#ef4444" label="인건비" />
                <Legend color="#10b981" label="직원 기대매출" line />
              </div>
              <div style={analysisChartStyle}>
                {hourlyChartData.map((item) => {
                  const salesHeight = Math.min((item.sales / chartMax) * 100, 100);
                  const laborHeight = Math.min((item.laborCost / chartMax) * 100, 100);
                  const expectedHeight = Math.min((item.expectedSales / chartMax) * 100, 100);
                  const inBusiness = item.hour >= businessHours.start && item.hour <= businessHours.end;
                  return (
                    <div key={item.hour} style={{ ...chartHourStyle, opacity: inBusiness ? 1 : 0.35 }}>
                      <div style={{ minHeight: 16 }}>{item.sales > item.expectedSales && inBusiness ? <Zap size={14} color="#f87171" /> : null}</div>
                      <div style={barWrapStyle}>
                        <div style={{ ...capacityLineStyle, bottom: `${expectedHeight}%` }} />
                        <div style={{ ...barStyle, height: `${salesHeight}%`, background: "#3b82f6" }} />
                        <div style={{ ...barStyle, height: `${laborHeight}%`, background: "#ef4444" }} />
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>{item.hour}시</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "simulator" ? (
          <div style={simulatorLayoutStyle}>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>순수익 계산 설정</h2>
              <div style={stackStyle}>
                <label style={labelStyle}>
                  인건비 제외 기대수익률
                  <input type="number" step="0.1" value={settings.expectedProfitMarginRate} onChange={(event) => setSettings({ ...settings, expectedProfitMarginRate: Number(event.target.value) })} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  예상 세율
                  <input type="number" step="0.1" value={settings.estimatedTaxRate} onChange={(event) => setSettings({ ...settings, estimatedTaxRate: Number(event.target.value) })} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  예상 월매출
                  <input type="number" value={settings.expectedMonthlyRevenue} onChange={(event) => setSettings({ ...settings, expectedMonthlyRevenue: Number(event.target.value) })} style={inputStyle} />
                </label>
                <div style={hintStyle}>{settingsMessage || "실제 매출이 있으면 실제 매출을 우선 사용합니다."}</div>
                <button onClick={saveSettings} disabled={settingsPending} style={primaryButtonStyle}>{settingsPending ? "저장 중..." : "재무 설정 저장"}</button>
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>예상 순수익</h2>
              <div style={stackStyle}>
                <SimulatorRow label="월 매출 기준" value={`${revenueBase.toLocaleString()}원`} color="#34d399" />
                <SimulatorRow label="총 지출" value={`-${totalExpense.toLocaleString()}원`} color="#f87171" />
                <SimulatorRow label="총 인건비" value={`-${totalLaborCost.toLocaleString()}원`} color="#fb923c" />
                <SimulatorRow label="세전 이익" value={`${preTaxProfit.toLocaleString()}원`} color={preTaxProfit >= 0 ? "#cbd5e1" : "#f87171"} />
                <SimulatorRow label="예상 세금" value={`-${Math.round(estimatedTax).toLocaleString()}원`} color="#fbbf24" />
                <SimulatorRow label="예상 순수익" value={`${Math.round(netProfit).toLocaleString()}원`} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} strong />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function createHourlyPattern(lunch: number, dinner: number, normal: number, lunchStart: number, lunchEnd: number, dinnerStart: number, dinnerEnd: number, open: number, close: number) {
  return Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [
      hour,
      hour >= lunchStart && hour <= lunchEnd ? lunch : hour >= dinnerStart && hour <= dinnerEnd ? dinner : hour >= open && hour <= close ? normal : 0,
    ]),
  ) as Record<number, number>;
}

function createScheduleConfig(schedule: ScheduleSnapshot) {
  return {
    timeUnit: schedule?.timeUnit ?? 20,
    assignments: mergeAssignments(schedule?.assignments),
    seasonProfiles: schedule?.seasonProfiles?.length ? schedule.seasonProfiles : DEFAULT_SEASON_PROFILES,
    activeSeasonProfileId: schedule?.activeSeasonProfileId ?? (schedule?.seasonProfiles?.[0]?.id ?? DEFAULT_SEASON_PROFILES[0].id),
  };
}

function mergeAssignments(raw?: Record<string, Record<number, string[]>>) {
  const base = Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, {} as Record<number, string[]>])) as Record<string, Record<number, string[]>>;
  if (!raw) return base;
  SCHEDULE_DAYS.forEach((day) => {
    base[day] = raw[day] ?? {};
  });
  return base;
}

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

function getMonthlyScheduledHours(timeUnit: number, assignments: Record<string, Record<number, string[]>>, staffId: string, year: number, month: number) {
  const activeSlots = Array.from({ length: (24 * 60) / timeUnit }, (_, index) => index * timeUnit);
  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  for (let date = 1; date <= daysInMonth; date += 1) {
    const dayLabel = CALENDAR_DAYS[new Date(year, month - 1, date).getDay()];
    const slots = activeSlots.filter((slot) => assignments?.[dayLabel]?.[slot]?.includes(staffId));
    if (slots.length > 0) {
      total += (Math.max(...slots) + timeUnit - Math.min(...slots)) / 60;
    }
  }
  return total;
}

function renderCalendarCells(
  year: number,
  month: number,
  dailyMap: Map<string, { revenue: number; expense: number }>,
  selectedDate: string,
  setSelectedDate: (value: string) => void,
  setForm: Dispatch<SetStateAction<QuickForm>>,
) {
  const cells: ReactNode[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  for (let index = 0; index < firstDay; index += 1) cells.push(<div key={`empty-${index}`} style={emptyCellStyle} />);
  for (let date = 1; date <= daysInMonth; date += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    const totals = dailyMap.get(key);
    const active = key === selectedDate;
    cells.push(
      <button
        key={key}
        type="button"
        onClick={() => {
          setSelectedDate(key);
          setForm((prev) => ({ ...prev, targetDate: key }));
        }}
        style={{ ...calendarCellStyle, border: active ? "1px solid #10b981" : "1px solid #1e293b" }}
      >
        <div style={{ color: "#94a3b8", fontSize: 12 }}>{date}</div>
        <div style={{ color: "#34d399", fontSize: 12 }}>{totals ? `+${totals.revenue.toLocaleString()}` : "+0"}</div>
        <div style={{ color: "#f87171", fontSize: 12 }}>{totals ? `-${totals.expense.toLocaleString()}` : "-0"}</div>
      </button>,
    );
  }
  return cells;
}

function HourInputGrid({ title, values, onChange }: { title: string; values: Record<number, number>; onChange: (hour: number, value: number) => void }) {
  return (
    <div>
      <div style={labelTextStyle}>{title}</div>
      <div style={hourGridStyle}>
        {Array.from({ length: 24 }, (_, hour) => (
          <label key={hour} style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{hour}시</span>
            <input type="number" value={values[hour] || 0} onChange={(event) => onChange(hour, Number(event.target.value))} style={{ ...miniInputStyle, textAlign: "center" }} />
          </label>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}>
      <span style={line ? { width: 18, height: 2, borderRadius: 999, background: color } : { width: 12, height: 12, borderRadius: 4, background: color }} />
      {label}
    </span>
  );
}

function MetricCard({ icon, title, value, color, helper }: { icon: ReactNode; title: string; value: number; color: string; helper: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color, marginBottom: 10 }}>{icon}</div>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value.toLocaleString()}원</div>
      <div style={hintStyle}>{helper}</div>
    </div>
  );
}

function SimulatorRow({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontWeight: strong ? 800 : 600 }}>
      <span style={{ color: strong ? "#e2e8f0" : "#94a3b8" }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "#020617", padding: 24 };
const containerStyle: CSSProperties = { maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 };
const heroStyle: CSSProperties = { padding: 24, borderRadius: 24, background: "linear-gradient(180deg, #0f172a 0%, #0b1220 100%)", border: "1px solid #1e293b" };
const eyebrowStyle: CSSProperties = { color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" };
const heroTitleStyle: CSSProperties = { margin: "8px 0", fontSize: 34 };
const heroTextStyle: CSSProperties = { margin: 0, color: "#94a3b8", lineHeight: 1.6 };
const summaryGridStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
const panelStyle: CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const metricCardStyle: CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 };
const sectionTitleStyle: CSSProperties = { margin: 0 };
const sectionTextStyle: CSSProperties = { margin: "6px 0 0", color: "#94a3b8", lineHeight: 1.5 };
const quickGridStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "1.1fr 1fr" };
const quickCardStyle: CSSProperties = { display: "grid", gap: 12 };
const filterBarStyle: CSSProperties = { ...panelStyle, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" };
const pageGridStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" };
const simulatorLayoutStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "360px 1fr" };
const efficiencyLayoutStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "380px 1fr" };
const labelStyle: CSSProperties = { display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 };
const labelTextStyle: CSSProperties = { color: "#94a3b8", fontSize: 13, marginBottom: 8 };
const inputStyle: CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const miniInputStyle: CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" };
const primaryButtonStyle: CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", fontWeight: 600, cursor: "pointer" };
const tabRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const tabStyle: CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer" };
const activeTabStyle: CSSProperties = { ...tabStyle, border: "1px solid #10b981", background: "rgba(16,185,129,0.14)", color: "#d1fae5" };
const chipRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const segmentedRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const chipWrapStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const chipStyle: CSSProperties = { padding: "8px 12px", borderRadius: 999, border: "1px solid #334155", background: "#020617", color: "#cbd5e1", cursor: "pointer" };
const activeChipStyle: CSSProperties = { ...chipStyle, border: "1px solid #10b981", background: "rgba(16,185,129,0.16)", color: "#d1fae5" };
const stackStyle: CSSProperties = { display: "grid", gap: 10 };
const summaryRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", alignItems: "center" };
const entryRowStyle: CSSProperties = { padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" };
const hintStyle: CSSProperties = { color: "#64748b", fontSize: 12, marginTop: 6 };
const mutedStyle: CSSProperties = { color: "#64748b" };
const calendarGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 };
const calendarHeadStyle: CSSProperties = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 };
const calendarCellStyle: CSSProperties = { minHeight: 92, padding: 10, borderRadius: 14, background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left", cursor: "pointer" };
const emptyCellStyle: CSSProperties = { minHeight: 92 };
const hourGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 };
const legendRowStyle: CSSProperties = { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 };
const analysisChartStyle: CSSProperties = { display: "flex", gap: 6, alignItems: "flex-end", overflowX: "auto", padding: "12px 0 18px", minHeight: 320 };
const chartHourStyle: CSSProperties = { minWidth: 36, flex: "1 0 36px", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 };
const barWrapStyle: CSSProperties = { width: "100%", height: 220, display: "flex", alignItems: "flex-end", gap: 3, position: "relative" };
const barStyle: CSSProperties = { width: "50%", borderRadius: "8px 8px 2px 2px" };
const capacityLineStyle: CSSProperties = { position: "absolute", left: 0, right: 0, borderTop: "1px dashed #10b981" };
