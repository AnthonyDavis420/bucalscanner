import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type TicketSummary } from "../../lib/api";
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

type TicketStatus =
  | "active"
  | "redeemed"
  | "invalid"
  | "expired"
  | "cancelled"
  | "pending";

export default function ConfirmTicket() {
  const params = useLocalSearchParams<{
    mode?: "create" | "scan";
    status?: TicketStatus;
    eventName?: string;
    holderName?: string;
    side?: string;
    ticketId?: string;
    ticketUrl?: string;
    code?: string;
  }>();

  const mode =
    (Array.isArray(params.mode) ? params.mode[0] : params.mode) || "scan";
  const isScanMode = mode === "scan";
  const isCreateMode = mode === "create";

  const [status, setStatus] = useState<TicketStatus>(
    (Array.isArray(params.status) ? params.status[0] : params.status) ?? "active"
  );
  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(isScanMode);
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  const [ctx, setCtx] = useState<{
    seasonId: string;
    eventId: string;
    ticketId: string;
  } | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

  const fallbackEventName =
    (Array.isArray(params.eventName) ? params.eventName[0] : params.eventName) ||
    "Event Ticket";
  const fallbackHolder =
    (Array.isArray(params.holderName) ? params.holderName[0] : params.holderName) ||
    "John Doe";
  const fallbackSide =
    (Array.isArray(params.side) ? params.side[0] : params.side) ||
    "Section @ Side";
  const fallbackTicketId =
    (Array.isArray(params.ticketId) ? params.ticketId[0] : params.ticketId) ||
    "TICKET-ID";
  const fallbackTicketUrl =
    (Array.isArray(params.ticketUrl) ? params.ticketUrl[0] : params.ticketUrl) ||
    "";

  const eventName = fallbackEventName;

  useEffect(() => {
    if (!isScanMode) {
      setLoading(false);
      return;
    }

    const rawParam = Array.isArray(params.code) ? params.code[0] : params.code;
    if (!rawParam) {
      setError("Missing QR code data.");
      setLoading(false);
      return;
    }

    let payload: any = null;
    try {
      const decodedStr = decodeURIComponent(String(rawParam));
      payload = JSON.parse(decodedStr);
    } catch {
      setError("Invalid ticket QR code.");
      setLoading(false);
      return;
    }

    const seasonId = String(payload?.seasonId || "").trim();
    const eventId = String(payload?.eventId || "").trim();
    const ticketId = String(
      payload?.ticketId ||
        (Array.isArray(params.ticketId) ? params.ticketId[0] : params.ticketId) ||
        ""
    ).trim();

    if (!seasonId || !eventId || !ticketId) {
      setError("Incomplete ticket information.");
      setLoading(false);
      return;
    }

    setCtx({ seasonId, eventId, ticketId });

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await scannerApi.fetchTickets(eventId, seasonId, [ticketId]);
        console.log("CONFIRM_TICKET_RES:", JSON.stringify(res, null, 2));
        const t = (res.items || [])[0] || null;
        if (!t) {
          setError("Ticket not found.");
        } else {
          setTicket(t);
          const rawStatus = String((t as any).status || "").toLowerCase();
          const allowed: TicketStatus[] = [
            "active",
            "redeemed",
            "invalid",
            "expired",
            "cancelled",
            "pending",
          ];
          if (allowed.includes(rawStatus as TicketStatus)) {
            setStatus(rawStatus as TicketStatus);
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load ticket.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isScanMode, params.code, params.ticketId]);

  const holderFromTicket = ticket?.assignedName;
  const sideFromTicket =
    ticket && (ticket.sectionName || ticket.sideLabel)
      ? `${ticket.sectionName || "Section"} @ ${ticket.sideLabel || "Side"}`
      : undefined;
  const idFromTicket = ticket?.id;

  const rawTypeFromTicket = ticket?.type as string | undefined;
  const normalizedType =
    rawTypeFromTicket?.toString().toLowerCase() as
      | "adult"
      | "child"
      | "priority"
      | undefined;

  const imageFromTicket =
    ((ticket as any)?.ticketUrl ||
      (ticket as any)?.url ||
      (ticket as any)?.ticket?.ticketUrl ||
      null) as string | null;

  const effectiveHolder = holderFromTicket || fallbackHolder;
  const effectiveSide = sideFromTicket || fallbackSide;
  const effectiveTicketId = idFromTicket || fallbackTicketId;
  const effectiveType: "adult" | "child" | "priority" =
    normalizedType === "child"
      ? "child"
      : normalizedType === "priority"
      ? "priority"
      : "adult";

  const ticketImageUrl = imageFromTicket || fallbackTicketUrl || null;
  console.log("ticketImageUrl =", ticketImageUrl);

  const header = useMemo(() => {
    if (isCreateMode) {
      return { text: "Ticket is Created!", color: "#071689" };
    }
    switch (status) {
      case "active":
        return { text: "Ticket is Valid!", color: "#2E7D32" };
      case "redeemed":
        return { text: "Ticket Redeemed!", color: "#071689" };
      case "invalid":
        return { text: "Ticket is Invalid!", color: "#E53935" };
      case "expired":
        return { text: "Ticket is Expired!", color: "#6B7280" };
      case "cancelled":
        return { text: "Ticket is Cancelled!", color: "#6B7280" };
      case "pending":
        return { text: "Ticket is Pending", color: "#F59E0B" };
    }
  }, [status, isCreateMode]);

  const handleUpdateStatus = async (nextStatus: "redeemed" | "invalid") => {
    if (actionBusy) return;

    if (!ticket || !ctx) {
      setStatus(nextStatus);
      return;
    }

    try {
      setActionBusy(true);
      await scannerApi.updateTicketStatus(
        ctx.eventId,
        ctx.seasonId,
        ticket.id,
        nextStatus
      );
      setStatus(nextStatus);
      setTicket((prev) =>
        prev ? ({ ...prev, status: nextStatus } as TicketSummary) : prev
      );
    } catch (e: any) {
      Alert.alert(
        "Update failed",
        e?.message || "Could not update ticket status. Please try again."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleUndoToActive = async () => {
    if (actionBusy) return;

    if (!ticket || !ctx) {
      setStatus("active");
      return;
    }

    try {
      setActionBusy(true);
      await scannerApi.updateTicketStatus(
        ctx.eventId,
        ctx.seasonId,
        ticket.id,
        "active"
      );
      setStatus("active");
      setTicket((prev) =>
        prev ? ({ ...prev, status: "active" } as TicketSummary) : prev
      );
    } catch (e: any) {
      Alert.alert(
        "Undo failed",
        e?.message || "Could not revert ticket status. Please try again."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRedeem = () => void handleUpdateStatus("redeemed");
  const handleInvalidate = () => void handleUpdateStatus("invalid");

  const handleBack = async () => {
    if (isCreateMode) {
      router.replace("/views/welcome");
      return;
    }

    if (status === "redeemed" || status === "invalid") {
      await handleUndoToActive();
      return;
    }

    router.back();
  };

  const handleScanAgain = () => {
    if (actionBusy) return;
    router.back();
  };

  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");

  const showPriorityBadge = effectiveType === "priority";

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={{ width: 22 }} />
        <Text style={[styles.title, { color: header?.color }]}>{header?.text}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading ticket details…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={handleScanAgain}
              style={[styles.cta, { backgroundColor: "#071689", marginTop: 18 }]}
            >
              <Text style={styles.ctaText}>Scan Again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <>
            <Pressable
              style={styles.ticketWrap}
              onPress={() => {
                if (ticketImageUrl) {
                  scale.value = 1;
                  translateX.value = 0;
                  translateY.value = 0;
                  setZoomOpen(true);
                }
              }}
            >
              {ticketImageUrl ? (
                <Image
                  source={{ uri: ticketImageUrl }}
                  style={styles.ticketImage}
                  resizeMode="contain"
                  onError={(e) => {
                    console.log("IMAGE LOAD ERROR:", e.nativeEvent);
                    console.log("IMAGE URI THAT FAILED:", ticketImageUrl);
                  }}
                />
              ) : (
                <View style={styles.ticketFallback}>
                  <Text style={styles.muted}>No ticket image available</Text>
                </View>
              )}
            </Pressable>

            {showPriorityBadge && (
              <View style={styles.badgeRow}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>PRIORITY TICKET</Text>
                </View>
              </View>
            )}

            <View style={styles.meta}>
              <MetaRow label="Event" value={eventName} />
              <MetaRow label="Name" value={effectiveHolder} />
              <MetaRow label="Side" value={effectiveSide} />
              <MetaRow label="Ticket ID" value={effectiveTicketId} />
            </View>

            {isCreateMode && (
              <View style={styles.row}>
                <Pressable onPress={goHome} style={[styles.cta, styles.ghost]}>
                  <Text style={[styles.ctaText, { color: "#111" }]}>
                    Back to Home
                  </Text>
                </Pressable>
                <Pressable
                  onPress={createNextTicket}
                  style={[styles.cta, { backgroundColor: "#071689" }]}
                >
                  <Text style={styles.ctaText}>Create Next Ticket</Text>
                </Pressable>
              </View>
            )}

            {!isCreateMode && status === "active" && (
              <View style={styles.row}>
                <Pressable
                  onPress={handleInvalidate}
                  disabled={actionBusy}
                  style={[
                    styles.cta,
                    {
                      backgroundColor: "#E53935",
                      opacity: actionBusy ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={styles.ctaText}>Invalid</Text>
                </Pressable>
                <Pressable
                  onPress={handleRedeem}
                  disabled={actionBusy}
                  style={[
                    styles.cta,
                    {
                      backgroundColor: "#071689",
                      opacity: actionBusy ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={styles.ctaText}>Redeem</Text>
                </Pressable>
              </View>
            )}

            {!isCreateMode &&
              (status === "expired" ||
                status === "cancelled" ||
                status === "pending") && (
                <View style={styles.row}>
                  <Pressable
                    onPress={handleBack}
                    style={[styles.cta, styles.ghost, { flex: 1 }]}
                  >
                    <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
                  </Pressable>
                </View>
              )}

            {!isCreateMode &&
              (status === "redeemed" || status === "invalid") && (
                <View style={styles.row}>
                  <Pressable onPress={handleBack} style={[styles.cta, styles.ghost]}>
                    <Text style={[styles.ctaText, { color: "#111" }]}>
                      Revert Changes
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleScanAgain}
                    style={[styles.cta, { backgroundColor: "#071689" }]}
                  >
                    <Text style={styles.ctaText}>Scan Again</Text>
                  </Pressable>
                </View>
              )}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ticket Preview</Text>
              <Pressable
                onPress={() => setZoomOpen(false)}
                hitSlop={10}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#111" />
              </Pressable>
            </View>
            <View style={styles.zoomWrap}>
              {ticketImageUrl ? (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View collapsable={false}>
                    <Animated.Image
                      source={{ uri: ticketImageUrl }}
                      style={[styles.zoomImage, animatedImageStyle]}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
              ) : (
                <View style={styles.ticketFallback}>
                  <Text>No ticket image available</Text>
                </View>
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
  ticketWrap: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 10,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
  ticketImage: {
    width: "100%",
    height: 220,
  },
  ticketFallback: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    alignItems: "center",
    marginBottom: 10,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#16A34A",
  },
  priorityBadgeText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  meta: { gap: 10 },
  metaRow: { flexDirection: "row", gap: 6 },
  metaLabel: { width: 92, color: "#444", fontSize: 14 },
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
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSheet: {
    width: "92%",
    height: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  closeBtn: { padding: 6, borderRadius: 8 },
  zoomWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  zoomImage: { width: "100%", aspectRatio: 3 / 2 },
});
