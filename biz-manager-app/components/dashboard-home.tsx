import type { CSSProperties } from "react";
import Link from "next/link";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { canAccess } from "@/lib/permissions";
import type { DashboardKpi, StoreSummary, SystemRole } from "@/types/domain";

type StepHref = "/dashboard/staff" | "/dashboard/finance" | "/dashboard/scheduler";

type NextStep = {
  title: string;
  description: string;
  href: StepHref;
  done: boolean;
  minRole: SystemRole;
};

type Props = {
  userName: string;
  loginId: string;
  role: SystemRole;
  store: StoreSummary;
  kpi: DashboardKpi;
  staffCount: number;
  financeCount: number;
};

export function DashboardHome({
  userName,
  loginId,
  role,
  store,
  kpi,
  staffCount,
  financeCount,
}: Props) {
  const nextSteps = [
    {
      title: "직원 등록",
      description: "직원 정보를 먼저 등록하면 스케줄 배정과 급여 계산이 자연스럽게 이어집니다.",
      href: "/dashboard/staff",
      done: staffCount > 0,
      minRole: "MANAGER",
    },
    {
      title: "매출·지출 입력",
      description: "재무 데이터를 입력해야 손익과 인건비 비율 분석이 정확해집니다.",
      href: "/dashboard/finance",
      done: financeCount > 0,
      minRole: "OWNER",
    },
    {
      title: "스케줄 작성",
      description: "직원을 배정하고 시간대별 운영 효율을 확인할 수 있습니다.",
      href: "/dashboard/scheduler",
      done: false,
      minRole: "STAFF",
    },
  ] satisfies NextStep[];

  const visibleSteps = nextSteps.filter((step) => canAccess(step.minRole, role));

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(16,185,129,0.12), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 18 }}>
        <DashboardTabs current="/dashboard" role={role} />

        <section style={panelStyle}>
          <div style={{ color: "#34d399", marginBottom: 8 }}>{store.name}</div>
          <h1 style={{ margin: 0, fontSize: 34 }}>운영 대시보드</h1>
          <p style={{ color: "#94a3b8" }}>
            {userName} ({loginId}) · 권한 {role} · 매장 코드 {store.code}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            {canAccess("MANAGER", role) ? (
              <Link href="/dashboard/staff" style={primaryLinkStyle}>
                직원 관리
              </Link>
            ) : null}
            {canAccess("OWNER", role) ? (
              <Link href="/dashboard/finance" style={secondaryLinkStyle}>
                재무 관리
              </Link>
            ) : null}
            <Link href="/dashboard/scheduler" style={secondaryLinkStyle}>
              스케줄 작성
            </Link>
            <form action="/api/auth/logout" method="post">
              <button style={dangerButtonStyle}>로그아웃</button>
            </form>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[
            ["총매출", kpi.revenue, "#34d399"],
            ["총지출", kpi.expense, "#f87171"],
            ["예상 인건비", kpi.laborCost, "#fb923c"],
            ["예상 순이익", kpi.profit, "#60a5fa"],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={metricCardStyle}>
              <div style={{ color: "#94a3b8", marginBottom: 8 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: String(color) }}>
                {Number(value).toLocaleString()}원
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div style={metricCardStyle}>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>등록 직원 수</div>
            <div style={{ fontWeight: 700, fontSize: 28 }}>{staffCount}명</div>
          </div>
          <div style={metricCardStyle}>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>재무 입력 건수</div>
            <div style={{ fontWeight: 700, fontSize: 28 }}>{financeCount}건</div>
          </div>
          <div style={metricCardStyle}>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>업종</div>
            <div style={{ fontWeight: 700, fontSize: 28 }}>{store.businessType}</div>
          </div>
          <div style={metricCardStyle}>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>인건비율</div>
            <div style={{ fontWeight: 700, fontSize: 28 }}>{kpi.laborRatio.toFixed(1)}%</div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 16,
          }}
        >
          <div style={panelStyle}>
            <h2 style={sectionHeadingStyle}>다음 단계</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {visibleSteps.map((step, index) => (
                <Link
                  key={step.title}
                  href={step.href}
                  style={{
                    display: "block",
                    padding: 16,
                    borderRadius: 18,
                    border: "1px solid #1e293b",
                    background: step.done ? "rgba(16,185,129,0.12)" : "#020617",
                    textDecoration: "none",
                    color: "#e2e8f0",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {step.done ? "완료" : `단계 ${index + 1}`} · {step.title}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{step.description}</div>
                </Link>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={sectionHeadingStyle}>권한 안내</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <RoleBadge
                role="OWNER"
                active={role === "OWNER"}
                description="재무, 직원, 스케줄, 운영 분석 전체를 관리할 수 있습니다."
              />
              <RoleBadge
                role="MANAGER"
                active={role === "MANAGER"}
                description="직원과 스케줄을 관리할 수 있지만 재무 화면은 수정할 수 없습니다."
              />
              <RoleBadge
                role="STAFF"
                active={role === "STAFF"}
                description="개인 업무 확인과 스케줄 확인 중심으로 사용할 수 있습니다."
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RoleBadge({
  role,
  active,
  description,
}: {
  role: SystemRole;
  active: boolean;
  description: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        border: active ? "1px solid #34d399" : "1px solid #1e293b",
        background: active ? "rgba(16,185,129,0.1)" : "#020617",
      }}
    >
      <div style={{ fontWeight: 700 }}>{active ? "현재 권한" : "권한"} · {role}</div>
      <div style={{ color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  padding: 24,
  borderRadius: 24,
  background: "rgba(15,23,42,0.92)",
  border: "1px solid #1e293b",
};

const metricCardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 20,
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const sectionHeadingStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#10b981",
  color: "#052e16",
  border: "1px solid #10b981",
  textDecoration: "none",
};

const secondaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#111827",
  color: "#e2e8f0",
  border: "1px solid #334155",
  textDecoration: "none",
};

const dangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#7f1d1d",
  color: "#fee2e2",
  border: "1px solid #7f1d1d",
  cursor: "pointer",
};
