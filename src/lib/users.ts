/**
 * Team member accounts — individual logins with full admin access.
 * Stored in Redis/JSON DB alongside other data.
 */

import { readStoreAsync, writeStoreAsync } from "./db";

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "admin";
  created_at: string;
  last_login?: string;
}

function hashPw(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const char = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hk_${Math.abs(hash).toString(36)}`;
}

async function getUsers(): Promise<TeamUser[]> {
  const store = await readStoreAsync() as unknown as Record<string, unknown>;
  return (store.users as TeamUser[]) || [];
}

async function saveUsers(users: TeamUser[]) {
  const store = await readStoreAsync() as unknown as Record<string, unknown>;
  store.users = users;
  await writeStoreAsync(store as unknown as Awaited<ReturnType<typeof readStoreAsync>>);
}

export async function createUser(name: string, email: string, password: string): Promise<Omit<TeamUser, "password_hash">> {
  const users = await getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Email already exists");
  }
  const user: TeamUser = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    password_hash: hashPw(password),
    role: "admin",
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(users);
  const { password_hash, ...safe } = user;
  return safe;
}

export async function authenticateUser(email: string, password: string): Promise<TeamUser | null> {
  const users = await getUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password_hash === hashPw(password)
  );
  if (user) {
    user.last_login = new Date().toISOString();
    await saveUsers(users);
  }
  return user || null;
}

/** Authenticate by master password (backwards compat) */
export function authenticateMaster(password: string): boolean {
  const expected = process.env.AUTH_PASSWORD || "hekla2024";
  return password === expected;
}

/** Generate session token from user or master password */
export function generateSession(identifier: string): string {
  return hashPw(identifier);
}

/** Validate a session cookie — checks against master pw hash OR any user hash */
export async function validateSession(session: string): Promise<boolean> {
  const masterPw = process.env.AUTH_PASSWORD || "hekla2024";
  if (session === hashPw(masterPw)) return true;

  const users = await getUsers();
  return users.some((u) => u.password_hash === session);
}

export async function listUsers(): Promise<Omit<TeamUser, "password_hash">[]> {
  const users = await getUsers();
  return users.map(({ password_hash, ...u }) => u);
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  users.splice(idx, 1);
  await saveUsers(users);
  return true;
}
