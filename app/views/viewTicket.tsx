// app/views/viewTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TicketStatus = "active" | "redeemed" | "invalid" | "expired";

export default function ViewTicket() {
  const params = useLocalSearchParams<{
    status?: TicketStatus;
    eventName?: string;
    holderName?: string;
    side?: string;
    ticketId?: string;
    code?: string;
  }>();

  const [status, setStatus] = useState<TicketStatus>(params.status ?? "active");

  const eventName = params.eventName ?? "ADNU vs NCF Game 1 Finals";
  const holderName = params.holderName ?? "John Doe";
  const side = params.side ?? "ADNU @ Courtside";
  const ticketId = params.ticketId ?? "8305463";
  const code = params.code ?? "EVT-8305463";

  const header = useMemo(() => {
    switch (status) {
      case "active":
        return { text: "Active Ticket", color: "#2E7D32" };
      case "redeemed":
        return { text: "Redeemed Ticket", color: "#071689" };
      case "invalid":
        return { text: "Invalid Ticket", color: "#E53935" };
      case "expired":
        return { text: "Expired Ticket", color: "#6B7280" };
    }
  }, [status]);

  const handleRedeem = () => setStatus("redeemed");
  const handleInvalidate = () => setStatus("invalid");
  const handleReactivate = () => setStatus("active");
  const handleBack = () => router.back();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header.color }]}>{header.text}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <BarcodePlaceholder value={code} />

        <View style={styles.meta}>
          <MetaRow label="Event" value={eventName} />
          <MetaRow label="Name" value={holderName} />
          <MetaRow label="Side" value={side} />
          <MetaRow label="Ticket ID" value={ticketId} />
          <MetaRow
            label="Status"
            value={status.charAt(0).toUpperCase() + status.slice(1)}
          />
        </View>

        {/* Actions */}
        {status === "active" && (
          <View style={styles.row}>
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleRedeem}
              style={[styles.cta, { backgroundColor: "#071689" }]}
            >
              <Text style={styles.ctaText}>Redeem</Text>
            </Pressable>
          </View>
        )}

        {status === "invalid" && (
          <View style={styles.row}>
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleRedeem}
              style={[styles.cta, { backgroundColor: "#071689" }]}
            >
              <Text style={styles.ctaText}>Redeem</Text>
            </Pressable>
          </View>
        )}

        {status === "redeemed" && (
          <View style={styles.row}>
            {/* Left: Back, Right: Invalid */}
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleInvalidate}
              style={[styles.cta, { backgroundColor: "#E53935" }]}
            >
              <Text style={styles.ctaText}>Invalid</Text>
            </Pressable>
          </View>
        )}

        {status === "expired" && (
          <View style={styles.row}>
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost, { flex: 1 }]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* small blocks */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function BarcodePlaceholder({ value }: { value: string }) {
  const maxWidth = Math.min(Dimensions.get("window").width - 48, 420);
  const height = 90;

  const bars = React.useMemo(() => {
    const arr: { w: number; isBar: boolean }[] = [];
    let isBar = true;
    let seed = 0;
    for (let i = 0; i < value.length; i++) seed += value.charCodeAt(i);
    for (let i = 0; i < 60; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const w = 2 + (seed % 5);
      arr.push({ w, isBar });
      isBar = !isBar;
    }
    return arr;
  }, [value]);

  const totalUnits = bars.reduce((s, b) => s + b.w, 0);
  const unit = maxWidth / totalUnits;

  return (
    <View style={styles.barcodeWrap}>
      <View style={[styles.barcodeBox, { width: maxWidth, height }]}>
        <View style={{ flexDirection: "row", height: "100%" }}>
          {bars.map((b, idx) => (
            <View
              key={idx}
              style={{
                width: Math.max(1, Math.round(b.w * unit)),
                height: "100%",
                backgroundColor: b.isBar ? "#111" : "transparent",
              }}
            />
          ))}
        </View>
      </View>
      <Text style={styles.barcodeCode}>{value}</Text>
    </View>
  );
}

/* styles */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  barcodeWrap: { alignItems: "center", marginBottom: 24 },
  barcodeBox: {
    marginTop: 60,
    marginBottom: 30,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  barcodeCode: { marginTop: 8, fontSize: 12, color: "#333" },

  meta: { gap: 10 },
  metaRow: { flexDirection: "row", gap: 6 },
  metaLabel: { width: 92, color: "#444", fontSize: 14 },
  metaValue: { flex: 1, color: "#111", fontWeight: "600", fontSize: 14 },

  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  cta: {
    marginTop: 50,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
