import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { canAccess } from "@/lib/permissions";
import type { SystemRole } from "@/types/domain";

const COOKIE_NAME = "biz-manager-session";

type SessionPayload = {
  userId: string;
  storeId: string;
  role: SystemRole;
  loginId: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(required: SystemRole) {
  const session = await requireSession();
  if (!canAccess(required, session.role)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { message: "로그인이 필요합니다. 다시 로그인해 주세요." },
      { status: 401 },
    );
  }

  return session;
}

export async function requireApiRole(required: SystemRole) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { message: "로그인이 필요합니다. 다시 로그인해 주세요." },
      { status: 401 },
    );
  }

  if (!canAccess(required, session.role)) {
    return NextResponse.json(
      { message: "이 작업을 수행할 권한이 없습니다." },
      { status: 403 },
    );
  }

  return session;
}
