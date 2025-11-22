// app/views/viewTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
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

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <TicketQRCode value={code} status={status} />

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
        </View>

        {/* Actions Area */}
        <View style={styles.actionsContainer}>
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
      </ScrollView>
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

function TicketQRCode({ value, status }: { value: string; status: TicketStatus }) {
  const size = Math.min(Dimensions.get("window").width - 120, 200);
  const opacity = status === "active" ? 1.0 : 0.3; 

  return (
    <View style={styles.qrWrap}>
      <View style={[styles.qrBox, { opacity }]}>
        <QRCode value={value} size={size} />
      </View>
      <Text style={styles.codeText}>{value}</Text>
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
    backgroundColor: "#fff",
    zIndex: 10,
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },

  scrollContent: {
    flexGrow: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16,
    paddingBottom: 24,
    // REMOVED: justifyContent: 'space-between'
  },
  
  // This controls the gap above the buttons
  actionsContainer: {
    marginTop: 40, 
  },

  qrWrap: { 
    alignItems: "center", 
    marginTop: 24,
    marginBottom: 24
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  codeText: { 
    marginTop: 12, 
    fontSize: 13, 
    color: "#6B7280", 
    fontFamily: "Courier New", 
    fontWeight: "600",
    letterSpacing: 1
  },

  meta: { gap: 10 },
  metaRow: { flexDirection: "row", gap: 6 },
  metaLabel: { width: 92, color: "#444", fontSize: 14 },
  metaValue: { flex: 1, color: "#111", fontWeight: "600", fontSize: 14 },

  row: {
    flexDirection: "row",
    gap: 12,
  },
  cta: {
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});