"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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

export function StaffManager({
  initialStaff,
  role,
}: {
  initialStaff: StaffMember[];
  role: SystemRole;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [staff, setStaff] = useState(initialStaff);
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
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <DashboardTabs current="/dashboard/staff" role={role} />

        <div style={summaryGridStyle}>
          <SummaryCard label="등록 직원 수" value={`${staff.length}명`} />
          <SummaryCard label="평균 목표시급" value={`${avgTargetWage.toLocaleString()}원`} />
          <SummaryCard label="총 처리용량" value={`${totalCapacity.toLocaleString()}`} />
        </div>

        <div style={containerStyle}>
          <div style={panelStyle}>
            <h1 style={{ marginTop: 0 }}>직원 관리</h1>
            <p style={{ color: "#94a3b8" }}>
              실제 근무자 정보를 등록하면 스케줄과 인건비 계산에 그대로 연결됩니다.
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

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>등록된 직원</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {staff.map((member) => (
                <div key={member.id} style={{ padding: 16, borderRadius: 16, border: "1px solid #1e293b", background: "#020617" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{member.name}</strong>
                    <span style={{ color: member.color }}>{member.color}</span>
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: 8 }}>
                    기본 {member.baseWage.toLocaleString()}원 · 목표 {member.targetWage.toLocaleString()}원 · 처리용량 {member.capacity.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
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

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#020617", padding: 24 };
const summaryGridStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 };
const containerStyle: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "360px 1fr" };
const panelStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const summaryCardStyle: React.CSSProperties = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" };
const inputStyle: React.CSSProperties = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" };
const primaryButtonStyle: React.CSSProperties = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" };
const continueLinkStyle: React.CSSProperties = { display: "inline-block", padding: "12px 16px", background: "#111827", border: "1px solid #334155", borderRadius: 12, color: "#e2e8f0", textDecoration: "none" };
