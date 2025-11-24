// app/views/viewVoucher.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

type VoucherStatus = "active" | "redeemed" | "expired";

export default function ViewVoucher() {
  const params = useLocalSearchParams<{
    voucherName?: string;
    voucherCode?: string;
    issuer?: string;
    maxPax?: string;
    remainingPax?: string;
    status?: VoucherStatus;
  }>();

  const voucherName = params.voucherName ?? "VIP Group Access";
  const voucherCode = params.voucherCode ?? "VOU-992-AA";
  const issuer = params.issuer ?? "ADNU Athletics";
  const maxPax = params.maxPax ? parseInt(params.maxPax, 10) || 0 : 10;
  const remainingPax = params.remainingPax
    ? parseInt(params.remainingPax, 10) || 0
    : 7;
  const status: VoucherStatus = (params.status as VoucherStatus) ?? "active";

  const header = useMemo(() => {
    switch (status) {
      case "active":
        return { text: "Active Voucher", color: "#2E7D32" };
      case "redeemed":
        return { text: "Redeemed Voucher", color: "#071689" };
      case "expired":
      default:
        return { text: "Expired Voucher", color: "#6B7280" };
    }
  }, [status]);

  const windowWidth = Dimensions.get("window").width;
  const qrSize = Math.min(windowWidth - 120, 200);
  const qrOpacity = status === "active" ? 1 : 0.35;

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header.color }]}>
          {header.text}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* QR + code */}
        <View style={styles.qrWrap}>
          <View style={[styles.qrBox, { opacity: qrOpacity }]}>
            <QRCode value={voucherCode} size={qrSize} />
          </View>
          <Text style={styles.codeText}>{voucherCode}</Text>
        </View>

        {/* Main info */}
        <View style={styles.card}>
          <Text style={styles.voucherName}>{voucherName}</Text>
          <Text style={styles.issuerText}>Issued by {issuer}</Text>
        </View>

        {/* Details */}
        <View style={styles.details}>
          <MetaRow label="Voucher code" value={voucherCode} />
          <MetaRow label="Issuer" value={issuer} />
          <MetaRow
            label="Pax limit"
            value={`${maxPax} people`}
          />
          <MetaRow
            label="Remaining pax"
            value={`${remainingPax} people`}
          />
          <MetaRow
            label="Status"
            value={status.charAt(0).toUpperCase() + status.slice(1)}
          />
        </View>

        {/* Extra padding at bottom */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* small component */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
  },

  qrWrap: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
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
    letterSpacing: 1,
  },

  card: {
    alignItems: "center",
    marginBottom: 18,
  },
  voucherName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  issuerText: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
  },

  details: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
  },
  metaLabel: {
    width: 110,
    color: "#4B5563",
    fontSize: 14,
  },
  metaValue: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
    fontSize: 14,
  },
});

