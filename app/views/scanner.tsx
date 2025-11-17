// app/views/scanner.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const navigation = useNavigation();
  const [backBusy, setBackBusy] = useState(false);
  const backTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!permission) requestPermission();
    return () => backTimer.current && clearTimeout(backTimer.current);
  }, [permission]);

  const handleBack = () => {
    if (backBusy) return;
    setBackBusy(true);
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace("/");
    }
    backTimer.current = setTimeout(() => setBackBusy(false), 400);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Requesting camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ marginBottom: 12 }}>Camera access is required</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          disabled={backBusy}
          style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: "#F2F3F7" }]}
        >
          <Ionicons name="arrow-back" size={22} color="#071689" />
        </Pressable>
        <Text style={styles.topTitle}>Scan Tickets</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.headerSeparator} />

      <View style={styles.content}>
        <View style={styles.scannerBox}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128"] }}
            onBarcodeScanned={() => {}}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { backgroundColor: "#06126E" }]}
          onPress={() => router.push("/views/confirmTicket")}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Go to Confirm</Text>
        </Pressable>
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
    paddingTop: 6,
    paddingBottom: 10,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#071689",
  },

  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 18, alignItems: "center" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  scannerBox: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 24,
  },

  primaryBtn: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#071689",
    borderRadius: 10,
    alignItems: "center",
    gap: 6,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
