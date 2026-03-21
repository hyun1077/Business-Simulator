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
    businessType: "Restaurant",
  });

  const isRegister = mode === "register";

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
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
        setError(result.message ?? "Request failed.");
        return;
      }

      router.push(result.nextPath ?? "/dashboard");
      router.refresh();
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
          {isRegister ? "Create account and choose role" : "Sign in"}
        </div>
        <h1 style={{ margin: 0, fontSize: 34 }}>{isRegister ? "Register" : "Login"}</h1>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Login ID</span>
        <input
          value={form.loginId}
          onChange={(event) => updateField("loginId", event.target.value)}
          placeholder="owner_kevin"
          required
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Password</span>
        <input
          type="password"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="At least 6 characters"
          required
          style={inputStyle}
        />
      </label>

      {isRegister && (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Kevin"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              style={inputStyle}
            >
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Store Code</span>
            <input
              value={form.storeCode}
              onChange={(event) => updateField("storeCode", event.target.value)}
              placeholder="kevin-main"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Store Name</span>
            <input
              value={form.storeName}
              onChange={(event) => updateField("storeName", event.target.value)}
              placeholder="Kevin Kitchen Main"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Business Type</span>
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
        {pending ? "Processing..." : isRegister ? "Create account" : "Login"}
      </button>

      <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center" }}>
        {isRegister ? "Already have an account? " : "Need a new account? "}
        <Link href={isRegister ? "/login" : "/register"} style={{ color: "#34d399" }}>
          {isRegister ? "Go to login" : "Go to register"}
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
