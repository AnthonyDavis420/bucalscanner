// app/views/welcome.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    BackHandler,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  const [showExit, setShowExit] = useState(false);

  // Intercept Android back button: show modal instead of navigating
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showExit) {
        setShowExit(false);
      } else {
        setShowExit(true);
      }
      return true;
    });
    return () => sub.remove();
  }, [showExit]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/bucal-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.buttonsContainer}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.push("views/scanner")}
          >
            <Text style={styles.buttonText}>Scan Tickets</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.push("views/createTicket")}
          >
            <Text style={styles.buttonText}>On-site Purchase</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.viewTicketsButton, pressed && styles.buttonPressed]}
          onPress={() => router.push("views/allTickets")}
        >
          <Text style={styles.buttonText}>View Tickets</Text>
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
          {/* Tap outside to close */}
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowExit(false)} />

          {/* Card */}
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Logout?</Text>
            <Text style={styles.modalText}>
              You’re on the home screen. Do you want to Logout?
            </Text>

            <View style={styles.modalRow}>
              {/* LEFT: Exit (red) */}
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

              {/* RIGHT: Stay (blue) */}
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
  logo: { width: 264, height: 264, marginBottom: 48 },
  buttonsContainer: { width: "100%", marginBottom: 32 },
  button: {
    width: "100%",
    height: 85,
    borderRadius: 10,
    backgroundColor: "#071689",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  viewTicketsButton: {
    width: "100%",
    height: 52,
    borderRadius: 10,
    backgroundColor: "#071689",
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
  // full-screen invisible layer to capture taps
  modalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: "88%",            // extra whitespace at the sides
    borderRadius: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 22,   // a bit more inner padding
    paddingVertical: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  modalText: { marginTop: 8, color: "#4B5563" },
  modalRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  modalDanger: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935", // red
  },
  modalPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071689", // blue
  },
});
