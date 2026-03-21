import Link from "next/link";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { canAccess } from "@/lib/permissions";
import type { DashboardKpi, StoreSummary, SystemRole } from "@/types/domain";

type StepHref = "/dashboard/staff" | "/dashboard/finance" | "/dashboard/scheduler";

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
  const nextSteps: Array<{
    title: string;
    description: string;
    href: StepHref;
    done: boolean;
    minRole: SystemRole;
  }> = [
    {
      title: "Register staff",
      description: "Add employees first so schedules and payroll connect to real people.",
      href: "/dashboard/staff" as StepHref,
      done: staffCount > 0,
      minRole: "MANAGER" as SystemRole,
    },
    {
      title: "Add revenue and expenses",
      description: "Enter finance data so profit and cost analysis become useful.",
      href: "/dashboard/finance" as StepHref,
      done: financeCount > 0,
      minRole: "OWNER" as SystemRole,
    },
    {
      title: "Build the schedule",
      description: "Assign shifts and review labor efficiency by hour.",
      href: "/dashboard/scheduler" as StepHref,
      done: false,
      minRole: "STAFF" as SystemRole,
    },
  ].filter((step) => canAccess(step.minRole, role));

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
          <h1 style={{ margin: 0, fontSize: 34 }}>Operations Dashboard</h1>
          <p style={{ color: "#94a3b8" }}>
            {userName} ({loginId}) · role {role} · store code {store.code}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            {canAccess("MANAGER", role) ? (
              <Link href="/dashboard/staff" style={primaryLinkStyle}>
                Staff setup
              </Link>
            ) : null}
            {canAccess("OWNER", role) ? (
              <Link href="/dashboard/finance" style={secondaryLinkStyle}>
                Finance setup
              </Link>
            ) : null}
            <Link href="/dashboard/scheduler" style={secondaryLinkStyle}>
              Scheduler
            </Link>
            <form action="/api/auth/logout" method="post">
              <button style={dangerButtonStyle}>Logout</button>
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
            ["Revenue", kpi.revenue, "#34d399"],
            ["Expense", kpi.expense, "#f87171"],
            ["Labor", kpi.laborCost, "#fb923c"],
            ["Profit", kpi.profit, "#60a5fa"],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={metricCardStyle}>
              <div style={{ color: "#94a3b8", marginBottom: 8 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: String(color) }}>
                {Number(value).toLocaleString()} KRW
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 16,
          }}
        >
          <div style={panelStyle}>
            <h2 style={sectionHeadingStyle}>Next Steps</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {nextSteps.map((step, index) => (
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
                    {step.done ? "Completed" : `Step ${index + 1}`} · {step.title}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{step.description}</div>
                </Link>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={sectionHeadingStyle}>Role Scope</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <RoleBadge role="OWNER" active={role === "OWNER"} description="Can manage finance, staff, and scheduling." />
              <RoleBadge role="MANAGER" active={role === "MANAGER"} description="Can manage staff and scheduling, but not finance." />
              <RoleBadge role="STAFF" active={role === "STAFF"} description="Can view and work with scheduling only." />
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
      <div style={{ fontWeight: 700 }}>{active ? "Current role" : "Available role"} · {role}</div>
      <div style={{ color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 24,
  background: "rgba(15,23,42,0.92)",
  border: "1px solid #1e293b",
};

const metricCardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 20,
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const sectionHeadingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
};

const primaryLinkStyle: React.CSSProperties = {
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

const secondaryLinkStyle: React.CSSProperties = {
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

const dangerButtonStyle: React.CSSProperties = {
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
