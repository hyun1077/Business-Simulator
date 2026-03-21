import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { createId, readAppData, writeAppData } from "@/lib/file-db";
import { getNextPath } from "@/lib/onboarding";
import { inferRoleFromLoginId } from "@/lib/permissions";

const bodySchema = z.object({
  loginId: z.string().min(3),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
  storeCode: z.string().min(2),
  storeName: z.string().min(1),
  businessType: z.string().min(1),
});

export async function POST(request: Request) {
  const body = bodySchema.parse(await request.json());
  const data = await readAppData();

  const existingUser = data.users.find((user) => user.loginId === body.loginId);
  if (existingUser) {
    return NextResponse.json({ message: "This login ID is already in use." }, { status: 409 });
  }

  const role = body.role ?? inferRoleFromLoginId(body.loginId);
  const passwordHash = await hashPassword(body.password);
  const userId = createId();

  const existingStore = data.stores.find((item) => item.code === body.storeCode);
  const store =
    existingStore ??
    {
      id: createId(),
      code: body.storeCode,
      name: body.storeName,
      businessType: body.businessType,
      ownerUserId: null,
    };

  const user = {
    id: userId,
    loginId: body.loginId,
    name: body.name,
    passwordHash,
    systemRole: role,
  } as const;

  if (!existingStore) {
    data.stores.push(store);
  }

  if (role === "OWNER") {
    store.ownerUserId = userId;
  }

  data.users.push(user);
  data.memberships.push({
    userId,
    storeId: store.id,
    role,
  });
  await writeAppData(data);

  await createSession({
    userId,
    storeId: store.id,
    role,
    loginId: body.loginId,
  });

  return NextResponse.json({
    message: "Registration completed.",
    nextPath: getNextPath(data, store.id, role),
    user: {
      id: userId,
      loginId: body.loginId,
      role,
    },
  });
}
