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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type VoucherSummary } from "../../lib/api";

// --- Types ---

type VoucherStatus = "active" | "redeemed" | "expired";

type Voucher = {
  id: string;
  voucherCode: string;
  voucherName: string;
  issuer: string | null;
  status: VoucherStatus;
  maxUses: number | null;
  usedCount: number | null;
  createdAt: number;
  assignedName: string | null;
  assignedType: string | null;
  sectionName: string | null;
  teamSide: string | null;
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

function effectiveVoucherStatus(src: VoucherSummary): VoucherStatus {
  const rawStatus = String(src.status || "active").toLowerCase();
  const now = Date.now();

  let expired = false;

  if (
    rawStatus === "expired" ||
    rawStatus === "cancelled" ||
    rawStatus === "canceled"
  ) {
    expired = true;
  }

  const rawValid: any = (src as any).validUntil ?? (src as any).expiresAt;

  if (!expired && rawValid != null) {
    let ts: number | null = null;

    if (typeof rawValid === "number" && Number.isFinite(rawValid)) {
      ts = rawValid;
    } else if (typeof rawValid === "string") {
      const asNum = Number(rawValid);
      if (Number.isFinite(asNum)) ts = asNum;
      else {
        const parsed = Date.parse(rawValid);
        if (Number.isFinite(parsed)) ts = parsed;
      }
    } else if (rawValid && typeof rawValid === "object") {
      if (typeof rawValid.toDate === "function") {
        ts = rawValid.toDate().getTime();
      } else if (typeof (rawValid as any)._seconds === "number") {
        ts = (rawValid as any)._seconds * 1000;
      }
    }

    if (ts != null && ts <= now) {
      expired = true;
    }
  }

  const max = typeof src.maxUses === "number" ? src.maxUses : null;
  const used = typeof src.usedCount === "number" ? src.usedCount : null;

  if (!expired && max != null && used != null && used >= max) {
    return "redeemed";
  }

  if (expired) return "expired";

  return "active";
}

function mapVoucherSummary(src: VoucherSummary): Voucher {
  const status = effectiveVoucherStatus(src);
  const anySrc = src as any;
  const assignedTo = anySrc.assignedTo || {};

  const assignedName = 
    src.assignedName || 
    anySrc.assigned_name || 
    assignedTo.name || 
    null;

  const assignedType = 
    src.assignedType || 
    anySrc.assigned_type || 
    assignedTo.type || 
    null;

  const sectionName = src.sectionName ?? anySrc.section_name ?? anySrc.section ?? null;
  const teamSide = src.teamSide ?? anySrc.team_side ?? anySrc.sideLabel ?? anySrc.side_label ?? null;

  const maxUses =
    typeof src.maxUses === "number" && Number.isFinite(src.maxUses)
      ? src.maxUses
      : anySrc.max_uses ?? anySrc.maxPax ?? null;

  const usedCount =
    typeof src.usedCount === "number" && Number.isFinite(src.usedCount)
      ? src.usedCount
      : anySrc.used_count ?? anySrc.used ?? 0;

  return {
    id: src.id,
    voucherCode: src.code || src.id,
    voucherName: src.name || assignedName || "Voucher", 
    issuer: src.issuer || null,
    status,
    maxUses: maxUses ? Number(maxUses) : null,
    usedCount: usedCount ? Number(usedCount) : 0,
    createdAt: Date.now(),
    assignedName,
    assignedType,
    sectionName,
    teamSide
  };
}

// --- Main Component ---

export default function AllVouchers() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
  }>();

  // --- Context State ---
  const [eventId, setEventId] = useState(() => asString(params.eventId, ""));
  const [seasonId, setSeasonId] = useState(() => asString(params.seasonId, ""));
  const [eventName, setEventName] = useState(() => asString(params.eventName, "Event"));

  // --- Data State ---
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Filter State ---
  const [q, setQ] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<"status" | "section" | null>(null);
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | "all">("all");
  const [filterSectionSide, setFilterSectionSide] = useState<string>("all");

  const [backBusy, setBackBusy] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Load Context ---
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

  // --- Load Data ---
  const loadVouchers = useCallback(() => {
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
        const res = await scannerApi.fetchVouchers(eventId, seasonId);
        const items = Array.isArray(res.items) ? res.items : [];
        const mapped = items.map(mapVoucherSummary);
        if (!cancelled) setData(mapped);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || "Failed to load vouchers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, seasonId]);

  useFocusEffect(useCallback(() => { const cleanup = loadVouchers(); return cleanup; }, [loadVouchers]));

  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current); }, []);

  // --- Derived Data: Sections ---
  const availableSectionSides = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      const section = t.sectionName ? t.sectionName.trim() : "";
      const side = t.teamSide ? t.teamSide.trim() : "";
      let combined = "";
      if (section && side) combined = `${section} - ${side}`;
      else if (section) combined = section;
      else if (side) combined = side;
      if (combined) set.add(combined);
    });
    return Array.from(set).sort();
  }, [data]);

  // --- Filtering ---
  const filtered = useMemo(() => {
    let out = data;

    // 1. Search
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(v =>
        v.voucherCode.toLowerCase().includes(s) ||
        v.voucherName.toLowerCase().includes(s) ||
        (v.assignedName || "").toLowerCase().includes(s) ||
        (v.assignedType || "").toLowerCase().includes(s)
      );
    }

    // 2. Status
    if (statusFilter !== "all") {
      out = out.filter(v => v.status === statusFilter);
    }

    // 3. Section
    if (filterSectionSide !== "all") {
      out = out.filter(v => {
        const section = v.sectionName ? v.sectionName.trim() : "";
        const side = v.teamSide ? v.teamSide.trim() : "";
        let combined = "";
        if (section && side) combined = `${section} - ${side}`;
        else if (section) combined = section;
        else if (side) combined = side;
        return combined === filterSectionSide;
      });
    }

    return out;
  }, [data, q, statusFilter, filterSectionSide]);

  // --- Handlers ---
  const onSearch = () => setQ(q.trim());
  const toggleDropdown = (key: "status" | "section") => setActiveDropdown(prev => prev === key ? null : key);

  const handleBack = () => {
    if (backBusy) return;
    setBackBusy(true);
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/");
    backTimer.current = setTimeout(() => setBackBusy(false), 400);
  };

  const renderItem = ({ item }: { item: Voucher }) => {
    const used = typeof item.usedCount === "number" ? item.usedCount : 0;
    const max = typeof item.maxUses === "number" && item.maxUses > 0 ? item.maxUses : null;
    const destination = item.status === "active" ? "/views/confirmVoucher" : "/views/viewVoucher";

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
        onPress={() =>
          router.push({
            pathname: destination,
            params: {
              eventId,
              seasonId,
              eventName,
              voucherId: item.id,
              status: item.status,
              assignedName: item.assignedName || "",
              assignedType: item.assignedType || "",
              code: item.voucherCode,
              maxUses: max != null ? String(max) : "",
              usedCount: String(used),
              source: "allVouchers",
            },
          })
        }
      >
        <View style={styles.leftCol}>
          <Text style={styles.name}>{item.assignedName || item.voucherName || "Untitled voucher"}</Text>
          <Text style={styles.issuer}>{item.assignedType || "No type specified"}</Text>
          <Text style={styles.code}>Voucher ID: {item.id}</Text>
          <Text style={styles.pax}>{used}{"/"}{max != null ? max : "∞"} uses</Text>
        </View>
        <View style={styles.rightRail}>
          <StatusBadge status={item.status} />
          <Ionicons name="chevron-forward" size={18} color="#C7CCD6" />
        </View>
      </Pressable>
    );
  };

  const getLabel = (key: string, val: string) => {
    if (key === 'status') return val === 'all' ? "All Statuses" : val.charAt(0).toUpperCase() + val.slice(1);
    if (key === 'section') return val === 'all' ? "All Sections" : val;
    return val;
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header with Total Count */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={12} disabled={backBusy} style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: "#F2F3F7" }]}>
          <Ionicons name="arrow-back" size={22} color={BLUE} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.topTitle}>Vouchers</Text>
            <Text style={styles.topSubtitle}>Total: {data.length}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.headerSeparator} />

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name, type, or code"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        <Pressable onPress={onSearch} style={styles.searchBtn}>
          <Ionicons name="search" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Filter Dropdown Bar */}
      <View style={styles.filterBar}>
        <FilterDropdownButton label={getLabel('status', statusFilter)} active={activeDropdown === 'status'} onPress={() => toggleDropdown('status')} />
        <FilterDropdownButton label={getLabel('section', filterSectionSide)} active={activeDropdown === 'section'} onPress={() => toggleDropdown('section')} />
      </View>

      {/* Dropdown Content Area */}
      {activeDropdown && (
        <View style={styles.dropdownContent}>
            <View style={styles.chipContainer}>
                {activeDropdown === 'status' && (
                    <>
                        {['all', 'active', 'redeemed', 'expired'].map((s) => (
                            <FilterChip 
                                key={s} 
                                label={s === 'all' ? 'All' : getLabel('status', s)} 
                                active={statusFilter === s} 
                                onPress={() => { setStatusFilter(s as any); setActiveDropdown(null); }} 
                            />
                        ))}
                    </>
                )}
                {activeDropdown === 'section' && (
                    <>
                        <FilterChip label="All" active={filterSectionSide === 'all'} onPress={() => { setFilterSectionSide('all'); setActiveDropdown(null); }} />
                        {availableSectionSides.map(s => (
                            <FilterChip key={s} label={s} active={filterSectionSide === s} onPress={() => { setFilterSectionSide(s); setActiveDropdown(null); }} />
                        ))}
                    </>
                )}
            </View>
        </View>
      )}

      {loadError && <View style={styles.errorBox}><Ionicons name="warning-outline" size={18} color="#DC2626" /><Text style={styles.errorText}>{loadError}</Text></View>}
      {loading && <View style={styles.loadingRow}><ActivityIndicator size="small" /><Text style={styles.loadingText}>Loading vouchers…</Text></View>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && { flex: 1 }]}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="gift-outline" size={32} color="#9CA3AF" /><Text style={styles.emptyText}>{q || statusFilter !== "all" ? "No results" : "No vouchers yet"}</Text></View> : null}
        style={{ flex: 1 }}
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

