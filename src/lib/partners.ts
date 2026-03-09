/**
 * Partner access system — simple token-based auth for shared views.
 * Partners get read-only access to activity logs and limited CRM views.
 *
 * Tokens stored in DB alongside other data.
 */

import { readStoreAsync, writeStoreAsync } from "./db";

export interface Partner {
  id: string;
  name: string;
  email: string;
  token: string;
  role: "viewer" | "contributor";
  created_at: string;
  last_login?: string;
}

async function getPartners(): Promise<Partner[]> {
  const store = await readStoreAsync() as unknown as Record<string, unknown>;
  return (store.partners as Partner[]) || [];
}

async function savePartners(partners: Partner[]) {
  const store = await readStoreAsync() as unknown as Record<string, unknown>;
  store.partners = partners;
  await writeStoreAsync(store as unknown as Awaited<ReturnType<typeof readStoreAsync>>);
}

export async function createPartner(name: string, email: string, role: "viewer" | "contributor" = "viewer"): Promise<Partner> {
  const partners = await getPartners();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const partner: Partner = {
    id: crypto.randomUUID(),
    name,
    email,
    token,
    role,
    created_at: new Date().toISOString(),
  };
  partners.push(partner);
  await savePartners(partners);
  return partner;
}

export async function listPartners(): Promise<Partner[]> {
  return getPartners();
}

export async function validateToken(token: string): Promise<Partner | null> {
  const partners = await getPartners();
  const partner = partners.find((p) => p.token === token);
  if (partner) {
    partner.last_login = new Date().toISOString();
    await savePartners(partners);
  }
  return partner || null;
}

export async function deletePartner(id: string): Promise<boolean> {
  const partners = await getPartners();
  const idx = partners.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  partners.splice(idx, 1);
  await savePartners(partners);
  return true;
}

export async function regenerateToken(id: string): Promise<Partner | null> {
  const partners = await getPartners();
  const partner = partners.find((p) => p.id === id);
  if (!partner) return null;
  partner.token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  await savePartners(partners);
  return partner;
}
