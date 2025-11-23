// app/views/scanner.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type TicketSummary } from "../../lib/api";

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
};

function normalizeStatus(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

function showStatusAlert(
  kind: "Ticket" | "Voucher",
  statusRaw: string | null | undefined
) {
  const s = normalizeStatus(statusRaw);
  let nice = s;

  if (["redeemed", "used"].includes(s)) nice = "already redeemed";
  else if (s === "invalid") nice = "invalid";
  else if (s === "expired") nice = "expired";
  else if (["cancelled", "canceled"].includes(s)) nice = "cancelled";
  else if (s === "pending") nice = "pending";
  else if (!s) nice = "not active";

  Alert.alert(`${kind} Not Active`, `${kind} is ${nice}.`, [{ text: "OK" }]);
}

function getTicketStatus(t: TicketSummary | undefined): string {
  return normalizeStatus((t as any)?.status);
}

function getParentTicketId(t: TicketSummary | undefined): string | null {
  if (!t) return null;
  const v = (t.parentTicketId ?? (t as any).parent_ticket_id) as any;
  const s = v != null ? String(v).trim() : "";
  return s || null;
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [backBusy, setBackBusy] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanningLocked, setScanningLocked] = useState(false);

  const [eventId, setEventId] = useState<string>("");
  const [seasonId, setSeasonId] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");

  // Load active event info (same keys as welcome.tsx)
  useEffect(() => {
    (async () => {
      try {
        const [id, season, name] = await AsyncStorage.multiGet([
          STORAGE_KEYS.eventId,
          STORAGE_KEYS.seasonId,
          STORAGE_KEYS.eventName,
        ]);

        setEventId((id?.[1] || "").trim());
        setSeasonId((season?.[1] || "").trim());
        setEventName((name?.[1] || "").trim());
      } catch {
        // ignore
      }
    })();
  }, []);

  // Request camera permission once
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    return () => {
      if (backTimer.current) clearTimeout(backTimer.current);
    };
  }, [permission, requestPermission]);

  const handleBack = () => {
    if (backBusy) return;
    setBackBusy(true);

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace("/views/welcome");
    }

    backTimer.current = setTimeout(() => setBackBusy(false), 400);
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanningLocked) return;
    setScanningLocked(true);

    const raw = String(data ?? "");
    console.log("SCANNED RAW:", raw);

    try {
      let parsed: any = null;

      try {
        parsed = JSON.parse(raw);
      } catch {
        // Non-JSON payload → fallback to generic ticket confirm
        console.log("SCANNED PARSED: non-JSON payload");
        router.push({
          pathname: "/views/confirmTicket",
          params: {
            mode: "scan",
            code: encodeURIComponent(raw),
            eventName: eventName || "Event Ticket",
          },
        });
        return;
      }

      console.log("SCANNED PARSED:", parsed);
      const encodedPayload = encodeURIComponent(raw);

      const kind = String(parsed.kind || "").toLowerCase();
      const hasVoucherHint = kind === "voucher" || parsed.voucherId || parsed.voucher_id;
      const hasTicketHint = kind === "ticket" || parsed.ticketId || parsed.ticket_id;

      // ==========================
      // 🔹 VOUCHER FLOW
      // ==========================
      if (hasVoucherHint && !hasTicketHint) {
        const voucherIdFromCode = String(
          parsed.voucherId ?? parsed.voucher_id ?? ""
        ).trim();
        const seasonFromCode = String(
          parsed.seasonId ?? parsed.season_id ?? seasonId ?? ""
        ).trim();
        const eventFromCode = String(
          parsed.eventId ?? parsed.event_id ?? eventId ?? ""
        ).trim();

        console.log("VOUCHER HINT:", {
          voucherIdFromCode,
          seasonFromCode,
          eventFromCode,
        });

        if (!voucherIdFromCode || !seasonFromCode || !eventFromCode) {
          Alert.alert(
            "Invalid Voucher",
            "Voucher QR is missing information. Please try another code."
          );
          return;
        }

        try {
          const resp = await scannerApi.fetchVoucher(
            eventFromCode,
            seasonFromCode,
            voucherIdFromCode
          );
          const v = resp.item ?? {};
          const voucherStatusRaw = (v as any).status ?? null;
          const voucherStatus = normalizeStatus(voucherStatusRaw);

          console.log("VOUCHER FROM API:", {
            v,
            voucherStatus,
            voucherStatusRaw,
          });

          // block everything that is not clearly active
          if (!voucherStatus || voucherStatus !== "active") {
            showStatusAlert("Voucher", voucherStatus || "");
            return;
          }
        } catch (err: any) {
          console.log("FETCH VOUCHER ERROR:", err);
          Alert.alert(
            "Error",
            err?.message || "Failed to validate voucher. Please try again."
          );
          return;
        }

        // ✅ voucher is active → go to confirmVoucher
        router.push({
          pathname: "/views/confirmVoucher",
          params: { code: encodedPayload },
        });
        return;
      }

      // ==========================
      // 🔹 TICKET FLOW
      // ==========================
      const seasonFromCode = String(
        parsed.seasonId ?? parsed.season_id ?? seasonId ?? ""
      ).trim();
      const eventFromCode = String(
        parsed.eventId ?? parsed.event_id ?? eventId ?? ""
      ).trim();
      const ticketIdFromCode = String(
        parsed.ticketId ?? parsed.ticket_id ?? ""
      ).trim();

      console.log("TICKET PAYLOAD:", {
        eventFromCode,
        seasonFromCode,
        ticketIdFromCode,
      });

      if (seasonFromCode && eventFromCode && ticketIdFromCode) {
        try {
          const res = await scannerApi.fetchTickets(
            eventFromCode,
            seasonFromCode,
            [ticketIdFromCode]
          );
          const t = (res.items || [])[0] as TicketSummary | undefined;

          console.log("TICKET FROM API:", t);

          if (!t) {
            Alert.alert("Not Found", "Ticket not found for this code.");
            return;
          }

          const status = getTicketStatus(t);
          const parentTicketId = getParentTicketId(t);
          const role = normalizeStatus((t as any).role);

          console.log("TICKET STATUS/ROLE/PTID:", {
            status,
            role,
            parentTicketId,
          });

          // 🔸 Special case: already redeemed/used
          if (status === "redeemed" || status === "used") {
            Alert.alert(
              "Ticket Already Redeemed",
              "This ticket has already been redeemed.",
              [{ text: "OK" }]
            );
            return;
          }

          // 💡 Only allow tickets with explicit "active" status
          if (!status || status !== "active") {
            showStatusAlert("Ticket", status || "");
            return;
          }

          const isChildTicket = !!parentTicketId;

          if (isChildTicket) {
            try {
              const parentRes = await scannerApi.fetchTickets(
                eventFromCode,
                seasonFromCode,
                [parentTicketId]
              );
              const parent = (parentRes.items || [])[0] as
                | TicketSummary
                | undefined;

              console.log("PARENT TICKET:", parent);

              if (!parent) {
                Alert.alert(
                  "Sponsor Not Found",
                  "Sponsor ticket not found for this bundle. Please refer to the help desk."
                );
                return;
              }

              const parentStatus = getTicketStatus(parent);
              console.log("PARENT STATUS:", parentStatus);

              if (!["redeemed", "used"].includes(parentStatus)) {
                Alert.alert(
                  "Adult Ticket Not Redeemed",
                  "Please scan and redeem the adult ticket first before scanning child tickets.",
                  [{ text: "OK" }]
                );
                return;
              }
            } catch (err: any) {
              console.log("PARENT VALIDATION ERROR:", err);
              Alert.alert(
                "Error",
                err?.message ||
                  "Failed to validate sponsor ticket. Please try again."
              );
              return;
            }
          }
        } catch (err: any) {
          console.log("FETCH TICKET ERROR:", err);
          Alert.alert(
            "Error",
            err?.message || "Failed to validate ticket. Please try again."
          );
          return;
        }
      }

      // ✅ If we reach here, ticket is allowed → go to ConfirmTicket
      router.push({
        pathname: "/views/confirmTicket",
        params: {
          mode: "scan",
          code: encodeURIComponent(raw),
          eventName: eventName || "Event Ticket",
        },
      });
    } finally {
      // Small lock to prevent multiple triggers from the same QR
      setTimeout(() => setScanningLocked(false), 1500);
    }
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
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { backgroundColor: "#F2F3F7" },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#071689" />
        </Pressable>
        <Text style={styles.topTitle}>Scan Tickets / Vouchers</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.headerSeparator} />

      <View style={styles.content}>
        <View style={styles.scannerBox}>
          {isFocused && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
        </View>
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

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    alignItems: "center",
  },

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
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#071689",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  secondaryBtn: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#071689",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: "#071689", fontSize: 16, fontWeight: "700" },
});
