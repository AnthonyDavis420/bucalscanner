// app/views/confirmTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// 1. Import the QR Code library
import QRCode from "react-native-qrcode-svg";

type TicketStatus = "active" | "redeemed" | "invalid" | "expired";

export default function ConfirmTicket() {
  const params = useLocalSearchParams<{
    mode?: "create";
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
      router.replace("/views/welcome");
      return;
    }
    if (status === "active" || status === "expired") {
      router.back();
    } else {
      setTimeout(() => setStatus("active"), 50);
    }
  };

  const handleScanAgain = () => router.replace("/views/scanner");
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
        {/* 2. Use the new TicketQRCode component */}
        <TicketQRCode value={code} />

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

/** * 3. Replaced BarcodePlaceholder with TicketQRCode 
 */
function TicketQRCode({ value }: { value: string }) {
  const windowWidth = Dimensions.get("window").width;
  // Calculate size dynamically so it looks good on all screens, but cap it at 250
  const qrSize = Math.min(windowWidth - 100, 200);

  return (
    <View style={styles.qrWrap}>
      <View style={styles.qrBox}>
        <QRCode value={value} size={qrSize} />
      </View>
      <Text style={styles.qrCodeText}>{value}</Text>
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

  // 4. Updated styles for Square QR Code container
  qrWrap: { alignItems: "center", marginBottom: 24, marginTop: 20 },
  qrBox: {
    padding: 16,                // Inner padding so QR doesn't touch border
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    // Shadow for better visibility (optional)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeText: { marginTop: 12, fontSize: 14, fontWeight: "600", color: "#333", letterSpacing: 1 },

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
    marginTop: 30, // Reduced slightly to fit the taller QR code
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});