import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi } from "../../lib/api";
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

function asString(v: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(v)) return (v[0] ?? fallback) as string;
  return (v ?? fallback) as string;
}

function formatExpiry(raw: string | null | undefined): string {
  if (!raw) return "No expiry";

  const trimmed = String(raw).trim();
  if (!trimmed) return "No expiry";

  const parseYmd = (s: string): Date | null => {
    const m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/
    );
    if (!m) return null;

    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    const hour = m[4] != null ? Number(m[4]) : 23;
    const minute = m[5] != null ? Number(m[5]) : 59;

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }

    return new Date(year, month, day, hour, minute, 0, 0);
  };

  let d: Date | null = null;

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (trimmed.length <= 10) {
      d = new Date(num * 1000);
    } else {
      d = new Date(num);
    }
  }

  if (!d) d = parseYmd(trimmed);
  if (!d) {
    const tmp = new Date(trimmed);
    if (!Number.isNaN(tmp.getTime())) d = tmp;
  }

  if (!d || Number.isNaN(d.getTime())) return trimmed;

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
  const minStr = minutes.toString().padStart(2, "0");

  return `${datePart} · ${hours}:${minStr}${ampm}`;
}

type RouteParams = {
  eventId?: string | string[];
  seasonId?: string | string[];
  voucherId?: string | string[];
  code?: string | string[];
  status?: string | string[];
  source?: string | string[];
};

type VoucherView = {
  id: string;
  code: string;
  voucherName: string;
  assignedName: string | null;
  assignedType: string | null;
  assignedEmail: string | null;
  maxUses: number;
  usedCount: number;
  ticketUrl: string | null;
  notes: string | null;
  sectionName: string | null;
  teamSide: string | null;
  status: string;
  validUntil: string | null;
};

