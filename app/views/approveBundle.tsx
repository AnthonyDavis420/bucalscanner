// app/views/approveBundle.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView, // 👈 added
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { scannerApi, type TicketSummary } from "../../lib/api";

type UITicket = {
  id: string;
  url: string;
  seatLabel: string;
  seatDetail: string;
  price: number | null;
  status?: string;
  type?: "adult" | "child" | "priority";
};

function typeRank(t?: "adult" | "child" | "priority") {
  if (t === "adult") return 0;
  if (t === "priority") return 1;
  if (t === "child") return 2;
  return 3;
}

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function mapSummaryToUi(src: TicketSummary): UITicket {
  const imageUrl =
    ((src as any)?.ticketUrl ||
      (src as any)?.url ||
      (src as any)?.ticket?.ticketUrl ||
      "") as string;

  return {
    id: src.id,
    url: imageUrl,
    seatLabel: src.assignedName || "Guest",
    seatDetail: `${src.sectionName || "Section"} · ${
      src.sideLabel || "Side"
    }`,
    price: src.price ?? null,
    status: src.status ?? undefined,
    type: src.type,
  };
}

export default function ApproveBundle() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
    bundleId?: string | string[];
    count?: string | string[];
    amountPaid?: string | string[];
    items?: string | string[];
    initialIndex?: string | string[];
  }>();

  const eventId = asString(params.eventId, "");
  const seasonId = asString(params.seasonId, "");
  const eventName = asString(params.eventName, "");
  const bundleId = asString(params.bundleId, "");
  const countParam = asString(params.count, "");
  const amountPaid = asString(params.amountPaid, "");

  const rawItems = asString(params.items, "");
  const rawInitialIndex = asString(params.initialIndex, "");

  let parsedItems: UITicket[] = [];
  try {
    if (rawItems) {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) parsedItems = parsed as UITicket[];
    }
  } catch {
    parsedItems = [];
  }

  if (parsedItems.length) {
    parsedItems.sort((a, b) => typeRank(a.type) - typeRank(b.type));
  }

  const [tickets, setTickets] = useState<UITicket[]>(parsedItems);
  const [loading, setLoading] = useState(!parsedItems.length);
  const [error, setError] = useState<string | null>(null);

  const baseInitialIndex = (() => {
    const n = rawInitialIndex ? parseInt(rawInitialIndex, 10) : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  })();

  const [currentIndex, setCurrentIndex] = useState<number>(baseInitialIndex);
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

  // If no items were passed, refetch tickets for this bundle
  useEffect(() => {
    if (tickets.length || !eventId || !seasonId || !bundleId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await scannerApi.fetchTickets(eventId, seasonId, []);
        const items = Array.isArray(res.items) ? res.items : [];

        const bundleItems = items.filter((src: TicketSummary) => {
          const srcBundle = (src as any).bundleId;
          return srcBundle && String(srcBundle) === bundleId;
        });

        if (!bundleItems.length) {
          throw new Error("No tickets found for this bundle.");
        }

        const mapped = bundleItems.map(mapSummaryToUi);

        mapped.sort((a, b) => typeRank(a.type) - typeRank(b.type));

        if (!cancelled) {
          setTickets(mapped);
          setCurrentIndex(0);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load tickets");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tickets.length, eventId, seasonId, bundleId]);

  // Clamp current index when ticket count changes
  useEffect(() => {
    if (!tickets.length) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= tickets.length) return tickets.length - 1;
      return prev;
    });
  }, [tickets.length]);

  const bundleCount =
    tickets.length || (countParam ? parseInt(countParam, 10) || 0 : 0);

  const previewUrl =
    tickets.length > 0 ? tickets[currentIndex]?.url || "" : "";
  const hasMultiple = tickets.length > 1;

  const handlePrevTicket = () => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => {
      if (prev <= 0) return tickets.length - 1;
      return prev - 1;
    });
  };

  const handleNextTicket = () => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => {
      if (prev >= tickets.length - 1) return 0;
      return prev + 1;
    });
  };

  const goBackToTickets = () => router.back();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Payment Confirmed</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        {/* Scrollable content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!!eventName && (
            <Text style={styles.eventName} numberOfLines={2}>
              {eventName}
            </Text>
          )}

          {loading && (
            <View style={styles.centerBox}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading tickets…</Text>
            </View>
          )}

          {!loading && error && !tickets.length && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !!tickets.length && (
            <>
              {/* PREVIEW BOX */}
              <View style={styles.ticketBox}>
                {previewUrl ? (
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
                          source={{ uri: previewUrl }}
                          style={styles.ticketImage}
                          resizeMode="contain"
                        />
                      </View>
                    </Pressable>
                    <Text style={styles.tapHint}>Tap ticket to zoom</Text>

                    {hasMultiple && (
                      <View style={styles.paginationRow}>
                        <Pressable
                          onPress={handlePrevTicket}
                          style={({ pressed }) => [
                            styles.pageBtn,
                            pressed && { opacity: 0.7 },
                          ]}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={18}
                            color="#374151"
                          />
                        </Pressable>
                        <Text style={styles.pageLabel}>
                          Ticket {currentIndex + 1} of {tickets.length}
                        </Text>
                        <Pressable
                          onPress={handleNextTicket}
                          style={({ pressed }) => [
                            styles.pageBtn,
                            pressed && { opacity: 0.7 },
                          ]}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color="#374151"
                          />
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.ticketPlaceholder}>
                    <Text style={styles.placeholderText}>
                      Ticket image not available
                    </Text>
                  </View>
                )}
              </View>

              {/* CARD */}
              <View style={styles.card}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color="#071689"
                  />
                </View>
                <Text style={styles.mainText}>Successfully Purchased</Text>
                <Text style={styles.subtitle}>
                  {bundleCount > 0
                    ? `${bundleCount} reserved ticket${
                        bundleCount > 1 ? "s" : ""
                      } in this bundle have been marked as `
                    : "The reserved bundle has been marked as "}
                  <Text style={{ fontWeight: "700" }}>active</Text>. They can
                  now be used for entry.
                </Text>

                <View style={styles.detailsBox}>
                  {!!bundleId && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bundle ID</Text>
                      <Text style={styles.detailValue}>{bundleId}</Text>
                    </View>
                  )}
                  {bundleCount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tickets</Text>
                      <Text style={styles.detailValue}>{bundleCount}</Text>
                    </View>
                  )}
                  {!!amountPaid && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount</Text>
                      <Text style={styles.detailValue}>{amountPaid}</Text>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Sticky bottom button */}
        <View style={styles.singleRow}>
          <Pressable
            onPress={goBackToTickets}
            style={[styles.cta, { backgroundColor: "#071689" }]}
          >
            <Text style={styles.ctaText}>Back to Tickets</Text>
          </Pressable>
        </View>
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
              {previewUrl && (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View collapsable={false}>
                    <Animated.Image
                      source={{ uri: previewUrl }}
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
  safe: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEC",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#071689",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    justifyContent: "space-between",
  },

  // new: scroll wrapper
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32, // extra space so card isn't hidden behind button
  },

  eventName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },

  centerBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: "#6B7280" },
  errorText: { color: "#E53935", fontWeight: "700", textAlign: "center" },

  // preview
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

  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 16,
  },
  pageBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  pageLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },

  card: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: "#F3F4FF",
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  mainText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#071689",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },

  detailsBox: {
    width: "100%",
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
    marginLeft: 10,
  },

  singleRow: {
    marginBottom: 24,
  },
  cta: {
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // modal
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
