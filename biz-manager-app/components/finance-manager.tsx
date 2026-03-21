"use client";

import { useMemo, useState, useTransition, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Calendar, DollarSign, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
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
  insuranceType: "NONE" | "FREELANCER" | "FOUR_INSURANCE";
  insuranceRate: number;
};

type ScheduleSnapshot = {
  timeUnit: number;
  assignments: Record<string, Record<number, string[]>>;
} | null;

type FinanceSettings = {
  expectedProfitMarginRate: number;
  estimatedTaxRate: number;
  expectedMonthlyRevenue: number;
};

type FinanceTab = "overview" | "calendar" | "entries" | "simulator";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

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
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryFilter, setEntryFilter] = useState<"ALL" | "REVENUE" | "EXPENSE">("ALL");
  const [form, setForm] = useState({
    type: "REVENUE" as "REVENUE" | "EXPENSE",
    category: "",
    amount: 0,
    inputMode: "AMOUNT" as "AMOUNT" | "RATIO",
    ratioPercent: 0,
    memo: "",
    targetDate: new Date().toISOString().slice(0, 10),
  });

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

  const expenseBreakdown = useMemo(() => {
    return monthItems
      .filter((item) => item.type === "EXPENSE")
      .map((item) => ({
        ...item,
        computedAmount: item.inputMode === "RATIO" ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100)) : item.amount,
      }));
  }, [monthItems, revenueBase]);

  const totalExpense = useMemo(
    () => expenseBreakdown.reduce((sum, item) => sum + item.computedAmount, 0),
    [expenseBreakdown],
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

  const laborByStaff = useMemo(() => {
    return initialStaff.map((member) => {
      const hours = getMonthlyScheduledHours(schedule, member.id, targetYear, targetMonth) || member.expectedMonthlyHours;
      const extraAllowance = member.mealAllowance + member.transportAllowance + member.otherAllowance + (member.performanceBonus || member.incentive || 0);
      const payroll =
        member.employmentType === "MONTHLY" && member.monthlySalary > 0
          ? member.monthlySalary
          : member.targetWage * hours;
      const employerCost = Math.round((payroll + extraAllowance) * (1 + member.insuranceRate / 100));
      const expectedRevenue = Math.round((member.expectedSales || member.capacity || 0) * hours);
      const grossProfitBeforeLabor = Math.round(expectedRevenue * (settings.expectedProfitMarginRate / 100));
      const ownerContribution = grossProfitBeforeLabor - employerCost;

      return {
        ...member,
        hours,
        employerCost,
        expectedRevenue,
        grossProfitBeforeLabor,
        ownerContribution,
      };
    });
  }, [initialStaff, schedule, settings.expectedProfitMarginRate, targetMonth, targetYear]);

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

  async function submit() {
    setError("");
    startTransition(async () => {
      const payload = {
        type: form.type,
        category: form.category,
        amount: form.inputMode === "AMOUNT" ? Number(form.amount) : 0,
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
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "재무 항목 저장에 실패했습니다.");
        return;
      }

      setItems((prev) => [result.entry, ...prev]);
      setForm({
        type: "REVENUE",
        category: "",
        amount: 0,
        inputMode: "AMOUNT",
        ratioPercent: 0,
        memo: "",
        targetDate: form.targetDate,
      });
      setActiveTab("entries");
    });
  }

  async function saveSettings() {
    setSettingsMessage("");
    startSettingsTransition(async () => {
      const response = await fetch("/api/finance-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) {
        setSettingsMessage(result.message ?? "재무 설정 저장에 실패했습니다.");
        return;
      }
      setSettings(result.settings);
      setSettingsMessage("재무 설정이 저장되었습니다.");
    });
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 }}>
        <DashboardTabs current="/dashboard/finance" role={role} />

        <section style={heroStyle}>
          <div style={{ color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Finance Studio
          </div>
          <h1 style={{ margin: "8px 0", fontSize: 34 }}>재무관리, 세금 예상, 직원 기여도 계산을 한 번에</h1>
          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6 }}>
            실제 매출/지출 입력, 매출 대비 비율 입력, 월 순수익 시뮬레이션, 달력형 일별 입력, 직원별 매출기여도를 함께 보도록 묶었습니다.
          </p>
        </section>

        <div style={summaryGridStyle}>
          <MetricCard icon={<TrendingUp size={18} />} title="월 매출 기준" value={revenueBase} color="#34d399" helper={monthRevenueAmount > 0 ? "실제 입력 매출 사용" : "예상 월매출 사용"} />
          <MetricCard icon={<TrendingDown size={18} />} title="총 지출" value={totalExpense} color="#f87171" helper="금액+매출비율 합산" />
          <MetricCard icon={<Receipt size={18} />} title="예상 세금" value={Math.round(estimatedTax)} color="#fbbf24" helper={`${settings.estimatedTaxRate.toFixed(1)}% 기준`} />
          <MetricCard icon={<DollarSign size={18} />} title="예상 순수익" value={Math.round(netProfit)} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} helper={`인건비 ${totalLaborCost.toLocaleString()}원 포함`} />
        </div>

        <div style={tabRowStyle}>
          {[
            ["overview", "월 요약"],
            ["calendar", "달력 입력"],
            ["entries", "항목 목록"],
            ["simulator", "수익 시뮬레이터"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id as FinanceTab)} style={activeTab === id ? activeTabStyle : tabStyle}>
              {label}
            </button>
          ))}
        </div>

        <section style={{ ...panelStyle, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={labelStyle}>
            연도
            <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} style={miniInputStyle}>
              {[2025, 2026, 2027].map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            월
            <select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))} style={miniInputStyle}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            선택 날짜
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setForm({ ...form, targetDate: e.target.value });
              }}
              style={miniInputStyle}
            />
          </label>
        </section>

        {activeTab === "overview" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section style={twoColumnStyle}>
              <div style={panelStyle}>
                <h2 style={headingStyle}>지출 구조</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {expenseBreakdown.length === 0 ? (
                    <div style={{ color: "#64748b" }}>이번 달 지출 항목이 없습니다.</div>
                  ) : (
                    expenseBreakdown.map((item) => (
                      <div key={item.id} style={summaryRowStyle}>
                        <strong>{item.category}</strong>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#f87171", fontWeight: 700 }}>{item.computedAmount.toLocaleString()}원</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {item.inputMode === "RATIO" ? `매출 대비 ${item.ratioPercent?.toFixed(1)}%` : "고정 금액"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={panelStyle}>
                <h2 style={headingStyle}>직원 매출 기여도</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {laborByStaff.map((member) => (
                    <div key={member.id} style={summaryRowStyle}>
                      <div>
                        <strong>{member.name}</strong>
                        <div style={{ color: "#64748b", marginTop: 6, fontSize: 12 }}>
                          {member.hours.toFixed(1)}h · 기대매출 {member.expectedRevenue.toLocaleString()}원
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: member.ownerContribution >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
                          {member.ownerContribution.toLocaleString()}원
                        </div>
                        <div style={{ color: "#64748b", marginTop: 6, fontSize: 12 }}>
                          사장 수익 기여(인건비 차감 후)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "calendar" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Calendar size={18} color="#34d399" />
                <h2 style={{ margin: 0 }}>일별 매출/지출 달력</h2>
              </div>
              <div style={calendarGridStyle}>
                {DAYS.map((day) => (
                  <div key={day} style={calendarHeadStyle}>
                    {day}
                  </div>
                ))}
                {renderCalendarCells(targetYear, targetMonth, dailyMap, selectedDate, setSelectedDate, setForm)}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={headingStyle}>선택 날짜 입력</h2>
              <EntryEditor form={form} setForm={setForm} error={error} pending={pending} onSubmit={submit} />
            </section>
          </div>
        ) : null}

        {activeTab === "entries" ? (
          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>월별 입력 항목</h2>
              <div style={tabRowStyle}>
                {[
                  ["ALL", "전체"],
                  ["REVENUE", "매출"],
                  ["EXPENSE", "지출"],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setEntryFilter(id as "ALL" | "REVENUE" | "EXPENSE")} style={entryFilter === id ? activeTabStyle : tabStyle}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {filteredEntries.length === 0 ? (
                <div style={{ color: "#64748b" }}>이번 달 항목이 없습니다.</div>
              ) : (
                filteredEntries.map((item) => {
                  const computedAmount =
                    item.type === "EXPENSE" && item.inputMode === "RATIO"
                      ? Math.round(revenueBase * ((item.ratioPercent ?? 0) / 100))
                      : item.amount;
                  return (
                    <div key={item.id} style={entryRowStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong>{item.category}</strong>
                        <span style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171", fontWeight: 700 }}>
                          {item.type === "REVENUE" ? "+" : "-"}
                          {computedAmount.toLocaleString()}원
                        </span>
                      </div>
                      <div style={{ color: "#94a3b8", marginTop: 8 }}>
                        {item.targetDate.slice(0, 10)} · {item.inputMode === "RATIO" ? `매출 대비 ${item.ratioPercent?.toFixed(1)}%` : "금액 직접 입력"}
                        {item.memo ? ` · ${item.memo}` : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "simulator" ? (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "360px 1fr" }}>
            <section style={panelStyle}>
              <h2 style={headingStyle}>수익 시뮬레이터 설정</h2>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={labelStyle}>
                  기대매출 수익률(인건비 제외)
                  <input
                    type="number"
                    step="0.1"
                    value={settings.expectedProfitMarginRate}
                    onChange={(e) => setSettings({ ...settings, expectedProfitMarginRate: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  예상 세율
                  <input
                    type="number"
                    step="0.1"
                    value={settings.estimatedTaxRate}
                    onChange={(e) => setSettings({ ...settings, estimatedTaxRate: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  예상 월매출
                  <input
                    type="number"
                    value={settings.expectedMonthlyRevenue}
                    onChange={(e) => setSettings({ ...settings, expectedMonthlyRevenue: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </label>
                {settingsMessage ? <div style={{ color: "#94a3b8" }}>{settingsMessage}</div> : null}
                <button onClick={saveSettings} disabled={settingsPending} style={primaryButtonStyle}>
                  {settingsPending ? "저장 중..." : "재무 설정 저장"}
                </button>
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={headingStyle}>월 순수익 예상</h2>
              <div style={{ display: "grid", gap: 14 }}>
                <SimulatorRow label="월 매출 기준" value={`${revenueBase.toLocaleString()}원`} color="#34d399" />
                <SimulatorRow label="지출 합계" value={`-${totalExpense.toLocaleString()}원`} color="#f87171" />
                <SimulatorRow label="인건비 합계" value={`-${totalLaborCost.toLocaleString()}원`} color="#fb923c" />
                <SimulatorRow label="세전 이익" value={`${preTaxProfit.toLocaleString()}원`} color={preTaxProfit >= 0 ? "#cbd5e1" : "#f87171"} />
                <SimulatorRow label="예상 세금" value={`-${Math.round(estimatedTax).toLocaleString()}원`} color="#fbbf24" />
                <SimulatorRow label="순수익" value={`${Math.round(netProfit).toLocaleString()}원`} color={netProfit >= 0 ? "#60a5fa" : "#f87171"} strong />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function getMonthlyScheduledHours(
  schedule: ScheduleSnapshot,
  staffId: string,
  targetYear: number,
  targetMonth: number,
) {
  if (!schedule) return 0;
  const activeSlots = Array.from({ length: (24 * 60) / schedule.timeUnit }, (_, index) => index * schedule.timeUnit);
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  let total = 0;

  for (let date = 1; date <= daysInMonth; date += 1) {
    const dayLabel = DAYS[new Date(targetYear, targetMonth - 1, date).getDay()];
    const slots = activeSlots.filter((slot) => schedule.assignments?.[dayLabel]?.[slot]?.includes(staffId));
    if (slots.length > 0) {
      const gross = (Math.max(...slots) + schedule.timeUnit - Math.min(...slots)) / 60;
      total += gross;
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
  setForm: Dispatch<SetStateAction<{
    type: "REVENUE" | "EXPENSE";
    category: string;
    amount: number;
    inputMode: "AMOUNT" | "RATIO";
    ratioPercent: number;
    memo: string;
    targetDate: string;
  }>>,
) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells: ReactNode[] = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(<div key={`empty-${index}`} style={emptyCellStyle} />);
  }

  for (let date = 1; date <= daysInMonth; date += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    const totals = dailyMap.get(dateKey);
    const active = selectedDate === dateKey;
    cells.push(
      <button
        key={dateKey}
        type="button"
        onClick={() => {
          setSelectedDate(dateKey);
          setForm((prev) => ({ ...prev, targetDate: dateKey }));
        }}
        style={{
          ...calendarCellStyle,
          border: active ? "1px solid #10b981" : "1px solid #1e293b",
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: 12 }}>{date}</div>
        <div style={{ color: "#34d399", fontSize: 12 }}>{totals ? `+${totals.revenue.toLocaleString()}` : "+0"}</div>
        <div style={{ color: "#f87171", fontSize: 12 }}>{totals ? `-${totals.expense.toLocaleString()}` : "-0"}</div>
      </button>,
    );
  }

  return cells;
}

function EntryEditor({
  form,
  setForm,
  error,
  pending,
  onSubmit,
}: {
  form: {
    type: "REVENUE" | "EXPENSE";
    category: string;
    amount: number;
    inputMode: "AMOUNT" | "RATIO";
    ratioPercent: number;
    memo: string;
    targetDate: string;
  };
  setForm: Dispatch<SetStateAction<{
    type: "REVENUE" | "EXPENSE";
    category: string;
    amount: number;
    inputMode: "AMOUNT" | "RATIO";
    ratioPercent: number;
    memo: string;
    targetDate: string;
  }>>;
  error: string;
  pending: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={formGridStyle}>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "REVENUE" | "EXPENSE" })} style={inputStyle}>
          <option value="REVENUE">매출</option>
          <option value="EXPENSE">지출</option>
        </select>
        <input value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} type="date" style={inputStyle} />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="카테고리" style={inputStyle} />
        {form.type === "EXPENSE" ? (
          <select value={form.inputMode} onChange={(e) => setForm({ ...form, inputMode: e.target.value as "AMOUNT" | "RATIO" })} style={inputStyle}>
            <option value="AMOUNT">금액 직접 입력</option>
            <option value="RATIO">매출 대비 %</option>
          </select>
        ) : (
          <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: "#64748b" }}>매출은 금액 입력만 사용</div>
        )}
        {form.type === "EXPENSE" && form.inputMode === "RATIO" ? (
          <input type="number" step="0.1" value={form.ratioPercent} onChange={(e) => setForm({ ...form, ratioPercent: Number(e.target.value) })} placeholder="매출 대비 %" style={inputStyle} />
        ) : (
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="금액" style={inputStyle} />
        )}
        <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
      </div>
      {error ? <div style={{ color: "#fca5a5" }}>{error}</div> : null}
      <button onClick={() => void onSubmit()} disabled={pending} style={primaryButtonStyle}>
        {pending ? "저장 중..." : "재무 항목 저장"}
      </button>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  color,
  helper,
}: {
  icon: ReactNode;
  title: string;
  value: number;
  color: string;
  helper: string;
}) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color, marginBottom: 10 }}>{icon}</div>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value.toLocaleString()}원</div>
      <div style={{ color: "#64748b", marginTop: 6, fontSize: 12 }}>{helper}</div>
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
const heroStyle: CSSProperties = { padding: 24, borderRadius: 24, background: "linear-gradient(180deg, #0f172a 0%, #0b1220 100%)", border: "1px solid #1e293b" };
const panelStyle: CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const metricCardStyle: CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const summaryGridStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
const twoColumnStyle: CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const tabRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const tabStyle: CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer" };
const activeTabStyle: CSSProperties = { ...tabStyle, border: "1px solid #10b981", background: "rgba(16,185,129,0.14)", color: "#d1fae5" };
const inputStyle: CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const miniInputStyle: CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" };
const labelStyle: CSSProperties = { display: "grid", gap: 6, color: "#94a3b8", fontSize: 13 };
const primaryButtonStyle: CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const headingStyle: CSSProperties = { marginTop: 0, marginBottom: 14 };
const summaryRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid #1e293b", background: "#020617" };
const entryRowStyle: CSSProperties = { padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" };
const calendarGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 };
const calendarHeadStyle: CSSProperties = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 };
const calendarCellStyle: CSSProperties = { minHeight: 92, padding: 10, borderRadius: 14, background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left", cursor: "pointer" };
const emptyCellStyle: CSSProperties = { minHeight: 92 };