export default function ConfirmVoucher() {
  const params = useLocalSearchParams<RouteParams>();

  const eventIdParam = asString(params.eventId);
  const seasonIdParam = asString(params.seasonId);
  const voucherIdParam = asString(params.voucherId);
  const statusParam = asString(params.status);
  const sourceParam = asString(params.source);
  const cameFromVouchers = sourceParam === "allVouchers";

  const rawCodeParam = asString(params.code);
  let payloadEventId: string | undefined;
  let payloadSeasonId: string | undefined;
  let payloadVoucherId: string | undefined;

  try {
    if (rawCodeParam) {
      const decoded = decodeURIComponent(rawCodeParam);
      if (decoded.trim().startsWith("{")) {
        const parsed = JSON.parse(decoded);
        payloadEventId = asString(parsed.eventId ?? parsed.event_id, undefined);
        payloadSeasonId = asString(
          parsed.seasonId ?? parsed.season_id,
          undefined
        );
        payloadVoucherId = asString(
          parsed.voucherId ?? parsed.voucher_id ?? parsed.id,
          undefined
        );
      }
    }
  } catch {}

  const eventId = eventIdParam || payloadEventId || "";
  const seasonId = seasonIdParam || payloadSeasonId || "";
  const voucherId = voucherIdParam || payloadVoucherId || "";

  const [voucher, setVoucher] = useState<VoucherView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventExpiry, setEventExpiry] = useState<string | null>(null);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [isRedeemed, setIsRedeemed] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

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

  useEffect(() => {
    if (!eventId || !seasonId || !voucherId) {
      setLoading(false);
      setLoadError("Missing voucher context.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const [voucherResp, eventResp] = await Promise.all([
          scannerApi.fetchVoucher(eventId, seasonId, voucherId),
          scannerApi.eventDetails(eventId, seasonId).catch(() => null),
        ]);

        if (cancelled) return;

        const raw = (voucherResp.item ?? {}) as any;

        const maxUses =
          typeof raw.maxUses === "number" && Number.isFinite(raw.maxUses)
            ? raw.maxUses
            : 1;
        const usedCount =
          typeof raw.usedCount === "number" && Number.isFinite(raw.usedCount)
            ? raw.usedCount
            : 0;

        const view: VoucherView = {
          id: raw.id || voucherId,
          code: raw.code || raw.voucherCode || voucherId,
          voucherName: raw.name || raw.voucherName || "Group Voucher",
          assignedName: raw.assignedName ?? null,
          assignedType: raw.assignedType ?? null,
          assignedEmail: raw.assignedEmail ?? null,
          maxUses,
          usedCount,
          ticketUrl:
            raw.ticketUrl || raw.ticket?.ticketUrl || raw.imageUrl || null,
          notes: raw.notes ?? null,
          sectionName: raw.sectionName ?? null,
          teamSide: raw.teamSide ?? null,
          status: raw.status || statusParam || "active",
          validUntil: raw.validUntil ?? null,
        };

        let fallbackExpiry: string | null = null;
        if (eventResp && (eventResp as any).item) {
          const e: any = (eventResp as any).item;
          const dateStr = e.date ? String(e.date) : "";
          let timeStr = "";
          if (e.timeEnd) timeStr = String(e.timeEnd);
          else if (e.time_end) timeStr = String(e.time_end);
          else if (e.timeRange) timeStr = String(e.timeRange);
          else if (e.time_range) timeStr = String(e.time_range);
          else if (e.time) timeStr = String(e.time);
          if (dateStr && timeStr) fallbackExpiry = `${dateStr} ${timeStr}`;
          else if (timeStr) fallbackExpiry = timeStr;
          else if (dateStr) fallbackExpiry = dateStr;
        }

        setVoucher(view);
        setEventExpiry(fallbackExpiry);
      } catch (err: any) {
        console.log("FETCH VOUCHER ERROR", err);
        setLoadError(err?.message || "Failed to load voucher.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, seasonId, voucherId, statusParam]);

  const remaining = useMemo(() => {
    if (!voucher) return 0;
    if (!voucher.maxUses || voucher.maxUses <= 0) return Infinity;
    return Math.max(0, voucher.maxUses - voucher.usedCount);
  }, [voucher]);

  const remainingLabel = useMemo(() => {
    if (!voucher) return "";
    if (!Number.isFinite(remaining)) return "Unlimited uses";
    return `${remaining} remaining from ${voucher.maxUses} pax`;
  }, [voucher, remaining]);

  const [count, setCount] = useState(1);

  useEffect(() => {
    if (!voucher) return;
    if (!Number.isFinite(remaining)) {
      setCount(1);
      return;
    }
    if (remaining <= 0) setCount(0);
    else if (count < 1) setCount(1);
    else if (count > remaining) setCount(remaining);
  }, [voucher, remaining]);

  const statusDisplay = useMemo(() => {
    if (!voucher) return (statusParam || "active").toLowerCase();
    if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
      return "redeemed";
    }
    return (voucher.status || "active").toLowerCase();
  }, [voucher, statusParam]);

  const statusColor =
    statusDisplay === "active"
      ? "#16A34A"
      : statusDisplay === "redeemed"
      ? "#071689"
      : "#DC2626";

  const handleBack = () => {
    router.back();
  };

  const handleConfirm = async () => {
    if (!voucher) return;
    if (Number.isFinite(remaining) && remaining <= 0) return;
    if (count <= 0 || submitBusy) return;

    try {
      setSubmitBusy(true);
      await scannerApi.useVoucher(eventId, seasonId, voucher.id, count);
      setVoucher((prev) =>
        prev
          ? {
              ...prev,
              usedCount: prev.usedCount + count,
            }
          : prev
      );
      setIsRedeemed(true);
    } catch (err: any) {
      Alert.alert("Error", "Failed to redeem voucher.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleScanNext = () => {
    router.back();
  };

  const rawExpiry = voucher?.validUntil ?? eventExpiry;
  const expiryLabel = formatExpiry(rawExpiry ?? null);
  const sectionSide = [voucher?.sectionName, voucher?.teamSide]
    .filter((x) => x && x.trim())
    .join(" – ");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { backgroundColor: "#F3F4F6" },
          ]}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color="#071689" />
        </Pressable>
        <Text style={styles.topTitle}>Confirm Voucher</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" />
            <Text style={styles.centerText}>Loading voucher…</Text>
          </View>
        )}

        {loadError && !loading && (
          <View style={styles.centerBox}>
            <Text style={[styles.centerText, { color: "#DC2626" }]}>
              {loadError}
            </Text>
          </View>
        )}

        {voucher && !loading && !loadError && (
          <>
            <View style={styles.ticketBox}>
              {voucher.ticketUrl ? (
                <>
                  <Pressable
                    onPress={() => {
                      scale.value = 1;
                      translateX.value = 0;
                      translateY.value = 0;
                      setZoomVisible(true);
                    }}
                    style={styles.ticketPressable}
                  >
                    <Image
                      source={{ uri: voucher.ticketUrl }}
                      style={styles.ticketImage}
                      resizeMode="contain"
                    />
                  </Pressable>
                  <Text style={styles.tapHint}>Tap to zoom voucher</Text>
                </>
              ) : (
                <View style={styles.ticketPlaceholder}>
                  <Text style={styles.placeholderText}>No image available</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.voucherName}>
                {voucher.assignedName || voucher.voucherName || "Guest"}
              </Text>
              <Text style={styles.voucherSub}>
                {voucher.assignedType || "Standard"}
              </Text>

              <View style={styles.metaContainer}>
                <MetaRow label="Code" value={voucher.code} />
                {voucher.assignedEmail && (
                  <MetaRow label="Email" value={voucher.assignedEmail} />
                )}
                <MetaRow
                  label="Status"
                  value={
                    statusDisplay.charAt(0).toUpperCase() +
                    statusDisplay.slice(1)
                  }
                  color={statusColor}
                />
                <MetaRow label="Expires" value={expiryLabel} />
                {sectionSide ? (
                  <MetaRow label="Seat" value={sectionSide} />
                ) : null}
              </View>
            </View>

            {voucher.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{voucher.notes}</Text>
              </View>
            )}

            <View style={styles.divider} />

            {!isRedeemed ? (
              <View style={styles.counterContainer}>
                <Text style={styles.label}>Select Pax Entry</Text>
                <View style={styles.counterRow}>
                  <Pressable
                    onPress={() => count > 1 && setCount(count - 1)}
                    disabled={count <= 1}
                    style={[
                      styles.counterBtn,
                      count <= 1 && styles.disabledBtn,
                    ]}
                  >
                    <Ionicons name="remove" size={26} color="#fff" />
                  </Pressable>
                  <View style={styles.countDisplay}>
                    <Text style={styles.countText}>{count}</Text>
                    <Text style={styles.countLabel}>Pax</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Number.isFinite(remaining) &&
                      count < (remaining as number) &&
                      setCount(count + 1)
                    }
                    disabled={
                      !Number.isFinite(remaining) ||
                      count >= (remaining as number)
                    }
                    style={[
                      styles.counterBtn,
                      (!Number.isFinite(remaining) ||
                        count >= (remaining as number)) &&
                        styles.disabledBtn,
                    ]}
                  >
                    <Ionicons name="add" size={26} color="#fff" />
                  </Pressable>
                </View>
                <Text style={styles.limitText}>{remainingLabel}</Text>
              </View>
            ) : (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={52} color="#071689" />
                <Text style={styles.successTitle}>{count} Pax Admitted</Text>
                <Text style={styles.successSub}>
                  {Number.isFinite(remaining)
                    ? `Remaining uses: ${remaining as number}`
                    : "Voucher has unlimited uses."}
                </Text>
              </View>
            )}

            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {voucher && !loading && !loadError && (
        <View style={styles.footer}>
          {!isRedeemed ? (
            <Pressable
              onPress={handleConfirm}
              disabled={
                submitBusy ||
                count <= 0 ||
                (Number.isFinite(remaining) && (remaining as number) <= 0)
              }
              style={[
                styles.cta,
                (submitBusy ||
                  count <= 0 ||
                  (Number.isFinite(remaining) &&
                    (remaining as number) <= 0)) && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.ctaText}>
                {submitBusy ? "Processing..." : `Confirm & Admit (${count})`}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleScanNext} style={styles.cta}>
              <Text style={styles.ctaText}>
                {cameFromVouchers ? "Back to list" : "Scan next"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomVisible(false)}
      >
        <GestureHandlerRootView style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setZoomVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.modalTitle}>Voucher Preview</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.modalContent}>
            {voucher?.ticketUrl && (
              <GestureDetector gesture={composedGesture}>
                <Animated.View>
                  <Animated.Image
                    source={{ uri: voucher.ticketUrl }}
                    style={[styles.modalImage, animatedImageStyle]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

function MetaRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={[styles.metaValue, color ? { color } : null]}>{value}</Text>
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
    borderBottomColor: "#E5E7EB",
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#071689",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centerBox: { alignItems: "center", marginTop: 40 },
  centerText: { marginTop: 8, color: "#6B7280", fontSize: 14 },
  ticketBox: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
    overflow: "hidden",
  },
  ticketPressable: { padding: 8 },
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
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: "#9CA3AF", fontSize: 13 },
  card: {
    paddingVertical: 4,
    marginBottom: 16,
  },
  voucherName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  voucherSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  metaContainer: {
    marginTop: 12,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metaLabel: {
    width: 110,
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  notesBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  notesText: { fontSize: 13, color: "#4B5563" },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 20,
  },
  counterContainer: { alignItems: "center" },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 14, color: "#374151" },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginBottom: 8,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#071689",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: { backgroundColor: "#D1D5DB" },
  countDisplay: { alignItems: "center", width: 80 },
  countText: { fontSize: 40, fontWeight: "800", color: "#111827" },
  countLabel: { fontSize: 12, color: "#6B7280" },
  limitText: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  successBox: { alignItems: "center", marginTop: 10 },
  successTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  successSub: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  cta: {
    height: 50,
    borderRadius: 10,
    backgroundColor: "#071689",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 8,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalContent: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalImage: {
    width: "100%",
    aspectRatio: 3 / 2,
  },
});
