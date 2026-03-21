"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import type { SystemRole } from "@/types/domain";

type FinanceItem = {
  id: string;
  type: "REVENUE" | "EXPENSE";
  category: string;
  amount: number;
  memo: string | null;
  targetDate: string;
};

type FinanceTab = "overview" | "revenue" | "expense" | "entry";
type RangeFilter = "all" | "day" | "week" | "month";

export function FinanceManager({
  initialItems,
  role,
}: {
  initialItems: FinanceItem[];
  role: SystemRole;
}) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("month");
  const [form, setForm] = useState({
    type: "REVENUE" as "REVENUE" | "EXPENSE",
    category: "",
    amount: 0,
    memo: "",
    targetDate: new Date().toISOString().slice(0, 10),
  });

  const filteredItems = useMemo(() => {
    const now = new Date();
    return items.filter((item) => {
      if (rangeFilter === "all") return true;
      const target = new Date(item.targetDate);
      if (rangeFilter === "day") return target.toDateString() === now.toDateString();
      if (rangeFilter === "week") {
        const diff = now.getTime() - target.getTime();
        return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
      }
      return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
    });
  }, [items, rangeFilter]);

  const revenueItems = useMemo(() => filteredItems.filter((item) => item.type === "REVENUE"), [filteredItems]);
  const expenseItems = useMemo(() => filteredItems.filter((item) => item.type === "EXPENSE"), [filteredItems]);
  const totalRevenue = useMemo(() => revenueItems.reduce((sum, item) => sum + item.amount, 0), [revenueItems]);
  const totalExpense = useMemo(() => expenseItems.reduce((sum, item) => sum + item.amount, 0), [expenseItems]);
  const profit = totalRevenue - totalExpense;
  const topRevenue = [...revenueItems].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const topExpense = [...expenseItems].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const categorySummary = useMemo(() => {
    const bucket = new Map<string, number>();
    filteredItems.forEach((item) => {
      const signed = item.type === "REVENUE" ? item.amount : -item.amount;
      bucket.set(item.category, (bucket.get(item.category) ?? 0) + signed);
    });
    return [...bucket.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [filteredItems]);

  async function submit() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        memo: "",
        targetDate: new Date().toISOString().slice(0, 10),
      });
      setActiveTab(result.entry.type === "REVENUE" ? "revenue" : "expense");
    });
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <DashboardTabs current="/dashboard/finance" role={role} />

        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ color: "#34d399", marginBottom: 8 }}>재무 관리 센터</div>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>매출 · 지출 관리</h1>
          <p style={{ color: "#94a3b8", marginBottom: 0 }}>
            매출과 지출을 기간별로 나눠 보고, 카테고리별 흐름까지 한 화면에서 확인할 수 있습니다.
          </p>
        </div>

        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ color: "#94a3b8", marginBottom: 10 }}>기간 필터</div>
          <div style={tabRowStyle}>
            {[
              ["all", "전체"],
              ["day", "오늘"],
              ["week", "최근 7일"],
              ["month", "이번 달"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setRangeFilter(id as RangeFilter)} style={rangeFilter === id ? activeTabStyle : tabStyle}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={tabRowStyle}>
          {[
            ["overview", "요약"],
            ["revenue", "매출"],
            ["expense", "지출"],
            ["entry", "새 항목"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id as FinanceTab)} style={activeTab === id ? activeTabStyle : tabStyle}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section style={metricGridStyle}>
              <MetricCard title="총매출" value={totalRevenue} color="#34d399" />
              <MetricCard title="총지출" value={totalExpense} color="#f87171" />
              <MetricCard title="순손익" value={profit} color={profit >= 0 ? "#60a5fa" : "#f87171"} />
            </section>
            <section style={twoColumnStyle}>
              <div style={panelStyle}>
                <h2 style={headingStyle}>상위 매출 카테고리</h2>
                <EntryList items={topRevenue} emptyLabel="매출 항목이 아직 없습니다." />
              </div>
              <div style={panelStyle}>
                <h2 style={headingStyle}>상위 지출 카테고리</h2>
                <EntryList items={topExpense} emptyLabel="지출 항목이 아직 없습니다." />
              </div>
            </section>
            <section style={panelStyle}>
              <h2 style={headingStyle}>카테고리 순효과</h2>
              {categorySummary.length === 0 ? (
                <div style={{ color: "#64748b" }}>현재 기간에 집계할 카테고리 데이터가 없습니다.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {categorySummary.map((item) => (
                    <div key={item.category} style={summaryRowStyle}>
                      <strong>{item.category}</strong>
                      <span style={{ color: item.amount >= 0 ? "#34d399" : "#f87171" }}>
                        {item.amount >= 0 ? "+" : ""}
                        {item.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "revenue" ? (
          <section style={panelStyle}>
            <h2 style={headingStyle}>매출 항목</h2>
            <EntryList items={revenueItems} emptyLabel="매출 항목이 아직 없습니다." />
          </section>
        ) : null}

        {activeTab === "expense" ? (
          <section style={panelStyle}>
            <h2 style={headingStyle}>지출 항목</h2>
            <EntryList items={expenseItems} emptyLabel="지출 항목이 아직 없습니다." />
          </section>
        ) : null}

        {activeTab === "entry" ? (
          <section style={panelStyle}>
            <h2 style={headingStyle}>새 재무 항목 추가</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "REVENUE" | "EXPENSE" })} style={inputStyle}>
                <option value="REVENUE">매출</option>
                <option value="EXPENSE">지출</option>
              </select>
              <input value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} type="date" style={inputStyle} />
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="카테고리" style={inputStyle} />
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="금액" style={inputStyle} />
              <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            </div>
            {error ? <div style={{ color: "#fca5a5", marginTop: 12 }}>{error}</div> : null}
            <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
              <button onClick={submit} disabled={pending} style={primaryButtonStyle}>
                {pending ? "저장 중..." : "항목 저장"}
              </button>
              <Link href="/dashboard/scheduler" style={continueLinkStyle}>
                스케줄 작성으로 이동
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value.toLocaleString()}원</div>
    </div>
  );
}

function EntryList({ items, emptyLabel }: { items: FinanceItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <div style={{ color: "#64748b" }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item.id} style={entryRowStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <strong>{item.category}</strong>
            <span style={{ color: item.type === "REVENUE" ? "#34d399" : "#f87171" }}>
              {item.type === "REVENUE" ? "+" : "-"}
              {item.amount.toLocaleString()}원
            </span>
          </div>
          <div style={{ color: "#94a3b8", marginTop: 8 }}>
            {item.targetDate.slice(0, 10)}
            {item.memo ? ` · ${item.memo}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#020617", padding: 24 };
const panelStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const inputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const primaryButtonStyle: React.CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const continueLinkStyle: React.CSSProperties = { display: "inline-block", padding: "12px 16px", background: "#111827", border: "1px solid #334155", borderRadius: 12, color: "#e2e8f0", textDecoration: "none" };
const metricGridStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
const twoColumnStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" };
const metricCardStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const tabRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer" };
const activeTabStyle: React.CSSProperties = { ...tabStyle, border: "1px solid #10b981", background: "rgba(16,185,129,0.14)", color: "#d1fae5" };
const headingStyle: React.CSSProperties = { marginTop: 0, marginBottom: 14 };
const summaryRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid #1e293b", background: "#020617" };
const entryRowStyle: React.CSSProperties = { padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" };
