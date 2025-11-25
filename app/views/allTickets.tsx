// app/views/allTickets.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type TicketSummary } from "@/lib/api";

type TicketStatus = "active" | "pending" | "redeemed" | "invalid" | "expired";

type TicketType = "adult" | "child" | "priority";

type Ticket = {
  id: string;
  code: string;
  holderName: string;
  status: TicketStatus;
  createdAt: number;
  sectionName?: string | null;
  sideLabel?: string | null;
  price?: number | null;
  type?: TicketType;
  bundleId?: string | null;
  parentTicketId?: string | null;
};

type TicketRow =
  | {
      kind: "single";
      key: string;
      ticket: Ticket;
    }
  | {
      kind: "bundle";
      key: string;
      bundleId: string;
      primaryName: string;
      status: TicketStatus;
      count: number;
      priceTotal?: number | null;
      tickets: Ticket[];
      allSameStatus: boolean;
    };

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
};

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function typeRank(type?: TicketType | null): number {
  if (type === "adult") return 0;
  if (type === "priority") return 1;
  if (type === "child") return 2;
  return 3;
}

function sortTicketsByType(list: Ticket[]): Ticket[] {
  return [...list].sort((a, b) => {
    const ra = typeRank(a.type ?? null);
    const rb = typeRank(b.type ?? null);
    if (ra !== rb) return ra - rb;
    return (a.holderName || "").localeCompare(b.holderName || "");
  });
}

function mapTicketSummary(src: TicketSummary): Ticket {
  const rawStatus = String(src.status || "active").toLowerCase();

  let status: TicketStatus;
  switch (rawStatus) {
    case "pending":
      status = "pending";
      break;
    case "redeemed":
      status = "redeemed";
      break;
    case "invalid":
      status = "invalid";
      break;
    case "expired":
    case "cancelled":
      status = "expired";
      break;
    default:
      status = "active";
  }

  const createdAt = Date.now();
  const bundleId = (src as any).bundleId ?? null;
  const parentTicketId = (src as any).parentTicketId ?? null;

  return {
    id: src.id,
    code: src.id,
    holderName: src.assignedName || "Guest",
    status,
    createdAt,
    sectionName: src.sectionName ?? null,
    sideLabel: src.sideLabel ?? null,
    price: src.price ?? null,
    type: src.type as TicketType | undefined,
    bundleId,
    parentTicketId,
  };
}

