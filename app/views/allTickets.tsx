import { scannerApi, type TicketSummary } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Types ---

type TicketStatus = "active" | "pending" | "redeemed" | "invalid" | "expired";
type TicketType = "adult" | "child" | "priority";
type PurchaseFilter = "all" | "online" | "onsite";

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
  purchaseType?: string | null;
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
      parentTicketId: string | null;
    };

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
};

const BLUE = "#071689";

// --- Helpers ---

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
    case "pending": status = "pending"; break;
    case "redeemed": status = "redeemed"; break;
    case "invalid": status = "invalid"; break;
    case "expired":
    case "cancelled":
    case "canceled": status = "expired"; break;
    default: status = "active";
  }

  const rawType = String((src as any).type || "").toLowerCase();
  const type: TicketType | undefined =
    rawType === "adult" || rawType === "child" || rawType === "priority"
      ? (rawType as TicketType)
      : undefined;

  const rawBundle = (src as any).bundleId ?? (src as any).bundle_id ?? null;
  const bundleId = rawBundle != null && String(rawBundle).trim() ? String(rawBundle).trim() : null;

  const rawParent = (src as any).parentTicketId ?? (src as any).parent_ticket_id ?? null;
  const parentTicketId = rawParent != null && String(rawParent).trim() ? String(rawParent).trim() : null;

  const purchaseType = (src as any).purchaseType ?? (src as any).purchase_type ?? null;

  return {
    id: src.id,
    code: src.id,
    holderName: src.assignedName || "Guest",
    status,
    createdAt: Date.now(),
    sectionName: src.sectionName ?? null,
    sideLabel: src.sideLabel ?? null,
    price: src.price ?? null,
    type,
    bundleId,
    parentTicketId,
    purchaseType: purchaseType ? String(purchaseType).toLowerCase() : null,
  };
}

// --- Main Component ---

