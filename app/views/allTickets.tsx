// app/views/viewTickets.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TicketStatus = "active" | "redeemed" | "invalid" | "expired";

type Ticket = {
  id: string;
  code: string;
  holderName: string;
  status: TicketStatus;
  createdAt: number;
};

const mockTickets: Ticket[] = [
  { id: "1", code: "EVT-8305463", holderName: "John Doe", status: "active", createdAt: Date.now() - 100000 },
  { id: "2", code: "EVT-8305464", holderName: "Jane Smith", status: "redeemed", createdAt: Date.now() - 200000 },
  { id: "3", code: "EVT-8305465", holderName: "Carlos Reyes", status: "invalid", createdAt: Date.now() - 300000 },
  { id: "4", code: "EVT-8305466", holderName: "Ava Santos", status: "active", createdAt: Date.now() - 400000 },
  { id: "5", code: "EVT-8305467", holderName: "Liam Cruz", status: "redeemed", createdAt: Date.now() - 500000 },
  { id: "6", code: "EVT-8305468", holderName: "Mia Dela Cruz", status: "expired", createdAt: Date.now() - 700000 },
  { id: "7", code: "EVT-8305469", holderName: "Noah Garcia", status: "expired", createdAt: Date.now() - 800000 },
  { id: "8", code: "EVT-8305470", holderName: "Ella Ramos", status: "expired", createdAt: Date.now() - 900000 },
];

export default function ViewTickets() {
  const navigation = useNavigation();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [data] = useState<Ticket[]>(mockTickets);
  const [backBusy, setBackBusy] = useState(false);
  const backTimer = useRef<NodeJS.Timeout | null>(null);

  const filtered = useMemo(() => {
    const base = statusFilter === "all" ? data : data.filter(t => t.status === statusFilter);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(
      t =>
        t.code.toLowerCase().includes(s) ||
        t.holderName.toLowerCase().includes(s)
    );
  }, [data, q, statusFilter]);

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

  const renderItem = ({ item }: { item: Ticket }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      onPress={() =>
        router.push({
          pathname: "/views/viewTicket",
          params: {
            status: item.status,
            holderName: item.holderName,
            ticketId: item.id,
            code: item.code,
            eventName: "Sample Event",
            side: "Section A",
          },
        })
      }
    >
      {/* left column */}
      <View style={styles.leftCol}>
        <Text style={styles.name}>{item.holderName || "No name"}</Text>
        <Text style={styles.code}>{item.code}</Text>
      </View>

      {/* right rail */}
      <View style={styles.rightRail}>
        <StatusBadge status={item.status} />
        <Ionicons name="chevron-forward" size={18} color="#C7CCD6" />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          disabled={backBusy}
          style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: "#F2F3F7" }]}
        >
          <Ionicons name="arrow-back" size={22} color="#071689" />
        </Pressable>
        <Text style={styles.topTitle}>Tickets</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.headerSeparator} />

      {/* search */}
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

      {/* filters */}
      <View style={styles.filterRow}>
        <FilterChip label="All" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        <FilterChip label="Active" active={statusFilter === "active"} onPress={() => setStatusFilter("active")} />
        <FilterChip label="Redeemed" active={statusFilter === "redeemed"} onPress={() => setStatusFilter("redeemed")} />
        <FilterChip label="Invalid" active={statusFilter === "invalid"} onPress={() => setStatusFilter("invalid")} />
        <FilterChip label="Expired" active={statusFilter === "expired"} onPress={() => setStatusFilter("expired")} />
        <Pressable onPress={onClear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {/* list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="documents-outline" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {q || statusFilter !== "all" ? "No results" : "No tickets yet"}
            </Text>
          </View>
        }
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}

/* components */

function StatusBadge({ status }: { status: TicketStatus }) {
  const palette =
    status === "active"
      ? { bg: "#071689", text: "#fff" }
      : status === "redeemed"
      ? { bg: "#16A34A", text: "#fff" }
      : status === "invalid"
      ? { bg: "#EF4444", text: "#fff" }
      : { bg: "#6B7280", text: "#fff" }; // expired
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
        active && { backgroundColor: "#071689", borderColor: "#071689" },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.chipText, active && { color: "#fff", fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}

/* styles */

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
  searchBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

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

  listContent: { padding: 12, paddingTop: 6 },

  card: {
    flexDirection: "row",
    alignItems: "center",           // vertical middle
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    minHeight: 68,                   // consistent height so centering looks right
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },

  leftCol: { flex: 1, justifyContent: "center" },

  rightRail: { flexDirection: "row", alignItems: "center", gap: 8 },

  sep: { height: 8 },

  name: { fontSize: 15, fontWeight: "700", color: "#111" },
  code: { fontSize: 12, color: "#6B7280", marginTop: 2, fontVariant: ["tabular-nums"] },

  badge: {
    paddingHorizontal: 10,
    height: 24,
    minWidth: 68,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#6B7280" },
});
