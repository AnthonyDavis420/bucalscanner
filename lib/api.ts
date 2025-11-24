import Constants from "expo-constants";

export type EventDetails = {
  eventId?: string;
  seasonId?: string;
  name: string;
  date: string;
  time?: string;
  status?: string;
  venue: {
    name: string;
    city?: string;
    location?: string;
    imageUrl?: string | null;
    imagePath?: string | null;
  };
  seats: Array<{
    id?: string | number;
    sectionName: string;
    teamSide: string;
    ticketPrice: number;
    teamRef?: { teamId: string; teamName: string | null } | null;
  }>;
};

export type CreateTicketPayload = {
  fullName: string;
  age: string;
  number?: string;
  section: string;
  side: string;
  isChild: boolean;
  isPriority: boolean;
};

export type TicketSummary = {
  id: string;
  ticketUrl: string | null;
  assignedName: string | null;
  sectionName: string | null;
  sideLabel: string | null;
  type: "adult" | "child" | "priority";
  price: number | null;
  bundleId?: string | null;
  parentTicketId?: string | null;
  status?:
    | "active"
    | "pending"
    | "redeemed"
    | "invalid"
    | "expired"
    | "cancelled"
    | string
    | null;
  role?: string | null;
  url?: string | null;
  ticket?: { ticketUrl?: string | null; ticketPath?: string | null } | null;
};

export type VoucherSummary = {
  id: string;
  status?: string | null;
  name?: string | null;
  code?: string | null;
  issuer?: string | null;
  maxUses?: number | null;
  usedCount?: number | null;
  assignedName?: string | null;
  assignedType?: string | null;
  ticketUrl?: string | null;
  sectionName?: string | null;
  teamSide?: string | null;
  validUntil?: string | null;
  notes?: string | null;
};

export type ResolveEventItem = {
  eventId: string;
  seasonId: string;
  name: string;
  date?: string;
  venue?: { name: string; imageUrl?: string | null } | null;
};

type OkItem<T> = { ok: true; item: T };

function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExtra =
    (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_API_BASE_URL ||
    (Constants as any)?.manifest2?.extra?.EXPO_PUBLIC_API_BASE_URL;
  const base = (fromEnv || fromExtra || "").trim();
  if (!base)
    throw new Error(
      "Missing EXPO_PUBLIC_API_BASE_URL. Define it in app.json -> expo.extra."
    );
  return base.replace(/\/+$/, "");
}

function getScannerKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SCANNER_KEY;
  const fromExtra =
    (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_SCANNER_KEY ||
    (Constants as any)?.manifest2?.extra?.EXPO_PUBLIC_SCANNER_KEY;
  const key = (fromEnv || fromExtra || "").trim();
  return key ? key : null;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const key = getScannerKey();
  if (key) {
    headers["x-scanner-key"] = key;
    headers["x-api-key"] = key;
    headers["authorization"] = `Bearer ${key}`;
  }
  return headers;
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const auth = await buildAuthHeaders();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...auth,
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const auth = await buildAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function patchJson<T>(path: string, body: any): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const auth = await buildAuthHeaders();
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function delJson<T>(path: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const auth = await buildAuthHeaders();
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json", ...auth },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const scannerApi = {
  async eventDetails(
    eventId: string,
    seasonId?: string
  ): Promise<OkItem<EventDetails>> {
    const id = (eventId || "").trim();
    const sid = (seasonId || "").trim();
    if (!id) throw new Error("Missing event id");
    let resp: OkItem<EventDetails> | null = null;
    if (sid) {
      try {
        const qs = new URLSearchParams({ seasonId: sid }).toString();
        resp = await getJson<OkItem<EventDetails>>(
          `/api/scanner/event-details/${encodeURIComponent(id)}?${qs}`
        );
      } catch {}
    }
    if (!resp) {
      resp = await getJson<OkItem<EventDetails>>(
        `/api/scanner/event-details?code=${encodeURIComponent(id)}`
      );
    }
    return resp;
  },

  async createTickets(
    eventId: string,
    seasonId: string,
    tickets: CreateTicketPayload[]
  ): Promise<{ ok: true; ids?: string[]; items?: TicketSummary[] }> {
    return postJson<{ ok: true; ids?: string[]; items?: TicketSummary[] }>(
      `/api/scanner/event-details/${encodeURIComponent(eventId)}/tickets`,
      { seasonId, tickets }
    );
  },

  async fetchTickets(
    eventId: string,
    seasonId: string,
    ids: string[]
  ): Promise<{ ok: true; items: TicketSummary[] }> {
    const qs = new URLSearchParams({ seasonId, ids: ids.join(",") }).toString();
    return getJson<{ ok: true; items: TicketSummary[] }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/tickets?${qs}`
    );
  },

  async fetchVoucher(
    eventId: string,
    seasonId: string,
    voucherId: string
  ): Promise<{ ok: true; item: VoucherSummary }> {
    const qs = new URLSearchParams({ seasonId, voucherId }).toString();
    const raw = await getJson<{ ok: true; item: any }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/vouchers?${qs}`
    );
    const src = raw.item ?? raw;

    const maxUsesSrc =
      src.maxUses ?? src.max_uses ?? src.maxPax ?? src.max_pax ?? null;
    const maxUsesNum = maxUsesSrc != null ? Number(maxUsesSrc) : null;
    const maxUses =
      maxUsesNum != null && Number.isFinite(maxUsesNum) ? maxUsesNum : null;

    const usedSrc =
      src.usedCount ?? src.used_count ?? src.uses ?? src.useCount ?? null;
    const usedNum = usedSrc != null ? Number(usedSrc) : null;
    const usedCount =
      usedNum != null && Number.isFinite(usedNum) ? usedNum : null;

    const assignedName =
      src.assignedName ?? src.assigned_name ?? src.assignedTo?.name ?? null;

    const assignedType =
      src.assignedType ?? src.assigned_type ?? src.assignedTo?.type ?? null;

    const ticketUrl =
      src.ticket?.ticketUrl ??
      src.ticket?.ticket_url ??
      src.ticketUrl ??
      src.ticket_url ??
      src.imageUrl ??
      src.image_url ??
      null;

    const sectionName =
      src.sectionName ?? src.section_name ?? src.section ?? null;

    const teamSide =
      src.teamSide ??
      src.team_side ??
      src.sideLabel ??
      src.side_label ??
      null;

    const validUntil =
      src.validUntil ??
      src.valid_until ??
      src.expiresAt ??
      src.expires_at ??
      null;

    const notes = src.notes ?? src.remark ?? src.remarks ?? null;

    const item: VoucherSummary = {
      id: String(src.id ?? src.voucherId ?? src.voucher_id ?? voucherId),
      status: src.status ?? null,
      name: src.name ?? src.voucherName ?? null,
      code: src.code ?? src.voucherCode ?? src.id ?? voucherId,
      issuer: src.issuer ?? src.issuedBy ?? src.issuerName ?? null,
      maxUses,
      usedCount,
      assignedName,
      assignedType,
      ticketUrl,
      sectionName,
      teamSide,
      validUntil,
      notes,
    };

    return { ok: true, item };
  },

  async useVoucher(
    eventId: string,
    seasonId: string,
    voucherId: string,
    uses: number
  ): Promise<{
    ok: true;
    item?: { id: string; usedCount?: number | null; maxUses?: number | null };
  }> {
    const sp = new URLSearchParams({ seasonId, voucherId }).toString();
    return patchJson<{
      ok: true;
      item?: { id: string; usedCount?: number | null; maxUses?: number | null };
    }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/vouchers?${sp}`,
      { use: uses }
    );
  },

  async cancelTickets(
    eventId: string,
    seasonId: string,
    ids?: string[],
    bundleId?: string
  ): Promise<{ ok: true }> {
    const sp = new URLSearchParams({ seasonId });
    if (bundleId) sp.set("bundleId", bundleId);
    if (ids && ids.length) sp.set("ids", ids.join(","));
    return delJson<{ ok: true }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/tickets?${sp.toString()}`
    );
  },

  async confirmTickets(
    eventId: string,
    seasonId: string,
    ids?: string[],
    bundleId?: string,
    status:
      | "active"
      | "pending"
      | "redeemed"
      | "invalid"
      | "expired"
      | "cancelled" = "active"
  ): Promise<{ ok: true }> {
    const sp = new URLSearchParams({ seasonId });
    return patchJson<{ ok: true }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/tickets?${sp.toString()}`,
      { ids, bundleId, status }
    );
  },

  async updateTicketStatus(
    eventId: string,
    seasonId: string,
    ticketId: string,
    status: "redeemed" | "invalid" | "active"
  ): Promise<{ ok: true }> {
    const sp = new URLSearchParams({ seasonId });
    return patchJson<{ ok: true }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/tickets?${sp.toString()}`,
      { ids: [ticketId], status }
    );
  },

  async redeemVoucher(
    eventId: string,
    seasonId: string,
    voucherId: string,
    addUses: number
  ): Promise<{ ok: true }> {
    const sp = new URLSearchParams({ seasonId });
    return patchJson<{ ok: true }>(
      `/api/scanner/event-details/${encodeURIComponent(
        eventId
      )}/vouchers?${sp.toString()}`,
      { voucherId, addUses }
    );
  },

  async resolveEvent(codeOrId: string): Promise<OkItem<ResolveEventItem>> {
    const q = (codeOrId || "").trim();
    if (!q) throw new Error("Missing event code");
    const server = await getJson<any>(
      `/api/scanner/resolve-event?code=${encodeURIComponent(q)}`
    );
    if (!server?.ok) throw new Error("Event not found");
    const src = server.item ?? server;
    const item: ResolveEventItem = {
      eventId: String(src.eventId ?? src.id ?? q),
      seasonId: String(src.seasonId ?? src.season_id ?? ""),
      name: String(src.name ?? src.title ?? ""),
      date: src.date ? String(src.date) : undefined,
      venue: src.venue
        ? {
            name: String(src.venue.name ?? src.venue.venueName ?? ""),
            imageUrl: src.venue.imageUrl ?? src.venue.image_url ?? null,
          }
        : null,
    };
    if (!item.eventId || !item.seasonId)
      throw new Error("Resolver did not return eventId/seasonId");
    return { ok: true, item };
  },
};