export default function AllTickets() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
  }>();

  const [eventId, setEventId] = useState(() => asString(params.eventId, ""));
  const [seasonId, setSeasonId] = useState(() =>
    asString(params.seasonId, "")
  );
  const [eventName, setEventName] = useState(() =>
    asString(params.eventName, "Event")
  );

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [data, setData] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null);

  const [backBusy, setBackBusy] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [id, season, name] = await AsyncStorage.multiGet([
          STORAGE_KEYS.eventId,
          STORAGE_KEYS.seasonId,
          STORAGE_KEYS.eventName,
        ]);

        if (cancelled) return;

        setEventId((prev) => prev || (id?.[1] || "").trim());
        setSeasonId((prev) => prev || (season?.[1] || "").trim());
        setEventName((prev) => {
          if (prev && prev !== "Event") return prev;
          const stored = (name?.[1] || "").trim();
          return stored || prev;
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadTickets = useCallback(() => {
    let cancelled = false;

    if (!eventId || !seasonId) {
      setLoadError("Missing event context.");
      setData([]);
      return () => {};
    }

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await scannerApi.fetchTickets(eventId, seasonId, []);
        const items = Array.isArray(res.items) ? res.items : [];
        const mapped = items.map(mapTicketSummary);
        if (!cancelled) {
          setData(mapped);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || "Failed to load tickets");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, seasonId]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = loadTickets();
      return cleanup;
    }, [loadTickets])
  );

  useEffect(
    () => () => {
      if (backTimer.current) clearTimeout(backTimer.current);
    },
    []
  );

  const filteredTickets = useMemo(() => {
    const base =
      statusFilter === "all"
        ? data
        : data.filter((t) => t.status === statusFilter);

    let out = base;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = base.filter(
        (t) =>
          t.code.toLowerCase().includes(s) ||
          t.holderName.toLowerCase().includes(s)
      );
    }

    return [...out].sort((a, b) => {
      const ra = typeRank(a.type ?? null);
      const rb = typeRank(b.type ?? null);
      if (ra !== rb) return ra - rb;
      return b.createdAt - a.createdAt;
    });
  }, [data, q, statusFilter]);

  const rows: TicketRow[] = useMemo(() => {
    const groups = new Map<string, Ticket[]>();

    for (const t of filteredTickets) {
      const key = t.bundleId || t.id;
      const existing = groups.get(key);
      if (existing) existing.push(t);
      else groups.set(key, [t]);
    }

    const out: TicketRow[] = [];

    for (const [key, group] of groups.entries()) {
      const sortedGroup = sortTicketsByType(group);

      if (!sortedGroup[0].bundleId || sortedGroup.length === 1) {
        const t = sortedGroup[0];
        out.push({
          kind: "single",
          key: t.id,
          ticket: t,
        });
      } else {
        const totalPrice = sortedGroup.reduce(
          (sum, t) => sum + (t.price ?? 0),
          0
        );
        const allSameStatus = sortedGroup.every(
          (t) => t.status === sortedGroup[0].status
        );

        out.push({
          kind: "bundle",
          key,
          bundleId: key,
          primaryName: sortedGroup[0].holderName,
          status: sortedGroup[0].status,
          count: sortedGroup.length,
          priceTotal: Number.isFinite(totalPrice) ? totalPrice : null,
          tickets: sortedGroup,
          allSameStatus,
        });
      }
    }

    out.sort((a, b) => {
      const rankA =
        a.kind === "single"
          ? typeRank(a.ticket.type ?? null)
          : Math.min(...a.tickets.map((t) => typeRank(t.type ?? null)));
      const rankB =
        b.kind === "single"
          ? typeRank(b.ticket.type ?? null)
          : Math.min(...b.tickets.map((t) => typeRank(t.type ?? null)));

      if (rankA !== rankB) return rankA - rankB;
      return 0;
    });

    return out;
  }, [filteredTickets]);

  const onSearch = () => setQ(q.trim());
  const onClear = () => {
    setQ("");
    setStatusFilter("all");
  };

  const handleBack = () => {
    if (backBusy) return;
    setBackBusy(true);
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/");
    backTimer.current = setTimeout(() => setBackBusy(false), 400);
  };

  const handlePressTicket = (item: Ticket) => {
    const isChild = item.type === "child";
    const isAdultLike =
      item.type === "adult" || item.type === "priority" || !item.type;

    if (item.status === "pending") {
      if (isChild && item.bundleId) {
        return;
      }

      if (isAdultLike && item.bundleId) {
        const attachedChildren = data.filter(
          (t) =>
            t.status === "pending" &&
            t.type === "child" &&
            t.bundleId === item.bundleId &&
            t.parentTicketId === item.id
        );

        if (attachedChildren.length > 0) {
          router.push({
            pathname: "/views/confirmBundle",
            params: {
              eventId,
              seasonId,
              eventName,
              bundleId: item.bundleId,
              parentTicketId: item.id,
            },
          });
          return;
        }
      }

      const baseParams: any = {
        eventId,
        seasonId,
        eventName,
        ticketId: item.id,
        code: item.code,
        holderName: item.holderName,
        side: item.sideLabel ?? item.sectionName ?? "",
        status: item.status,
      };

      router.push({
        pathname: "/views/confirmReserved",
        params: {
          ...baseParams,
          guestName: item.holderName,
          totalAmount: item.price != null ? String(item.price) : "",
          section: item.sectionName ?? "",
          refNumber: item.code,
        },
      });

      return;
    }

    if (
      isChild &&
      item.status === "active" &&
      item.bundleId &&
      item.parentTicketId
    ) {
      const parent = data.find((t) => t.id === item.parentTicketId);
      if (parent && parent.status !== "redeemed") {
        Alert.alert(
          "Adult ticket required",
          "You need to redeem the adult ticket before redeeming this child ticket."
        );
        return;
      }
    }

    if (isAdultLike && item.status === "active" && item.bundleId) {
      const redeemableChildren = data.filter(
        (t) =>
          t.bundleId === item.bundleId &&
          t.type === "child" &&
          t.status === "active" &&
          t.parentTicketId === item.id
      );

      if (redeemableChildren.length > 0) {
        const count = redeemableChildren.length;
        const msg = `This ticket has ${count} child ticket${
          count > 1 ? "s" : ""
        }. Do you want to redeem only the adult ticket, or redeem the adult and all child tickets together?`;

        Alert.alert("Redeem tickets", msg, [
          {
            text: "Adult only",
            onPress: () => {
              const baseParams: any = {
                eventId,
                seasonId,
                eventName,
                ticketId: item.id,
                code: item.code,
                holderName: item.holderName,
                side: item.sideLabel ?? item.sectionName ?? "",
                status: item.status,
              };

              router.push({
                pathname: "/views/confirmTicket",
                params: {
                  ...baseParams,
                  mode: "list",
                },
              });
            },
          },
          {
            text: "Adult + children",
            onPress: () => {
              router.push({
                pathname: "/views/confirmTicket",
                params: {
                  eventId,
                  seasonId,
                  eventName,
                  bundleId: item.bundleId,
                  mode: "bundle",
                  status: item.status,
                },
              });
            },
          },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }
    }

    const baseParams: any = {
      eventId,
      seasonId,
      eventName,
      ticketId: item.id,
      code: item.code,
      holderName: item.holderName,
      side: item.sideLabel ?? item.sectionName ?? "",
      status: item.status,
    };

    if (item.status === "expired") {
      router.push({
        pathname: "/views/viewTicket",
        params: baseParams,
      });
    } else {
      router.push({
        pathname: "/views/confirmTicket",
        params: {
          ...baseParams,
          mode: "list",
        },
      });
    }
  };

  const handlePressBundle = (row: Extract<TicketRow, { kind: "bundle" }>) => {
    if (!row.allSameStatus) return;

    if (row.status === "pending") {
      router.push({
        pathname: "/views/confirmBundle",
        params: {
          eventId,
          seasonId,
          eventName,
          bundleId: row.bundleId,
        },
      });
    } else {
      router.push({
        pathname: "/views/confirmTicket",
        params: {
          eventId,
          seasonId,
          eventName,
          bundleId: row.bundleId,
          mode: "bundle",
          status: row.status,
        },
      });
    }
  };

  const toggleBundleExpand = (bundleId: string) => {
    setExpandedBundleId((prev) => (prev === bundleId ? null : bundleId));
  };

  const renderItem = ({ item }: { item: TicketRow }) => {
    if (item.kind === "single") {
      const t = item.ticket;
      const showAmount =
        t.status === "pending" && typeof t.price === "number";

      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.92 },
          ]}
          onPress={() => handlePressTicket(t)}
        >
          <View style={styles.leftCol}>
            <Text style={styles.name}>{t.holderName || "No name"}</Text>
            <Text style={styles.code}>{t.code}</Text>
            {showAmount && (
              <Text style={styles.pricePending}>
                ₱{(t.price as number).toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.rightRail}>
            <StatusBadge status={t.status} />
            <Ionicons name="chevron-forward" size={18} color="#C7CCD6" />
          </View>
        </Pressable>
      );
    }

    const row = item;
    const isExpanded = expandedBundleId === row.bundleId;

    return (
      <View>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.92 },
          ]}
          onPress={() => handlePressBundle(row)}
        >
          <View style={styles.leftCol}>
            <Text style={styles.name}>
              {row.primaryName || "Bundle"}
            </Text>
            <Text style={styles.code}>
              {row.count} tickets in bundle
            </Text>
            {typeof row.priceTotal === "number" &&
              row.priceTotal > 0 && (
                <Text style={styles.bundleTotal}>
                  Total: ₱{row.priceTotal.toFixed(2)}
                </Text>
              )}
          </View>

          <View style={styles.rightRail}>
            {row.allSameStatus && (
              <StatusBadge status={row.status} />
            )}
            <Pressable
              hitSlop={8}
              onPress={(event) => {
                (event as any).stopPropagation?.();
                toggleBundleExpand(row.bundleId);
              }}
            >
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#C7CCD6"
              />
            </Pressable>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.bundleChildren}>
            {row.tickets.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => handlePressTicket(t)}
                style={({ pressed }) => [
                  styles.bundleChildRow,
                  pressed && { backgroundColor: "#F3F4FF" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bundleChildName}>
                    {t.holderName || "No name"}
                  </Text>
                  <Text style={styles.bundleChildMeta}>
                    {(t.sectionName || "Section") +
                      (t.sideLabel ? ` · ${t.sideLabel}` : "")}
                    {" · "}
                    {t.code}
                  </Text>
                </View>

                <View style={styles.bundleChildRight}>
                  {!row.allSameStatus && (
                    <View style={styles.bundleChildStatusWrapper}>
                      <StatusBadge status={t.status} />
                    </View>
                  )}
                  {t.status === "pending" &&
                    typeof t.price === "number" && (
                      <Text style={styles.bundleChildPrice}>
                        ₱{t.price.toFixed(2)}
                      </Text>
                    )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          disabled={backBusy}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { backgroundColor: "#F2F3F7" },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#071689" />
        </Pressable>
        <Text style={styles.topTitle}>Tickets</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.headerSeparator} />

      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by code or name"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        <Pressable onPress={onSearch} style={styles.searchBtn}>
          <Ionicons name="search" size={18} color="#fff" />
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={statusFilter === "all"}
          onPress={() => setStatusFilter("all")}
        />
        <FilterChip
          label="Active"
          active={statusFilter === "active"}
          onPress={() => setStatusFilter("active")}
        />
        <FilterChip
          label="Pending"
          active={statusFilter === "pending"}
          onPress={() => setStatusFilter("pending")}
        />
        <FilterChip
          label="Redeemed"
          active={statusFilter === "redeemed"}
          onPress={() => setStatusFilter("redeemed")}
        />
        <FilterChip
          label="Invalid"
          active={statusFilter === "invalid"}
          onPress={() => setStatusFilter("invalid")}
        />
        <FilterChip
          label="Expired"
          active={statusFilter === "expired"}
          onPress={() => setStatusFilter("expired")}
        />
        <Pressable onPress={onClear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {loadError && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading tickets…</Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={[
          styles.listContent,
          rows.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons
                name="documents-outline"
                size={32}
                color="#9CA3AF"
              />
              <Text style={styles.emptyText}>
                {q || statusFilter !== "all"
                  ? "No results"
                  : "No tickets yet"}
              </Text>
            </View>
          ) : null
        }
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const palette =
    status === "active"
      ? { bg: "#071689", text: "#fff" }
      : status === "pending"
      ? { bg: "#F59E0B", text: "#fff" }
      : status === "redeemed"
      ? { bg: "#16A34A", text: "#fff" }
      : status === "invalid"
      ? { bg: "#EF4444", text: "#fff" }
      : { bg: "#6B7280", text: "#fff" };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && {
          backgroundColor: "#071689",
          borderColor: "#071689",
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active && {
            color: "#fff",
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#071689",
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  searchBtn: {
    flexDirection: "row",
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071689",
    borderRadius: 10,
    gap: 6,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    flexWrap: "wrap",
    backgroundColor: "#F9FAFB",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  chipText: { color: "#111", fontSize: 13 },

  clearBtn: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: "#6B7280", fontSize: 13 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: { color: "#DC2626", fontSize: 13 },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  loadingText: { fontSize: 13, color: "#4B5563" },

  listContent: { padding: 12, paddingTop: 6 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    minHeight: 68,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },

  leftCol: { flex: 1, justifyContent: "center" },

  rightRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sep: { height: 8 },

  name: { fontSize: 15, fontWeight: "700", color: "#111" },
  code: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  pricePending: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
    marginTop: 2,
  },
  bundleTotal: {
    fontSize: 12,
    color: "#111827",
    marginTop: 2,
    fontWeight: "600",
  },

  badge: {
    paddingHorizontal: 10,
    height: 24,
    minWidth: 68,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  bundleChildren: {
    marginTop: 4,
    marginLeft: 10,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    gap: 4,
  },
  bundleChildRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  bundleChildName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  bundleChildMeta: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 1,
  },
  bundleChildRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  bundleChildStatusWrapper: {
    marginBottom: 2,
  },
  bundleChildPrice: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
    marginLeft: 2,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { color: "#6B7280" },
});
