import Link from "next/link";
import type { SystemRole } from "@/types/domain";
import { canAccess } from "@/lib/permissions";

type TabHref = "/dashboard" | "/dashboard/staff" | "/dashboard/finance" | "/dashboard/scheduler";

const tabs: Array<{
  href: TabHref;
  label: string;
  minRole: SystemRole;
}> = [
  { href: "/dashboard", label: "Dashboard", minRole: "STAFF" },
  { href: "/dashboard/scheduler", label: "Scheduler", minRole: "STAFF" },
  { href: "/dashboard/staff", label: "Staff", minRole: "MANAGER" },
  { href: "/dashboard/finance", label: "Finance", minRole: "OWNER" },
];

export function DashboardTabs({
  current,
  role,
}: {
  current: TabHref;
  role: SystemRole;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 18,
      }}
    >
      {tabs
        .filter((tab) => canAccess(tab.minRole, role))
        .map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              textDecoration: "none",
              border: current === tab.href ? "1px solid #10b981" : "1px solid #334155",
              background: current === tab.href ? "rgba(16,185,129,0.14)" : "#111827",
              color: current === tab.href ? "#d1fae5" : "#cbd5e1",
              fontWeight: 600,
            }}
          >
            {tab.label}
          </Link>
        ))}
    </div>
  );
}
