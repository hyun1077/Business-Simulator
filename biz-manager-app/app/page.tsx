import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(96,165,250,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.2), transparent 26%), #020617",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          padding: 32,
          borderRadius: 24,
          border: "1px solid #1e293b",
          background: "rgba(15,23,42,0.9)",
        }}
      >
        <div style={{ color: "#34d399", marginBottom: 12 }}>자영업자 관리 플랫폼</div>
        <h1 style={{ marginTop: 0, fontSize: 44 }}>로그인 가능한 운영 관리 앱</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.7 }}>
          여러 사용자가 로그인하고, 아이디 규칙과 DB 역할에 따라 권한을 자동 부여받으며, 직원,
          매출/지출, 스케줄, 급여 분석으로 확장할 수 있는 서버형 프로그램입니다.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <Link
            href="/login"
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "#10b981",
              color: "#052e16",
              fontWeight: 700,
            }}
          >
            로그인
          </Link>
          <Link
            href="/register"
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "#111827",
              border: "1px solid #334155",
            }}
          >
            회원가입
          </Link>
        </div>
      </div>
    </main>
  );
}
