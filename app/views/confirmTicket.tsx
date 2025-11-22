// app/views/confirmTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

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

  // --- Actions ---
  const handleRedeem = () => setStatus("redeemed");
  const handleInvalidate = () => setStatus("invalid");
  const handleScanAgain = () => router.replace("/views/scanner");
  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");

  const handleBack = () => {
    if (isCreateMode) {
      router.replace("/views/welcome");
      return;
    }
    // If we are on the Success Screen, back goes to scanner/list
    if (status === "redeemed") {
      router.back();
      return;
    }
    router.back();
  };

  // --- HEADER LOGIC ---
  const header = useMemo(() => {
    if (isCreateMode) return { text: "Ticket is Created!", color: "#071689" };
    switch (status) {
      case "active": return { text: "Ticket is Valid!", color: "#2E7D32" };
      case "invalid": return { text: "Ticket is Invalid!", color: "#E53935" };
      case "expired": return { text: "Ticket is Expired!", color: "#6B7280" };
      case "redeemed": return { text: "Voucher Claimed!", color: "#2E7D32" }; // Added Header for Redeemed
      default: return { text: "Ticket", color: "#333" };
    }
  }, [status, isCreateMode]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Bar (Now visible for ALL states including Redeemed) */}
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
        
        {/* --- RENDER: REDEEMED / SUCCESS VIEW --- */}
        {status === "redeemed" ? (
          <View style={styles.centeredContent}>
            <Ionicons name="checkmark-circle" size={100} color="#2E7D32" style={{marginBottom: 16}} />
            
            {/* Removed the big "Voucher Claimed" title here since it's in the header now, 
                but kept the subtitle for context */}
            <Text style={styles.successSubtitle}>Successfully verified.</Text>

            <View style={styles.successCard}>
              <Text style={styles.successLabel}>HOLDER NAME</Text>
              <Text style={styles.successValue}>{holderName}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.successLabel}>TICKET ID</Text>
              <Text style={styles.successValue}>{ticketId}</Text>
            </View>

            <View style={styles.successActions}>
              <Pressable onPress={handleScanAgain} style={[styles.cta, { backgroundColor: "#071689" }]}>
                <Text style={styles.ctaText}>Scan Next Ticket</Text>
              </Pressable>
              
              <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
                <Text style={[styles.ctaText, { color: "#111" }]}>Back to List</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* --- RENDER: STANDARD VIEW (Active, Invalid, Create, Expired) --- */
          <>
            <TicketQRCode value={code} status={status} />

            <View style={styles.meta}>
              <MetaRow label="Event" value={eventName} />
              <MetaRow label="Name" value={holderName} />
              <MetaRow label="Side" value={side} />
              <MetaRow label="Ticket ID" value={ticketId} />
            </View>

            {/* Create Mode Actions */}
            {isCreateMode && (
              <View style={styles.row}>
                <Pressable onPress={goHome} style={[styles.cta, styles.ghost, { flex: 1 }]}>
                  <Text style={[styles.ctaText, { color: "#111" }]}>Back to Home</Text>
                </Pressable>
                <Pressable onPress={createNextTicket} style={[styles.cta, { backgroundColor: "#071689", flex: 1 }]}>
                  <Text style={styles.ctaText}>Create Next Ticket</Text>
                </Pressable>
              </View>
            )}

            {/* Valid/Active Actions */}
            {!isCreateMode && status === "active" && (
              <View style={styles.row}>
                <Pressable onPress={handleInvalidate} style={[styles.cta, { backgroundColor: "#E53935", flex: 1 }]}>
                  <Text style={styles.ctaText}>Invalid</Text>
                </Pressable>
                <Pressable onPress={handleRedeem} style={[styles.cta, { backgroundColor: "#071689", flex: 1 }]}>
                  <Text style={styles.ctaText}>Redeem</Text>
                </Pressable>
              </View>
            )}

            {/* Invalid Actions */}
            {!isCreateMode && status === "invalid" && (
              <View style={styles.row}>
                <Pressable onPress={handleBack} style={[styles.cta, styles.ghost, { flex: 1 }]}>
                  <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
                </Pressable>
                <Pressable onPress={handleScanAgain} style={[styles.cta, { backgroundColor: "#071689", flex: 1 }]}>
                  <Text style={styles.ctaText}>Scan Again</Text>
                </Pressable>
              </View>
            )}

            {/* Expired Actions */}
            {!isCreateMode && status === "expired" && (
              <View style={styles.row}>
                <Pressable onPress={handleBack} style={[styles.cta, styles.ghost, { flex: 1 }]}>
                  <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/* --- Sub Components --- */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TicketQRCode({ value, status }: { value: string; status: TicketStatus }) {
  const size = Math.min(Dimensions.get("window").width - 100, 220);
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

/* --- Styles --- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  // Header
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

  // Content Body
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  // Redeemed / Success Specific
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  successSubtitle: { fontSize: 16, color: "#666", marginTop: 4, marginBottom: 32 },
  successCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 32,
  },
  successLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  successValue: { fontSize: 18, color: "#111", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  successActions: { width: "100%", gap: 12 },

  // QR Styles
  qrWrap: { alignItems: "center", marginTop: 40, marginBottom: 32 },
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
    marginTop: 16, 
    fontSize: 13, 
    color: "#6B7280", 
    fontFamily: "Courier New", 
    fontWeight: "600",
    letterSpacing: 1
  },

  // Meta Info
  meta: { gap: 10 },
  metaRow: { flexDirection: "row", gap: 6 },
  metaLabel: { width: 92, color: "#444", fontSize: 14 },
  metaValue: { flex: 1, color: "#111", fontWeight: "600", fontSize: 14 },

  // Buttons
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  cta: {
    marginTop: 0,
    flex: undefined,
    width: "100%", 
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});