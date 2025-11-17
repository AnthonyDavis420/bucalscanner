// app/views/confirmTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TicketStatus = "active" | "redeemed" | "invalid" | "expired";

export default function ConfirmTicket() {
  const params = useLocalSearchParams<{
    mode?: "create";               // <-- when present, show the "Ticket is Created!" view
    status?: TicketStatus;
    eventName?: string;
    holderName?: string;
    side?: string;
    ticketId?: string;
    code?: string;
  }>();

  const isCreateMode = params.mode === "create";

  const [status, setStatus] = useState<TicketStatus>(params.status ?? "active");

  const eventName = params.eventName ?? "ADNU vs NCF Game 1 Finals";
  const holderName = params.holderName ?? "John Doe";
  const side = params.side ?? "ADNU @ Courtside";
  const ticketId = params.ticketId ?? "8305463";
  const code = params.code ?? "EVT-8305463";

  const header = useMemo(() => {
    if (isCreateMode) {
      return { text: "Ticket is Created!", color: "#071689" };
    }
    switch (status) {
      case "active":
        return { text: "Ticket is Valid!", color: "#2E7D32" };
      case "redeemed":
        return { text: "Ticket Redeemed!", color: "#071689" };
      case "invalid":
        return { text: "Ticket is Invalid!", color: "#E53935" };
      case "expired":
        return { text: "Ticket is Expired!", color: "#6B7280" };
    }
  }, [status, isCreateMode]);

  const handleRedeem = () => setStatus("redeemed");
  const handleInvalidate = () => setStatus("invalid");

  const handleBack = () => {
    if (isCreateMode) {
      // In create mode, back should take the user home (no boomerang)
      router.replace("/views/welcome");
      return;
    }
    // For expired, just go back. For others, prevent the double-pop "boomerang".
    if (status === "active" || status === "expired") {
      router.back();
    } else {
      setTimeout(() => setStatus("active"), 50);
    }
  };

  const handleScanAgain = () => router.replace("/views/scanner");

  // Create-mode actions
  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");

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
        <Text style={[styles.title, { color: header?.color }]}>{header?.text}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <BarcodePlaceholder value={code} />

        <View style={styles.meta}>
          <MetaRow label="Event" value={eventName} />
          <MetaRow label="Name" value={holderName} />
          <MetaRow label="Side" value={side} />
          <MetaRow label="Ticket ID" value={ticketId} />
        </View>

        {/* ===== CREATE MODE ===== */}
        {isCreateMode && (
          <View style={styles.row}>
            <Pressable onPress={goHome} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back to Home</Text>
            </Pressable>
            <Pressable onPress={createNextTicket} style={[styles.cta, { backgroundColor: "#071689" }]}>
              <Text style={styles.ctaText}>Create Next Ticket</Text>
            </Pressable>
          </View>
        )}

        {/* ===== SCAN/VALIDATE MODE ===== */}
        {!isCreateMode && status === "active" && (
          <View style={styles.row}>
            <Pressable onPress={handleInvalidate} style={[styles.cta, { backgroundColor: "#E53935" }]}>
              <Text style={styles.ctaText}>Invalid</Text>
            </Pressable>
            <Pressable onPress={handleRedeem} style={[styles.cta, { backgroundColor: "#071689" }]}>
              <Text style={styles.ctaText}>Redeem</Text>
            </Pressable>
          </View>
        )}

        {!isCreateMode && status === "expired" && (
          <View style={styles.row}>
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost, { flex: 1 }]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
          </View>
        )}

        {!isCreateMode && (status === "redeemed" || status === "invalid") && (
          <View style={styles.row}>
            <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
            <Pressable onPress={handleScanAgain} style={[styles.cta, { backgroundColor: "#071689" }]}>
              <Text style={styles.ctaText}>Scan Again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* small UI blocks */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/** Fake barcode (no deps) */
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
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
