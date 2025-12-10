import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
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

type UITicket = {
  id: string;
  url: string;
  seatLabel: string;
  seatDetail: string;
  price: number | null;
};

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function mapSummaryToUi(s: TicketSummary): UITicket {
  const imageUrl =
    ((s as any)?.ticket?.ticketUrl ||
      (s as any)?.ticketUrl ||
      (s as any)?.url ||
      "") as string;

  return {
    id: s.id,
    url: imageUrl,
    seatLabel: s.assignedName || "Guest",
    seatDetail: `${s.sectionName || "Section"} · ${s.sideLabel || "Side"}`,
    price: s.price ?? null,
  };
}

export default function ConfirmReserved() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
    ticketId?: string | string[];
    ticketUrl?: string | string[];
    guestName?: string | string[];
    section?: string | string[];
    side?: string | string[];
    totalAmount?: string | string[];
    refNumber?: string | string[];
    source?: string | string[];
  }>();

  const eventId = asString(params.eventId, "");
  const seasonId = asString(params.seasonId, "");
  const eventName = asString(params.eventName, "");
  const ticketId = asString(params.ticketId, "");
  const ticketUrlParam = asString(params.ticketUrl, "");
  const guestNameParam = asString(params.guestName, "");
  const sectionParam = asString(params.section, "");
  const sideParam = asString(params.side, "");
  const totalAmountParam = asString(params.totalAmount, "");
  const refNumberParam = asString(params.refNumber, "");
  const source = asString(params.source, "tickets");

  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<UITicket | null>(null);

  const hasLoaded = useRef(false);

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

  const resetZoom = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  };

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    let cancelled = false;

    const loadTicket = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!eventId || !seasonId || !ticketId) {
          const fallback: UITicket = {
            id: ticketId || refNumberParam || "unknown",
            url: ticketUrlParam || "",
            seatLabel: guestNameParam || "Guest",
            seatDetail: `${sectionParam || "Section"} · ${
              sideParam || "Side"
            }`,
            price: totalAmountParam ? Number(totalAmountParam) || null : null,
          };
          if (!cancelled) {
            setTicket(fallback);
          }
          return;
        }

        const res = await scannerApi.fetchTickets(eventId, seasonId, [ticketId]);
        const first = Array.isArray(res.items) ? res.items[0] : undefined;

        if (cancelled) return;

        if (first) {
          setTicket(mapSummaryToUi(first));
        } else {
          setTicket({
            id: ticketId,
            url: ticketUrlParam || "",
            seatLabel: guestNameParam || "Guest",
            seatDetail: `${sectionParam || "Section"} · ${
              sideParam || "Side"
            }`,
            price: totalAmountParam ? Number(totalAmountParam) || null : null,
          });
        }
      } catch (e: any) {
        if (cancelled) return;

        setTicket({
          id: ticketId || refNumberParam || "unknown",
          url: ticketUrlParam || "",
          seatLabel: guestNameParam || "Guest",
          seatDetail: `${sectionParam || "Section"} · ${
            sideParam || "Side"
          }`,
          price: totalAmountParam ? Number(totalAmountParam) || null : null,
        });
        setError(e?.message || "Failed to load ticket");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTicket();

    return () => {
      cancelled = true;
    };
  }, [
    eventId,
    seasonId,
    ticketId,
    ticketUrlParam,
    guestNameParam,
    sectionParam,
    sideParam,
    totalAmountParam,
    refNumberParam,
  ]);

  const handleTopBack = () => {
    router.back();
  };

  const handleConfirmPayment = async () => {
    if (!ticket || !eventId || !seasonId || !ticketId) return;
    if (finalizing) return;
    try {
      setFinalizing(true);
      setError(null);

      await scannerApi.updateTicketStatus(eventId, seasonId, ticketId, "active");

      router.replace({
        pathname: "/views/approveReserved",
        params: {
          eventId,
          seasonId,
          eventName,
          ticketId: ticket.id,
          ticketUrl: ticket.url || "",
          holderName: ticket.seatLabel,
          section: sectionParam || "",
          side: sideParam || "",
          amountPaid:
            totalAmountParam ||
            (ticket.price != null ? String(ticket.price) : ""),
          refNumber: refNumberParam || ticket.id,
          source,
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to confirm payment");
      setFinalizing(false);
    }
  };

  let amountValue: number | null = null;
  if (totalAmountParam) {
    const n = Number(totalAmountParam);
    if (!Number.isNaN(n)) amountValue = n;
  } else if (ticket?.price != null) {
    amountValue = ticket.price;
  }
  const amountLabel =
    amountValue != null ? `₱${amountValue.toFixed(2)}` : "";

  const confirmDisabled = loading || !ticket || finalizing;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleTopBack}
            hitSlop={10}
            style={{ paddingRight: 6 }}
          >
            <Ionicons name="arrow-back" size={22} color="#071689" />
          </Pressable>
          <Text style={styles.headerTitle}>Confirm Reserved Ticket</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* MAIN SCROLL */}
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
        >
          {!!eventName && (
            <Text style={styles.eventName} numberOfLines={2}>
              {eventName}
            </Text>
          )}

          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading ticket…</Text>
            </View>
          )}

          {!loading && error && !ticket && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && ticket && (
            <>
              {/* PREVIEW BOX (tap to zoom) */}
              <View style={styles.ticketBox}>
                {ticket.url ? (
                  <>
                    <Pressable
                      onPress={() => {
                        resetZoom();
                        setZoomVisible(true);
                      }}
                      style={styles.ticketPressable}
                    >
                      <View style={styles.ticketInnerShadow}>
                        <Image
                          source={{ uri: ticket.url }}
                          style={styles.ticketImage}
                          resizeMode="contain"
                        />
                      </View>
                    </Pressable>
                    <Text style={styles.tapHint}>Tap ticket to zoom</Text>
                  </>
                ) : (
                  <View style={styles.ticketPlaceholder}>
                    <Text style={styles.placeholderText}>
                      Ticket image not available
                    </Text>
                  </View>
                )}
              </View>

              {/* RESERVATION SUMMARY */}
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Reservation Details</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{ticket.seatLabel}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Seat</Text>
                  <Text style={styles.infoValue}>{ticket.seatDetail}</Text>
                </View>

                {!!refNumberParam && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reference</Text>
                    <Text style={styles.infoValue}>{refNumberParam}</Text>
                  </View>
                )}

                {!!amountLabel && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Amount</Text>
                    <Text style={styles.infoValue}>{amountLabel}</Text>
                  </View>
                )}

                <Text style={styles.infoHint}>
                  Confirm payment to activate this reserved ticket.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleConfirmPayment}
          disabled={confirmDisabled}
          style={[
            styles.confirmBtn,
            confirmDisabled && { backgroundColor: "#9CA3AF" },
          ]}
        >
          <Text style={styles.confirmText}>
            {finalizing ? "Finalizing…" : "Confirm Payment"}
          </Text>
        </Pressable>
      </View>

      {/* ZOOM MODAL */}
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
            <Text style={styles.modalTitle}>Ticket Preview</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.modalScroll}>
            <View style={styles.modalContent}>
              {ticket?.url && (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View collapsable={false}>
                    <Animated.Image
                      source={{ uri: ticket.url }}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, paddingTop: 12 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: "#071689",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },

  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  eventName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },

  centerBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: "#6B7280" },
  errorText: { color: "#E53935", fontWeight: "700", textAlign: "center" },
  ticketBox: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 16,
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

  infoCard: {
    borderRadius: 16,
    backgroundColor: "#F3F4FF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    marginLeft: 12,
  },
  infoHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#4B5563",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 6,
    elevation: 10,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071689",
  },
  confirmText: {
    color: "#FFFFFF",
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