export default function AllTickets() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();

  // --- Context ---
  const [eventId, setEventId] = useState(() => asString(params.eventId, ""));
  const [seasonId, setSeasonId] = useState(() => asString(params.seasonId, ""));
  const [eventName, setEventName] = useState(() => asString(params.eventName, "Event"));

  // --- Data ---
  const [data, setData] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Filters ---
  const [q, setQ] = useState("");
  
  // Filter States
  const [activeDropdown, setActiveDropdown] = useState<"status" | "section" | "type" | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const [filterSectionSide, setFilterSectionSide] = useState<string>("all"); // Consolidated Filter
  const [filterPurchase, setFilterPurchase] = useState<PurchaseFilter>("all");

  // --- UI ---
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
    return () => { cancelled = true; };
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
        if (!cancelled) setData(mapped);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || "Failed to load tickets");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, seasonId]);

  useFocusEffect(useCallback(() => { const cleanup = loadTickets(); return cleanup; }, [loadTickets]));

  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current); }, []);

  // --- Derived Data: Consolidated Section/Side ---
  const availableSectionSides = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      const section = t.sectionName ? t.sectionName.trim() : "";
      const side = t.sideLabel ? t.sideLabel.trim() : "";
      
      let combined = "";
      if (section && side) combined = `${section} - ${side}`;
      else if (section) combined = section;
      else if (side) combined = side;

      if (combined) set.add(combined);
    });
    return Array.from(set).sort();
  }, [data]);

  // --- Filtering Logic ---
  const filteredTickets = useMemo(() => {
    let out = data;

    // 1. Search
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(t => t.code.toLowerCase().includes(s) || t.holderName.toLowerCase().includes(s));
    }

    // 2. Status
    if (filterStatus !== "all") {
      out = out.filter(t => t.status === filterStatus);
    }

    // 3. Consolidated Section - Side
    if (filterSectionSide !== "all") {
      out = out.filter(t => {
        const section = t.sectionName ? t.sectionName.trim() : "";
        const side = t.sideLabel ? t.sideLabel.trim() : "";
        
        let combined = "";
        if (section && side) combined = `${section} - ${side}`;
        else if (section) combined = section;
        else if (side) combined = side;

        return combined === filterSectionSide;
      });
    }

    // 4. Purchase Type
    if (filterPurchase !== "all") {
      out = out.filter(t => {
        const type = (t.purchaseType || "").toLowerCase().trim();
        return type === filterPurchase; 
      });
    }

    return [...out].sort((a, b) => {
      const ra = typeRank(a.type ?? null);
      const rb = typeRank(b.type ?? null);
      if (ra !== rb) return ra - rb;
      return b.createdAt - a.createdAt;
    });
  }, [data, q, filterStatus, filterSectionSide, filterPurchase]);

  // --- Grouping Logic ---
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
        out.push({ kind: "single", key: sortedGroup[0].id, ticket: sortedGroup[0] });
      } else {
        const totalPrice = sortedGroup.reduce((sum, t) => sum + (t.price ?? 0), 0);
        const allSameStatus = sortedGroup.every(t => t.status === sortedGroup[0].status);
        const parentTicket = sortedGroup.find(t => t.type === "adult" || t.type === "priority") ?? sortedGroup[0];
        out.push({
          kind: "bundle",
          key,
          bundleId: key,
          primaryName: parentTicket.holderName,
          status: parentTicket.status,
          count: sortedGroup.length,
          priceTotal: Number.isFinite(totalPrice) ? totalPrice : null,
          tickets: sortedGroup,
          allSameStatus,
          parentTicketId: parentTicket.id,
        });
      }
    }

    out.sort((a, b) => {
      const rankA = a.kind === "single" ? typeRank(a.ticket.type ?? null) : Math.min(...a.tickets.map(t => typeRank(t.type ?? null)));
      const rankB = b.kind === "single" ? typeRank(b.ticket.type ?? null) : Math.min(...b.tickets.map(t => typeRank(t.type ?? null)));
      return rankA !== rankB ? rankA - rankB : 0;
    });

    return out;
  }, [filteredTickets]);

  const onSearch = () => setQ(q.trim());
  const toggleDropdown = (key: "status" | "section" | "type") => setActiveDropdown(prev => prev === key ? null : key);
  
  const handleBack = () => {
    if (backBusy) return;
    setBackBusy(true);
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/");
    backTimer.current = setTimeout(() => setBackBusy(false), 400);
  };

  const handlePressTicket = (item: Ticket) => {
    const typeNorm = (item.type || "").toString().toLowerCase() as TicketType | "";
    const isChild = typeNorm === "child";
    const isAdultLike = typeNorm === "adult" || typeNorm === "priority" || !typeNorm;
    const baseParams: any = { eventId, seasonId, eventName, ticketId: item.id, code: item.code, holderName: item.holderName, side: item.sideLabel ?? item.sectionName ?? "", status: item.status };
    if (item.bundleId) baseParams.bundleId = item.bundleId;
    if (item.parentTicketId) baseParams.parentTicketId = item.parentTicketId;

    if (item.status === "pending") {
      if (isChild && item.bundleId) return;
      if (isAdultLike && item.bundleId) {
        const attached = data.filter(t => t.status === "pending" && t.type === "child" && t.bundleId === item.bundleId && t.parentTicketId === item.id);
        if (attached.length > 0) {
          router.push({ pathname: "/views/confirmBundle", params: { eventId, seasonId, eventName, bundleId: item.bundleId, parentTicketId: item.id } });
          return;
        }
      }
      router.push({ pathname: "/views/confirmReserved", params: { ...baseParams, guestName: item.holderName, totalAmount: item.price != null ? String(item.price) : "", section: item.sectionName ?? "", refNumber: item.code } });
      return;
    }

    if (isChild && item.status === "active" && item.bundleId && item.parentTicketId) {
      const parent = data.find(t => t.id === item.parentTicketId);
      if (parent && parent.status !== "redeemed") {
        Alert.alert("Adult ticket required", "You need to redeem the adult ticket before redeeming this child ticket.");
        return;
      }
    }

    if (isAdultLike && item.bundleId) {
      const attached = data.filter(t => t.bundleId === item.bundleId && t.type === "child" && t.parentTicketId === item.id);
      if (attached.length > 0 && ["active", "redeemed", "invalid"].includes(item.status)) {
        Alert.alert("Manage tickets", `This adult ticket has ${attached.length} child ticket${attached.length > 1 ? "s" : ""}.`, [
          { text: "Adult only", onPress: () => router.push({ pathname: "/views/confirmTicket", params: { ...baseParams, mode: "list" } }) },
          { text: "Adult + children", onPress: () => router.push({ pathname: "/views/confirmTicket", params: { eventId, seasonId, eventName, bundleId: item.bundleId!, parentTicketId: item.id, mode: "bundle", status: item.status } }) },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }
    }

    router.push({ pathname: item.status === "expired" ? "/views/viewTicket" : "/views/confirmTicket", params: { ...baseParams, mode: "list" } });
  };

  const handlePressBundle = (row: Extract<TicketRow, { kind: "bundle" }>) => {
    if (!row.allSameStatus) return;
    if (row.status === "pending") {
      router.push({ pathname: "/views/confirmBundle", params: { eventId, seasonId, eventName, bundleId: row.bundleId } });
      return;
    }
    router.push({ pathname: "/views/confirmTicket", params: { eventId, seasonId, eventName, bundleId: row.bundleId, mode: "bundle", status: row.status } });
  };

  const toggleBundleExpand = (bundleId: string) => {
    setExpandedBundleId((prev) => (prev === bundleId ? null : bundleId));
  };

  // --- Renderers ---

  const renderItem = ({ item }: { item: TicketRow }) => {
    if (item.kind === "single") {
      const t = item.ticket;
      const showAmount = t.status === "pending" && typeof t.price === "number";
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]} onPress={() => handlePressTicket(t)}>
          <View style={styles.leftCol}>
            <Text style={styles.name}>{t.holderName || "No name"}</Text>
            <Text style={styles.code}>{t.code}</Text>
            {showAmount && <Text style={styles.pricePending}>₱{(t.price as number).toFixed(2)}</Text>}
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
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]} onPress={() => handlePressBundle(row)}>
          <View style={styles.leftCol}>
            <Text style={styles.name}>{row.primaryName || "Bundle"}</Text>
            <Text style={styles.code}>{row.count} tickets in bundle</Text>
            {typeof row.priceTotal === "number" && row.priceTotal > 0 && <Text style={styles.bundleTotal}>Total: ₱{row.priceTotal.toFixed(2)}</Text>}
          </View>
          <View style={styles.rightRail}>
            {row.allSameStatus && <StatusBadge status={row.status} />}
            <Pressable hitSlop={8} onPress={(e) => { (e as any).stopPropagation?.(); setExpandedBundleId(prev => prev === row.bundleId ? null : row.bundleId); }}>
              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#C7CCD6" />
            </Pressable>
          </View>
        </Pressable>
        {isExpanded && <View style={styles.bundleChildren}>
          {row.tickets.map(t => (
            <Pressable key={t.id} onPress={() => handlePressTicket(t)} style={({ pressed }) => [styles.bundleChildRow, pressed && { backgroundColor: "#F3F4FF" }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bundleChildName}>{t.holderName || "No name"}</Text>
                <Text style={styles.bundleChildMeta}>{(t.sectionName || "Section") + (t.sideLabel ? ` · ${t.sideLabel}` : "")}{" · "}{t.code}</Text>
              </View>
              <View style={styles.bundleChildRight}>
                {!row.allSameStatus && <View style={styles.bundleChildStatusWrapper}><StatusBadge status={t.status} /></View>}
                {t.status === "pending" && typeof t.price === "number" && <Text style={styles.bundleChildPrice}>₱{t.price.toFixed(2)}</Text>}
              </View>
            </Pressable>
          ))}
        </View>}
      </View>
    );
  };

  const getLabel = (key: string, val: string) => {
    if (key === 'status') {
      if (val === 'active') return "Purchased";
      if (val === 'pending') return "Reserved";
      return val === 'all' ? "All Statuses" : val.charAt(0).toUpperCase() + val.slice(1);
    }
    if (key === 'section') return val === 'all' ? "All Sections" : val;
    if (key === 'type') return val === 'all' ? "All Types" : (val.charAt(0).toUpperCase() + val.slice(1));
    return val;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={12} disabled={backBusy} style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: "#F2F3F7" }]}>
          <Ionicons name="arrow-back" size={22} color={BLUE} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.topTitle}>Tickets</Text>
            <Text style={styles.topSubtitle}>Total: {data.length}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.headerSeparator} />

      <View style={styles.searchRow}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search by code or name" placeholderTextColor="#9CA3AF" style={styles.searchInput} returnKeyType="search" onSubmitEditing={onSearch} />
        <Pressable onPress={onSearch} style={styles.searchBtn}><Ionicons name="search" size={18} color="#fff" /></Pressable>
      </View>

      <View style={styles.filterBar}>
        <FilterDropdownButton label={getLabel('status', filterStatus)} active={activeDropdown === 'status'} onPress={() => toggleDropdown('status')} />
        {/* Consolidated Section Dropdown */}
        <FilterDropdownButton label={getLabel('section', filterSectionSide)} active={activeDropdown === 'section'} onPress={() => toggleDropdown('section')} />
        <FilterDropdownButton label={getLabel('type', filterPurchase)} active={activeDropdown === 'type'} onPress={() => toggleDropdown('type')} />
      </View>

      {activeDropdown && (
        <View style={styles.dropdownContent}>
            <View style={styles.chipContainer}>
                {activeDropdown === 'status' && (
                    <>
                        {['all', 'active', 'pending', 'redeemed', 'invalid', 'expired'].map(s => (
                            <FilterChip key={s} label={s === 'all' ? 'All' : getLabel('status', s)} active={filterStatus === s} onPress={() => { setFilterStatus(s as any); setActiveDropdown(null); }} />
                        ))}
                    </>
                )}
                {/* Consolidated Section Chips */}
                {activeDropdown === 'section' && (
                    <>
                        <FilterChip label="All" active={filterSectionSide === 'all'} onPress={() => { setFilterSectionSide('all'); setActiveDropdown(null); }} />
                        {availableSectionSides.map(s => (
                            <FilterChip key={s} label={s} active={filterSectionSide === s} onPress={() => { setFilterSectionSide(s); setActiveDropdown(null); }} />
                        ))}
                    </>
                )}
                {activeDropdown === 'type' && (
                    <>
                        <FilterChip label="All" active={filterPurchase === 'all'} onPress={() => { setFilterPurchase('all'); setActiveDropdown(null); }} />
                        <FilterChip label="Online" active={filterPurchase === 'online'} onPress={() => { setFilterPurchase('online'); setActiveDropdown(null); }} />
                        <FilterChip label="Onsite" active={filterPurchase === 'onsite'} onPress={() => { setFilterPurchase('onsite'); setActiveDropdown(null); }} />
                    </>
                )}
            </View>
        </View>
      )}

      {loadError && <View style={styles.errorBox}><Ionicons name="warning-outline" size={18} color="#DC2626" /><Text style={styles.errorText}>{loadError}</Text></View>}
      {loading && <View style={styles.loadingRow}><ActivityIndicator size="small" /><Text style={styles.loadingText}>Loading tickets…</Text></View>}

      <FlatList
        data={rows}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={[styles.listContent, rows.length === 0 && { flex: 1 }]}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="documents-outline" size={32} color="#9CA3AF" /><Text style={styles.emptyText}>{q || filterStatus !== "all" ? "No results" : "No tickets yet"}</Text></View> : null}
      />
    </SafeAreaView>
  );
}

