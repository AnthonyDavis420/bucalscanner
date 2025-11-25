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

export default function ViewTicket() {
  const params = useLocalSearchParams<{
    status?: TicketStatus;
    eventName?: string;
    holderName?: string;
    side?: string;
    ticketId?: string;
    code?: string;
    eventId?: string;
    seasonId?: string;
    ticketUrl?: string;
  }>();

  const rawStatusParam = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  const [status, setStatus] = useState<TicketStatus>(
    rawStatusParam ?? "active"
  );

  const rawEventName = Array.isArray(params.eventName)
    ? params.eventName[0]
    : params.eventName;
  const rawHolder = Array.isArray(params.holderName)
    ? params.holderName[0]
    : params.holderName;
  const rawSide = Array.isArray(params.side) ? params.side[0] : params.side;
  const rawTicketId = Array.isArray(params.ticketId)
    ? params.ticketId[0]
    : params.ticketId;
  const rawTicketUrlParam = Array.isArray(params.ticketUrl)
    ? params.ticketUrl[0]
    : params.ticketUrl;

  const rawEventId = Array.isArray(params.eventId)
    ? params.eventId[0]
    : params.eventId;
  const rawSeasonId = Array.isArray(params.seasonId)
    ? params.seasonId[0]
    : params.seasonId;

  const eventId = (rawEventId || "").trim();
  const seasonId = (rawSeasonId || "").trim();
  const ticketIdParam = (rawTicketId || "").trim();

  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(
    !!(eventId && seasonId && ticketIdParam)
  );
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!eventId || !seasonId || !ticketIdParam) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await scannerApi.fetchTickets(eventId, seasonId, [
          ticketIdParam,
        ]);
        const t = (res.items || [])[0] || null;
        if (cancelled) return;

        if (!t) {
          setError("Ticket not found.");
        } else {
          setTicket(t);
          const raw = String((t as any).status || "").toLowerCase();
          const allowed: TicketStatus[] = [
            "active",
            "redeemed",
            "invalid",
            "expired",
            "cancelled",
            "pending",
          ];
          if (allowed.includes(raw as TicketStatus)) {
            setStatus(raw as TicketStatus);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load ticket.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, seasonId, ticketIdParam]);

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

  const fallbackEventName =
    rawEventName || "ADNU vs NCF Game 1 Finals";
  const fallbackHolder = rawHolder || "John Doe";
  const fallbackSide = rawSide || "Section @ Side";
  const fallbackTicketId = ticketIdParam || "8305463";
  const fallbackTicketUrl = rawTicketUrlParam || "";

  const eventName = fallbackEventName;
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

  const header = useMemo(() => {
    switch (status) {
      case "active":
        return { text: "Ticket is Valid", color: "#2E7D32" };
      case "redeemed":
        return { text: "Ticket Redeemed", color: "#071689" };
      case "invalid":
        return { text: "Ticket is Invalid", color: "#E53935" };
      case "expired":
        return { text: "Ticket is Expired", color: "#6B7280" };
      case "cancelled":
        return { text: "Ticket is Cancelled", color: "#6B7280" };
      case "pending":
        return { text: "Ticket is Pending", color: "#F59E0B" };
    }
  }, [status]);

  const handleBack = () => {
    router.back();
  };

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
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header?.color }]}>
          {header?.text}
        </Text>
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
                      if (ticketImageUrl) {
                        scale.value = 1;
                        translateX.value = 0;
                        translateY.value = 0;
                        setZoomOpen(true);
                      }
                    }}
                  >
                    <View style={styles.ticketInnerShadow}>
                      <Image
                        source={{ uri: ticketImageUrl }}
                        style={styles.ticketImage}
                        resizeMode="contain"
                        onError={(e) => {
                          console.log(
                            "VIEW_TICKET IMAGE ERROR:",
                            e.nativeEvent
                          );
                          console.log("IMAGE URI:", ticketImageUrl);
                        }}
                      />
                    </View>
                  </Pressable>
                  <Text style={styles.tapHint}>Tap ticket to zoom</Text>
                </>
              ) : (
                <View style={styles.ticketPlaceholder}>
                  <Text style={styles.placeholderText}>
                    No ticket image available
                  </Text>
                </View>
              )}
            </View>

            {showPriorityBadge && (
              <View style={styles.badgeRow}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>
                    PRIORITY TICKET
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.meta}>
              <MetaRow label="Event" value={eventName} />
              <MetaRow label="Name" value={effectiveHolder} />
              <MetaRow label="Side" value={effectiveSide} />
              <MetaRow label="Ticket ID" value={effectiveTicketId} />
              <MetaRow
                label="Status"
                value={status.charAt(0).toUpperCase() + status.slice(1)}
              />
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
            <Text style={styles.modalTitle}>Ticket Preview</Text>
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
