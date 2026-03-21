import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "radial-gradient(circle at top left, rgba(96,165,250,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.2), transparent 26%), #020617",
};