// --- Components ---
function FilterDropdownButton({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={[styles.dropdownBtn, active && styles.dropdownBtnActive]}>
            <Text style={[styles.dropdownBtnText, active && styles.dropdownBtnTextActive]} numberOfLines={1}>{label}</Text>
            <Ionicons name={active ? "chevron-up" : "chevron-down"} size={14} color={active ? BLUE : "#4B5563"} />
        </Pressable>
    )
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  let label = "";
  let palette = { bg: "#6B7280", text: "#fff" };
  switch (status) {
    case "active": label = "Purchased"; palette = { bg: BLUE, text: "#fff" }; break;
    case "pending": label = "Reserved"; palette = { bg: "#F59E0B", text: "#fff" }; break;
    case "redeemed": label = "Redeemed"; palette = { bg: "#16A34A", text: "#fff" }; break;
    case "invalid": label = "Invalid"; palette = { bg: "#EF4444", text: "#fff" }; break;
    default: label = status.charAt(0).toUpperCase() + status.slice(1); palette = { bg: "#6B7280", text: "#fff" };
  }
  return <View style={[styles.badge, { backgroundColor: palette.bg }]}><Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  iconBtn: { padding: 6, borderRadius: 8 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: "800", color: BLUE },
  topSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  headerSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" },
  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, alignItems: "center", backgroundColor: "#F9FAFB" },
  searchInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, backgroundColor: "#fff" },
  searchBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: BLUE, borderRadius: 10 },
  searchBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  // Scrollable Filter Bar
  filterBar: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  dropdownBtn: { flex: 1, flexDirection: 'row', height: 36, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  dropdownBtnActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  dropdownBtnText: { fontSize: 13, color: '#4B5563', flex: 1, marginRight: 4 },
  dropdownBtnTextActive: { color: BLUE, fontWeight: '600' },
  dropdownContent: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  chip: { borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 14, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", marginBottom: 4 },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { color: "#4B5563", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  clearBtn: { marginLeft: "auto", paddingHorizontal: 8, height: 34, alignItems: "center", justifyContent: "center" },
  clearText: { color: "#6B7280", fontSize: 13 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: "#DC2626", fontSize: 13 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  loadingText: { fontSize: 13, color: "#4B5563" },
  listContent: { padding: 12, paddingTop: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderRadius: 12, minHeight: 68, shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  leftCol: { flex: 1, justifyContent: "center" },
  rightRail: { flexDirection: "row", alignItems: "center", gap: 8 },
  sep: { height: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#111" },
  code: { fontSize: 12, color: "#6B7280", marginTop: 2, fontVariant: ["tabular-nums"] },
  pricePending: { fontSize: 12, color: "#111827", fontWeight: "600", marginTop: 2 },
  bundleTotal: { fontSize: 12, color: "#111827", marginTop: 2, fontWeight: "600" },
  badge: { paddingHorizontal: 10, height: 24, minWidth: 68, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  bundleChildren: { marginTop: 4, marginLeft: 10, marginRight: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#EEF2FF", gap: 4 },
  bundleChildRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  bundleChildName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  bundleChildMeta: { fontSize: 11, color: "#4B5563", marginTop: 1 },
  bundleChildRight: { alignItems: "flex-end", justifyContent: "center", marginLeft: 8 },
  bundleChildStatusWrapper: { marginBottom: 2 },
  bundleChildPrice: { fontSize: 12, color: "#111827", fontWeight: "600", marginLeft: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#6B7280" },
});