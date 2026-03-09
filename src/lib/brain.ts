/**
 * Brain Service Client — connects to Linux server for heavy AI processing
 * Falls back to local logic when brain is offline
 */

const BRAIN_API_URL = process.env.BRAIN_API_URL || "http://100.83.83.58:3778";

let cachedStatus: { online: boolean; checkedAt: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

export async function isBrainOnline(): Promise<boolean> {
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < CACHE_TTL) {
    return cachedStatus.online;
  }

  try {
    const res = await fetch(`${BRAIN_API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const online = res.ok;
    cachedStatus = { online, checkedAt: Date.now() };
    return online;
  } catch {
    cachedStatus = { online: false, checkedAt: Date.now() };
    return false;
  }
}

export async function brainRequest<T>(
  path: string,
  data: unknown,
  fallback: () => T | Promise<T>
): Promise<T> {
  const online = await isBrainOnline();

  if (online) {
    try {
      const res = await fetch(`${BRAIN_API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(120_000),
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      console.error(`Brain request to ${path} failed: ${res.status}`);
    } catch (err) {
      console.error(`Brain request to ${path} error:`, err);
      // Invalidate cache on connection error
      cachedStatus = { online: false, checkedAt: Date.now() };
    }
  }

  return fallback();
}

export function getBrainUrl(): string {
  return BRAIN_API_URL;
}
