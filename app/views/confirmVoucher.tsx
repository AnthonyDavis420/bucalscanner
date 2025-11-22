import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ConfirmVoucher() {
  const params = useLocalSearchParams<{
    voucherName?: string;
    voucherCode?: string;
    issuer?: string;
    maxPax?: string;
  }>();

  const voucherName = params.voucherName ?? "VIP Group Access";
  const voucherCode = params.voucherCode ?? "VOU-992-AA";
  const issuer = params.issuer ?? "ADNU Athletics";
  const maxPax = params.maxPax ? parseInt(params.maxPax, 10) : 10;

  // Dynamic QR Size
  const windowWidth = Dimensions.get("window").width;
  const qrSize = Math.min(windowWidth - 100, 200);

  const [count, setCount] = useState(1);
  const [isRedeemed, setIsRedeemed] = useState(false);

  const decrement = () => {
    if (count > 1) setCount(c => c - 1);
  };

  const increment = () => {
    if (count < maxPax) setCount(c => c + 1);
  };

  const handleConfirm = () => {
    setIsRedeemed(true);
  };

  const handleBack = () => {
    router.back();
  };

  const handleScanNext = () => {
    router.replace("/views/scanner");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: isRedeemed ? "#071689" : "#2E7D32" }]}>
          {isRedeemed ? "Redemption Complete" : "Voucher Valid!"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* 2. Scrollable Content (QR + Info + Counter) */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.qrBox}>
            <QRCode value={voucherCode} size={qrSize} />
        </View>

        <View style={styles.card}>
          <Text style={styles.voucherName}>{voucherName}</Text>
          <Text style={styles.voucherCode}>{voucherCode}</Text>
          <Text style={styles.issuer}>Issued by {issuer}</Text>
        </View>

        <View style={styles.divider} />

        {!isRedeemed ? (
          <View style={styles.counterContainer}>
            <Text style={styles.label}>Select Pax Entry</Text>
            
            <View style={styles.counterRow}>
              <Pressable 
                onPress={decrement} 
                style={({ pressed }) => [
                  styles.counterBtn, 
                  count <= 1 && styles.disabledBtn,
                  pressed && { opacity: 0.8 }
                ]}
                disabled={count <= 1}
              >
                <Ionicons name="remove" size={28} color="#fff" />
              </Pressable>

              <View style={styles.countDisplay}>
                <Text style={styles.countText}>{count}</Text>
                <Text style={styles.countLabel}>People</Text>
              </View>

              <Pressable 
                onPress={increment} 
                style={({ pressed }) => [
                    styles.counterBtn, 
                    count >= maxPax && styles.disabledBtn,
                    pressed && { opacity: 0.8 }
                ]}
                disabled={count >= maxPax}
              >
                <Ionicons name="add" size={28} color="#fff" />
              </Pressable>
            </View>
            
            <Text style={styles.limitText}>Max limit: {maxPax} pax</Text>
          </View>
        ) : (
            <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={48} color="#2E7D32" />
                <Text style={styles.successTitle}>{count} Pax Admitted</Text>
                <Text style={styles.successSub}>Recorded successfully</Text>
            </View>
        )}
        
        {/* Padding for scrolling behind footer */}
        <View style={{ height: 120 }} /> 
      </ScrollView>

      {/* 3. Fixed Footer (Always visible at bottom) */}
      <View style={styles.footer}>
        {!isRedeemed ? (
          <Pressable onPress={handleConfirm} style={styles.cta}>
            <Text style={styles.ctaText}>Confirm & Admit {count}</Text>
          </Pressable>
        ) : (
          // Removed the Home button here, just Scan Next
          <Pressable onPress={handleScanNext} style={styles.cta}>
              <Text style={styles.ctaText}>Scan Next</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

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

  // Scroll Layout
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, alignItems: 'center' },

  qrBox: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 24,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  card: { alignItems: "center", width: '100%' },
  voucherName: { fontSize: 22, fontWeight: "800", color: "#111", textAlign: "center" },
  voucherCode: { fontSize: 16, color: "#555", marginTop: 4, fontFamily: "Monospace" },
  issuer: { fontSize: 12, color: "#888", marginTop: 8 },

  divider: { 
    height: 1, backgroundColor: "#F0F0F0", width: "100%", marginVertical: 24 
  },

  counterContainer: { alignItems: "center", width: "100%" },
  label: { fontSize: 16, color: "#666", marginBottom: 20, fontWeight: "500" },
  
  counterRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 280
  },
  counterBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#071689",
    alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: {width:0, height:2}
  },
  disabledBtn: { backgroundColor: "#CCC", elevation: 0 },
  
  countDisplay: { alignItems: "center", width: 100 },
  countText: { fontSize: 48, fontWeight: "800", color: "#111" },
  countLabel: { fontSize: 14, color: "#666", fontWeight: "600" },
  
  limitText: { marginTop: 16, color: "#999", fontSize: 12 },

  successBox: { alignItems: 'center', marginTop: 10 },
  successTitle: { fontSize: 24, fontWeight: '700', color: "#111", marginTop: 12 },
  successSub: { fontSize: 16, color: "#666", marginTop: 4 },

  // Fixed Footer
  footer: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40, // Increased padding to lift button off the bottom edge
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  row: { flexDirection: "row", gap: 12 },
  cta: {
    flex: 1, height: 52, borderRadius: 10,
    backgroundColor: "#071689",
    alignItems: "center", justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});