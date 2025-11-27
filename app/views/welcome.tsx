import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { scannerApi } from "../../lib/api";

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
  seasonName: "bucalscanner.activeSeasonName",
};

const BLUE = "#071689";
const LIGHT_BLUE = "#E0E7FF";
const BORDER_BLUE = "#C7D2FE";

export default function Welcome() {
  const [showExit, setShowExit] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [seasonId, setSeasonId] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");
  const [seasonName, setSeasonName] = useState<string>("");

  const [counts, setCounts] = useState({ tickets: 0, vouchers: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showExit) setShowExit(false);
      else setShowExit(true);
      return true;
    });
    return () => sub.remove();
  }, [showExit]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadData = async () => {
        try {
          const [id, season, name, sName] = await AsyncStorage.multiGet([
            STORAGE_KEYS.eventId,
            STORAGE_KEYS.seasonId,
            STORAGE_KEYS.eventName,
            STORAGE_KEYS.seasonName,
          ]);

          if (cancelled) return;

          const eId = (id?.[1] || "").trim();
          const sId = (season?.[1] || "").trim();
          const eName = (name?.[1] || "").trim();
          const activeSeason = (sName?.[1] || "").trim();

          setEventId(eId);
          setSeasonId(sId);
          setEventName(eName);
          setSeasonName(activeSeason);

          if (eId && sId) {
            fetchStats(eId, sId);
          }
        } catch (e) {}
      };

      loadData();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const fetchStats = async (eId: string, sId: string) => {
    setLoadingCounts(true);
    try {
      const [ticketsRes, vouchersRes] = await Promise.all([
        scannerApi.fetchTickets(eId, sId, []).catch(() => ({ items: [] })),
        scannerApi.fetchVouchers(eId, sId).catch(() => ({ items: [] })),
      ]);

      setCounts({
        tickets: ticketsRes.items?.length || 0,
        vouchers: vouchersRes.items?.length || 0,
      });
    } catch (error) {
      console.log("Error fetching stats:", error);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleChangeEvent = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.eventId,
        STORAGE_KEYS.seasonId,
        STORAGE_KEYS.eventName,
        STORAGE_KEYS.seasonName,
      ]);
    } catch {}
    router.replace("/");
  };

  const ensureEventSelected = (callback: () => void) => {
    if (!eventId || !seasonId) {
      Alert.alert("No Event", "Please choose an event first.");
      return;
    }
    callback();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/bucal-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.banner}>
          <View style={styles.bannerHeaderRow}>
            <View style={{ flex: 1 }}>
              {seasonName ? (
                <Text style={styles.seasonTitle}>{seasonName}</Text>
              ) : null}
              
              <Text style={styles.bannerTitle}>
                {eventName ? eventName : "Active Event"}
              </Text>
              <Text style={styles.bannerSub}>
                {eventId ? `ID: ${eventId}` : "No event selected yet"}
              </Text>
            </View>
            <Pressable onPress={handleChangeEvent} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.statsContainer}>
            {loadingCounts ? (
              <ActivityIndicator size="small" color={BLUE} style={{ padding: 10 }} />
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [styles.statItem, pressed && { opacity: 0.7 }]}
                  onPress={() => ensureEventSelected(() => router.push("/views/allTickets"))}
                >
                  <Text style={styles.statNumber}>{counts.tickets}</Text>
                  <Text style={styles.statLabel}>Total Tickets</Text>
                </Pressable>

                <View style={styles.statDivider} />

                <Pressable
                   style={({ pressed }) => [styles.statItem, pressed && { opacity: 0.7 }]}
                   onPress={() => ensureEventSelected(() => router.push("/views/allVouchers"))}
                >
                  <Text style={styles.statNumber}>{counts.vouchers}</Text>
                  <Text style={styles.statLabel}>Total Vouchers</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => ensureEventSelected(() => router.push("/views/scanner"))}
          >
            <Text style={styles.buttonText}>Scan Tickets</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => ensureEventSelected(() => router.push("/views/createTicket"))}
          >
            <Text style={styles.buttonText}>On-site Purchase</Text>
          </Pressable>
        </View>

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [
              styles.viewTicketsButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => ensureEventSelected(() => router.push("/views/allTickets"))}
          >
            <Text style={styles.buttonText}>View Tickets</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.viewVouchersButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => ensureEventSelected(() => router.push("/views/allVouchers"))}
          >
            <Text style={styles.voucherButtonText}>View Vouchers</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showExit}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExit(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropTap}
            onPress={() => setShowExit(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Exit app?</Text>
            <Text style={styles.modalText}>
              You’re on the home screen. Do you want to exit BucalScanner?
            </Text>

            <View style={styles.modalRow}>
              <Pressable
                onPress={() => {
                  setShowExit(false);
                  BackHandler.exitApp();
                }}
                style={({ pressed }) => [
                  styles.modalDanger,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Exit</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowExit(false)}
                style={({ pressed }) => [
                  styles.modalPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Stay</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 180, height: 180, marginBottom: 10 },

  banner: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    padding: 16,
    marginBottom: 24,
    backgroundColor: "#F8FAFF",
    gap: 12,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  seasonTitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  bannerSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: LIGHT_BLUE,
  },
  changeBtnText: { color: BLUE, fontWeight: "700", fontSize: 12 },

  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: BORDER_BLUE,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: BLUE,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: "70%",
    backgroundColor: BORDER_BLUE,
  },

  buttonsContainer: { width: "100%", marginBottom: 20 },
  button: {
    width: "100%",
    height: 64,
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  secondaryRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },

  viewTicketsButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },

  viewVouchersButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: LIGHT_BLUE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER_BLUE,
  },

  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  voucherButtonText: { color: BLUE, fontSize: 16, fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBackdropTap: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    width: "88%",
    borderRadius: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  modalText: { marginTop: 8, color: "#4B5563" },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  modalDanger: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
  },
  modalPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE,
  },
});