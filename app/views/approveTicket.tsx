// app/views/confirmTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TicketStatus = "active" | "redeemed" | "invalid" | "expired";

export default function ConfirmTicket() {
  const params = useLocalSearchParams<{
    mode?: "create";
    status?: TicketStatus;
  }>();

  const isCreateMode = params.mode === "create";
  const [status, setStatus] = useState<TicketStatus>(params.status ?? "active");

  const header = useMemo(() => {
    if (isCreateMode) return { text: "Tickets Created!", color: "#071689" };
    switch (status) {
      case "active":
        return { text: "Ticket is Valid!", color: "#2E7D32" };
      case "redeemed":
        return { text: "Ticket Redeemed!", color: "#071689" };
      case "invalid":
        return { text: "Ticket is Invalid!", color: "#E53935" };
      case "expired":
        return { text: "Ticket is Expired!", color: "#6B7280" };
      default:
        return { text: "Ticket Status", color: "#071689" };
    }
  }, [status, isCreateMode]);

  const subtitle = useMemo(() => {
    if (isCreateMode) {
      return "The tickets have been purchased successfully.";
    }
    switch (status) {
      case "active":
        return "This ticket can be used to enter the event.";
      case "redeemed":
        return "This ticket has already been used.";
      case "invalid":
        return "This ticket is not recognized or has been revoked.";
      case "expired":
        return "This ticket is no longer valid for entry.";
      default:
        return "";
    }
  }, [status, isCreateMode]);

  const handleTopBack = () => {
    if (isCreateMode) {
      router.replace("/views/welcome");
    } else {
      router.back();
    }
  };

  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");
  const scanAgain = () => router.replace("/views/scanner");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleTopBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header.color }]}>{header.text}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        {/* Centered confirmation card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={isCreateMode ? "checkmark-circle" : "ticket-outline"}
              size={48}
              color="#071689"
            />
          </View>
          <Text style={styles.mainText}>{header.text}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Actions */}
        {isCreateMode ? (
          <View style={styles.row}>
            <Pressable onPress={goHome} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back to Home</Text>
            </Pressable>
            <Pressable onPress={createNextTicket} style={[styles.cta, { backgroundColor: "#071689" }]}>
              <Text style={styles.ctaText}>Create Next Ticket</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable onPress={handleTopBack} style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
            </Pressable>
            <Pressable onPress={scanAgain} style={[styles.cta, { backgroundColor: "#071689" }]}>
              <Text style={styles.ctaText}>Scan Another Ticket</Text>
            </Pressable>
          </View>
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
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    justifyContent: "space-between",
  },

  card: {
    marginTop: 40,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4FF",
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  mainText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#071689",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
