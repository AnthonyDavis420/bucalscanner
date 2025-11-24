// app/views/welcome.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
};

export default function Welcome() {
  const [showExit, setShowExit] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");

  // Intercept Android back button: show modal instead of navigating
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showExit) setShowExit(false);
      else setShowExit(true);
      return true;
    });
    return () => sub.remove();
  }, [showExit]);

  // Load active event info
  useEffect(() => {
    (async () => {
      try {
        const [id, name] = await AsyncStorage.multiGet([
          STORAGE_KEYS.eventId,
          STORAGE_KEYS.eventName,
        ]);
        setEventId((id?.[1] || "").trim());
        setEventName((name?.[1] || "").trim());
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleChangeEvent = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.eventId,
        STORAGE_KEYS.seasonId,
        STORAGE_KEYS.eventName,
      ]);
    } catch {}
    router.replace("/"); // go back to event code entry
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/bucal-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Active event banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>
            {eventName ? eventName : "Active Event"}
          </Text>
          <Text style={styles.bannerSub}>
            {eventId ? `Event ID: ${eventId}` : "No event selected yet"}
          </Text>
          <Pressable onPress={handleChangeEvent} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change Event</Text>
          </Pressable>
        </View>

        <View style={styles.buttonsContainer}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => {
              if (!eventId) {
                Alert.alert("No Event", "Please choose an event first.");
                return;
              }
              router.push("/views/scanner");
            }}
          >
            <Text style={styles.buttonText}>Scan Tickets</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => {
              if (!eventId) {
                Alert.alert("No Event", "Please choose an event first.");
                return;
              }
              router.push("/views/createTicket");
            }}
          >
            <Text style={styles.buttonText}>On-site Purchase</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.viewTicketsButton, pressed && styles.buttonPressed]}
          onPress={() => {
            if (!eventId) {
              Alert.alert("No Event", "Please choose an event first.");
              return;
            }
            router.push("/views/allTickets");
          }}
        >
          <Text style={styles.buttonText}>View Tickets</Text>
        </Pressable>

        {/* NEW: View Vouchers button */}
        <Pressable
          style={({ pressed }) => [
            styles.viewTicketsButton,
            { marginTop: 12 },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            if (!eventId) {
              Alert.alert("No Event", "Please choose an event first.");
              return;
            }
            router.push("/views/allVouchers");
          }}
        >
          <Text style={styles.buttonText}>View Vouchers</Text>
        </Pressable>
      </View>

      {/* Exit confirmation */}
      <Modal
        visible={showExit}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExit(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowExit(false)} />
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
                style={({ pressed }) => [styles.modalDanger, pressed && { opacity: 0.9 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Exit</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowExit(false)}
                style={({ pressed }) => [styles.modalPrimary, pressed && { opacity: 0.9 }]}
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

const BLUE = "#071689";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 200, height: 200, marginBottom: 18 },

  banner: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 22,
    backgroundColor: "#F8FAFF",
    alignItems: "flex-start",
    gap: 6,
  },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  bannerSub: { fontSize: 13, color: "#4B5563" },
  changeBtn: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  changeBtnText: { color: BLUE, fontWeight: "700", fontSize: 12 },

  buttonsContainer: { width: "100%", marginBottom: 32 },
  button: {
    width: "100%",
    height: 70,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  viewTicketsButton: {
    width: "100%",
    height: 52,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // modal
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
