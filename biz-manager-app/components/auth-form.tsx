"use client";

import type React from "react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type RegisterRole = "OWNER" | "MANAGER" | "STAFF";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    loginId: "",
    password: "",
    name: "",
    role: "OWNER" as RegisterRole,
    storeCode: "",
    storeName: "",
    businessType: "외식업",
  });

  const isRegister = mode === "register";

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
        const payload = isRegister
          ? form
          : {
              loginId: form.loginId,
              password: form.password,
            };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          setError(result.message ?? "요청 처리에 실패했습니다.");
          return;
        }

        router.push(result.nextPath ?? "/dashboard");
        router.refresh();
      } catch {
        setError("서버와 통신하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 14,
        padding: 24,
        borderRadius: 20,
        border: "1px solid #1e293b",
        background: "rgba(15,23,42,0.92)",
      }}
    >
      <div>
        <div style={{ color: "#34d399", fontSize: 14, marginBottom: 8 }}>
          {isRegister ? "계정 생성과 매장 연결" : "로그인"}
        </div>
        <h1 style={{ margin: 0, fontSize: 34 }}>{isRegister ? "회원가입" : "로그인"}</h1>
        {!isRegister ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
            테스트 계정: `kevin` / `kevin1234`
          </p>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>아이디</span>
        <input
          value={form.loginId}
          onChange={(event) => updateField("loginId", event.target.value)}
          placeholder="owner_kevin"
          required
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>비밀번호</span>
        <input
          type="password"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="6자 이상"
          required
          style={inputStyle}
        />
      </label>

      {isRegister && (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            <span>이름</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="홍길동"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>역할</span>
            <select
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              style={inputStyle}
            >
              <option value="OWNER">사장</option>
              <option value="MANAGER">매니저</option>
              <option value="STAFF">직원</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>매장 코드</span>
            <input
              value={form.storeCode}
              onChange={(event) => updateField("storeCode", event.target.value)}
              placeholder="kevin-main"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>매장 이름</span>
            <input
              value={form.storeName}
              onChange={(event) => updateField("storeName", event.target.value)}
              placeholder="케빈키친 본점"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>업종</span>
            <input
              value={form.businessType}
              onChange={(event) => updateField("businessType", event.target.value)}
              required
              style={inputStyle}
            />
          </label>
        </>
      )}

      {error ? <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div> : null}

      <button
        type="submit"
        disabled={pending}
        style={{
          ...inputStyle,
          cursor: pending ? "wait" : "pointer",
          background: "#10b981",
          color: "#052e16",
          fontWeight: 700,
          border: "none",
        }}
      >
        {pending ? "처리 중..." : isRegister ? "계정 만들기" : "로그인"}
      </button>

      <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center" }}>
        {isRegister ? "이미 계정이 있나요? " : "처음 사용하시나요? "}
        <Link href={isRegister ? "/login" : "/register"} style={{ color: "#34d399" }}>
          {isRegister ? "로그인으로 이동" : "회원가입으로 이동"}
        </Link>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#020617",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 12,
  padding: "12px 14px",
};
