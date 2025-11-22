const BASE = process.env.EXPO_PUBLIC_API_BASE_URL!;
async function asJson(r: Response) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${r.status}`);
  }
  return data;
}

export const scannerApi = {
  resolveEvent: async (code: string, seasonId?: string) => {
    const qs = new URLSearchParams();
    if (code) qs.set("code", code);
    if (seasonId) qs.set("seasonId", seasonId);
    const r = await fetch(`${BASE}/api/scanner/resolve-event?${qs.toString()}`);
    return asJson(r) as Promise<{ ok: true; item: { seasonId: string|null; eventId: string; name: string; date: string; time: string; venue: string; status: string; code: string|null } }>;
  },
  scanTicket: async (seasonId: string, eventId: string, ticketCode: string, deviceId?: string) => {
    const r = await fetch(`${BASE}/api/scanner/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonId, eventId, ticketCode, deviceId }),
    });
    return asJson(r) as Promise<{ ok: true; ticketId: string; status: "verified" }>;
  },
};
