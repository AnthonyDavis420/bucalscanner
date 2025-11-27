// app/views/viewVoucher.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type VoucherSummary } from "../../lib/api";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type VoucherStatus = "active" | "redeemed" | "expired";

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function formatExpiry(raw: string | null | undefined): string {
  if (!raw) return "Not set";
  const trimmed = String(raw).trim();
  if (!trimmed) return "Not set";

  const tryDate = (v: any): Date | null => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let d: Date | null = null;

  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    d = tryDate(asNum);
  }

  if (!d) {
    d = tryDate(trimmed);
  }

  if (!d) return trimmed;

  const datePart = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutesStr = minutes.toString().padStart(2, "0");

  const timePart = `${hours}:${minutesStr}${ampm}`;

  return `${datePart} · ${timePart}`;
}


export default function ViewVoucher() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
    voucherId?: string | string[];
    voucherName?: string | string[];
    voucherCode?: string | string[];
    assignedName?: string | string[];
    assignedType?: string | string[];
    email?: string | string[];
    maxUses?: string | string[];
    usedCount?: string | string[];
    maxPax?: string | string[];
    remainingPax?: string | string[];
    status?: string | string[];
    ticketUrl?: string | string[];
    code?: string | string[];
    validUntil?: string | string[];
    expiresAt?: string | string[];
  }>();

  const eventId = asString(params.eventId, "").trim();
  const seasonId = asString(params.seasonId, "").trim();
  const voucherIdParam = asString(params.voucherId, "").trim();

  const fallbackNameParam = asString(params.assignedName, "");
  const fallbackTypeParam = asString(params.assignedType, "");
  const fallbackEmailParam = asString(params.email, "");
  const fallbackCodeParam =
    asString(params.voucherCode, "") || asString(params.code, "");
  const fallbackMaxUsesParam =
    asString(params.maxUses, "") || asString(params.maxPax, "");
  const fallbackUsedCountParam = asString(params.usedCount, "");
  const fallbackRemainingPaxParam = asString(params.remainingPax, "");
  const fallbackStatusParam = asString(params.status, "");
  const fallbackTicketUrlParam = asString(params.ticketUrl, "");
  const fallbackExpiresParam =
    asString(params.validUntil, "") || asString(params.expiresAt, "");

  const [voucher, setVoucher] = useState<VoucherSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(
    !!(eventId && seasonId && voucherIdParam)
  );
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!eventId || !seasonId || !voucherIdParam) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await scannerApi.fetchVoucher(
          eventId,
          seasonId,
          voucherIdParam
        );
        if (cancelled) return;
        setVoucher(res.item);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load voucher.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, seasonId, voucherIdParam]);

  const {
    status,
    header,
    displayName,
    displayType,
    displayEmail,
    displayCode,
    maxUses,
    usedCount,
    ticketImageUrl,
    displayExpiresAt,
  } = useMemo(() => {
    const raw: any = voucher || {};

    const rawStatus =
      String(raw.status || raw.state || fallbackStatusParam || "active")
        .trim()
        .toLowerCase();

    let statusValue: VoucherStatus = "active";
    if (rawStatus === "redeemed") statusValue = "redeemed";
    else if (
      rawStatus === "expired" ||
      rawStatus === "cancelled" ||
      rawStatus === "canceled"
    )
      statusValue = "expired";

    const assignedNameFromVoucher =
      raw.assignedName || raw.assigned_to?.name || raw.assignedTo?.name || "";
    const assignedTypeFromVoucher =
      raw.assignedType || raw.assigned_to?.type || raw.assignedTo?.type || "";
    const emailFromVoucher =
      raw.assignedEmail ||
      raw.assigned_email ||
      raw.assigned_to?.email ||
      raw.assignedTo?.email ||
      "";

    const codeFromVoucher = raw.code || raw.voucherCode || raw.id || "";

    let max: number | null = null;
    if (typeof raw.maxUses === "number" && Number.isFinite(raw.maxUses)) {
      max = raw.maxUses;
    } else if (fallbackMaxUsesParam) {
      const n = Number.parseInt(fallbackMaxUsesParam, 10);
      if (Number.isFinite(n) && n >= 0) max = n;
    }

    let used: number | null = null;
    if (typeof raw.usedCount === "number" && Number.isFinite(raw.usedCount)) {
      used = raw.usedCount;
    } else if (fallbackUsedCountParam) {
      const n = Number.parseInt(fallbackUsedCountParam, 10);
      if (Number.isFinite(n) && n >= 0) used = n;
    } else if (max != null && fallbackRemainingPaxParam) {
      const rem = Number.parseInt(fallbackRemainingPaxParam, 10);
      if (Number.isFinite(rem)) used = Math.max(0, max - rem);
    }

    const imageFromVoucher =
      (raw.ticket && raw.ticket.ticketUrl) ||
      raw.ticketUrl ||
      (raw.ticket && raw.ticket.url) ||
      null;

    const rawValidUntil =
      raw.validUntil ||
      raw.valid_until ||
      raw.expiresAt ||
      raw.expires_at ||
      fallbackExpiresParam ||
      "";

    const headerData =
      statusValue === "active"
        ? { text: "Voucher is Active", color: "#2E7D32" }
        : statusValue === "redeemed"
        ? { text: "Voucher Redeemed", color: "#071689" }
        : { text: "Voucher Expired", color: "#6B7280" };

    return {
      status: statusValue,
      header: headerData,
      displayName:
        assignedNameFromVoucher || fallbackNameParam || "Unnamed recipient",
      displayType: assignedTypeFromVoucher || fallbackTypeParam || "",
      displayEmail: emailFromVoucher || fallbackEmailParam || "",
      displayCode:
        codeFromVoucher || fallbackCodeParam || voucherIdParam || "Unknown",
      maxUses: max,
      usedCount: used,
      ticketImageUrl: imageFromVoucher || fallbackTicketUrlParam || null,
      displayExpiresAt: formatExpiry(rawValidUntil || null),
    };
  }, [
    voucher,
    fallbackStatusParam,
    fallbackNameParam,
    fallbackTypeParam,
    fallbackEmailParam,
    fallbackCodeParam,
    fallbackMaxUsesParam,
    fallbackUsedCountParam,
    fallbackRemainingPaxParam,
    fallbackTicketUrlParam,
    fallbackExpiresParam,
    voucherIdParam,
  ]);

  const handleBack = () => {
    router.back();
  };

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      } else if (scale.value > 4) {
        scale.value = withTiming(4);
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const composedGesture = Gesture.Simultaneous(pinch, pan);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header.color }]}>
          {header.text}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading voucher details…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={handleBack}
              style={[styles.cta, styles.ghost, { marginTop: 18 }]}
            >
              <Text style={[styles.ctaText, { color: "#111" }]}>
                Back
              </Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <>
            <View style={styles.ticketBox}>
              {ticketImageUrl ? (
                <>
                  <Pressable
                    style={styles.ticketPressable}
                    onPress={() => {
                      scale.value = 1;
                      translateX.value = 0;
                      translateY.value = 0;
                      setZoomOpen(true);
                    }}
                  >
                    <View style={styles.ticketInnerShadow}>
                      <Image
                        source={{ uri: ticketImageUrl }}
                        style={styles.ticketImage}
                        resizeMode="contain"
                      />
                    </View>
                  </Pressable>
                  <Text style={styles.tapHint}>Tap voucher to zoom</Text>
                </>
              ) : (
                <View style={styles.ticketPlaceholder}>
                  <Text style={styles.placeholderText}>
                    No voucher image available
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.holderBlock}>
              <Text style={styles.holderName}>{displayName}</Text>
              {displayType ? (
                <Text style={styles.holderType}>{displayType}</Text>
              ) : null}
            </View>

            <View style={styles.meta}>
              <MetaRow label="Voucher Code" value={displayCode} />
              <MetaRow
                label="Email"
                value={displayEmail || "Not provided"}
              />
              <MetaRow
                label="Max Uses"
                value={maxUses != null ? String(maxUses) : "Not set"}
              />
              <MetaRow
                label="Used Count"
                value={usedCount != null ? String(usedCount) : "0"}
              />
              <MetaRow label="Expires At" value={displayExpiresAt} />
              <MetaRow label="Status" value={statusLabel} />
            </View>

            <View style={styles.row}>
              <Pressable
                onPress={handleBack}
                style={[styles.cta, styles.ghost, { flex: 1 }]}
              >
                <Text style={[styles.ctaText, { color: "#111" }]}>
                  Back
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
      >
        <GestureHandlerRootView style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setZoomOpen(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.modalTitle}>Voucher Preview</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.modalScroll}>
            <View style={styles.modalContent}>
              {ticketImageUrl && (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View collapsable={false}>
                    <Animated.Image
                      source={{ uri: ticketImageUrl }}
                      style={[styles.modalImage, animatedImageStyle]}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
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
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  muted: { color: "#6B7280", fontSize: 13 },
  errorText: { color: "#E53935", fontWeight: "700", textAlign: "center" },
  ticketBox: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 24,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ticketPressable: {
    width: "100%",
  },
  ticketInnerShadow: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketImage: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 10,
  },
  tapHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingBottom: 8,
  },
  ticketPlaceholder: {
    width: "100%",
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  placeholderText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  holderBlock: {
    alignItems: "center",
    marginBottom: 16,
  },
  holderName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  holderType: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  meta: { gap: 10 },
  metaRow: { flexDirection: "row", gap: 6 },
  metaLabel: { width: 110, color: "#444", fontSize: 14 },
  metaValue: { flex: 1, color: "#111", fontWeight: "600", fontSize: 14 },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  cta: {
    marginTop: 30,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalImage: {
    width: "100%",
    aspectRatio: 3 / 2,
  },
});