function StatusBadge({ status }: { status: VoucherStatus }) {
  const palette = status === "active" ? { bg: "#071689", text: "#fff", label: "Active" } : status === "redeemed" ? { bg: "#16A34A", text: "#fff", label: "Redeemed" } : { bg: "#6B7280", text: "#fff", label: "Expired" };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{palette.label}</Text>
    </View>
  );
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
  filterBar: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  dropdownBtn: { flex: 1, flexDirection: 'row', height: 36, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  dropdownBtnActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  dropdownBtnText: { fontSize: 13, color: '#4B5563', flex: 1, marginRight: 4 },
  dropdownBtnTextActive: { color: BLUE, fontWeight: '600' },
  dropdownContent: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  chip: { borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", marginBottom: 4 },
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
  card: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderRadius: 12, minHeight: 78, shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  leftCol: { flex: 1, justifyContent: "center" },
  rightRail: { flexDirection: "row", alignItems: "center", gap: 8 },
  sep: { height: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#111" },
  code: { fontSize: 12, color: "#6B7280", marginTop: 2, fontVariant: ["tabular-nums"] },
  issuer: { fontSize: 12, color: "#4B5563", marginTop: 2 },
  pax: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  badge: { paddingHorizontal: 10, height: 24, minWidth: 70, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#6B7280" },
});