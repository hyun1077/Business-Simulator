import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { readAppData } from "@/lib/file-db";
import { getNextPath } from "@/lib/onboarding";

const bodySchema = z.object({
  loginId: z.string().min(3),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();
  const user = data.users.find((item) => item.loginId === body.loginId);

  if (!user) {
    return NextResponse.json({ message: "Login ID not found." }, { status: 404 });
  }

  const isValid = await verifyPassword(body.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
  }

  const membership = data.memberships.find((item) => item.userId === user.id);
  if (!membership) {
    return NextResponse.json({ message: "No store permission found for this account." }, { status: 403 });
  }

  await createSession({
    userId: user.id,
    storeId: membership.storeId,
    role: membership.role,
    loginId: user.loginId,
  });

  return NextResponse.json({
    message: "Logged in.",
    nextPath: getNextPath(data, membership.storeId, membership.role),
    user: {
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      role: membership.role,
    },
  });
}
