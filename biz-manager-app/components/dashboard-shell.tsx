import Link from "next/link";
import type { DashboardKpi, StoreSummary } from "@/types/domain";

type Props = {
  loginId: string;
  role: string;
  stores: StoreSummary[];
  kpi: DashboardKpi;
};

export function DashboardShell({ loginId, role, stores, kpi }: Props) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "radial-gradient(circle at top right, rgba(16,185,129,0.22), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#34d399", fontSize: 14, marginBottom: 8 }}>Biz Manager Platform</div>
            <h1 style={{ margin: 0, fontSize: 36 }}>매장 운영 통합 대시보드</h1>
            <p style={{ color: "#94a3b8" }}>
              {loginId} 님으로 로그인됨 · 현재 권한 {role}
            </p>
          </div>
          <Link
            href="/dashboard"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "#111827",
              border: "1px solid #1f2937",
            }}
          >
            스케줄/급여 화면으로 이동
          </Link>
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            { label: "월 매출", value: kpi.revenue, color: "#34d399" },
            { label: "월 지출", value: kpi.expense, color: "#f87171" },
            { label: "월 인건비", value: kpi.laborCost, color: "#fb923c" },
            { label: "순이익", value: kpi.profit, color: "#60a5fa" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #1e293b",
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ color: "#94a3b8", marginBottom: 8 }}>{card.label}</div>
              <div style={{ color: card.color, fontSize: 28, fontWeight: 700 }}>
                {card.value.toLocaleString()}원
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid #1e293b",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>등록 매장</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {stores.map((store) => (
                <div
                  key={store.id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "#0f172a",
                    border: "1px solid #1f2937",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{store.name}</div>
                      <div style={{ color: "#94a3b8" }}>
                        코드 {store.code} · 업종 {store.businessType}
                      </div>
                    </div>
                    <Link href="/dashboard" style={{ color: "#34d399" }}>
                      운영하기
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid #1e293b",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>핵심 분석</h2>
            <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
              인건비율은 {kpi.laborRatio.toFixed(1)}%입니다. 매출, 지출, 인건비 데이터를 월 단위로
              저장하면 시간대별 효율 분석과 급여 마감까지 한 화면에서 이어서 볼 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
