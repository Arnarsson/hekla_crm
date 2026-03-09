import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, authenticateMaster, generateSession } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // Mode 1: Email + password (individual accounts)
  if (email && password) {
    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set("hekla_session", user.password_hash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // Mode 2: Master password (backwards compat)
  if (password) {
    if (!authenticateMaster(password)) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("hekla_session", generateSession(password), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ error: "Email and password required" }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("hekla_session");
  return res;
}
