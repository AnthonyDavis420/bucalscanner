// app/views/confirmBundle.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type TicketStatus = "active" | "pending" | "redeemed" | "invalid" | "expired";

type TicketType = "adult" | "child" | "priority";

type UITicket = {
  id: string;
  url: string;
  seatLabel: string;
  seatDetail: string;
  price: number | null;
  status: TicketStatus;
  type?: TicketType;
};

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

// ---- type ordering: adult → priority → child → others ----
function typeRank(type?: TicketType | null): number {
  if (type === "adult") return 0;
  if (type === "priority") return 1;
  if (type === "child") return 2;
  return 3;
}

function sortTicketsByType(list: UITicket[]): UITicket[] {
  return [...list].sort((a, b) => {
    const ra = typeRank(a.type ?? null);
    const rb = typeRank(b.type ?? null);
    if (ra !== rb) return ra - rb;
    // tie-breaker: seat label
    return (a.seatLabel || "").localeCompare(b.seatLabel || "");
  });
}

function mapSummaryToUi(src: TicketSummary): UITicket {
  const rawStatus = String(src.status || "active").toLowerCase();
  let status: TicketStatus;
  switch (rawStatus) {
    case "pending":
      status = "pending";
      break;
    case "redeemed":
      status = "redeemed";
      break;
    case "invalid":
      status = "invalid";
      break;
    case "expired":
    case "cancelled":
      status = "expired";
      break;
    default:
      status = "active";
  }

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
    status,
    type: src.type as TicketType | undefined,
  };
}

export default function ConfirmBundle() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
    bundleId?: string | string[];
    parentTicketId?: string | string[]; // 👈 NEW
  }>();

  const eventId = asString(params.eventId, "");
  const seasonId = asString(params.seasonId, "");
  const eventName = asString(params.eventName, "");
  const bundleId = asString(params.bundleId, "");
  const parentTicketId = asString(params.parentTicketId, ""); // 👈 NEW

  const [tickets, setTickets] = useState<UITicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zoomVisible, setZoomVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const loadTickets = useCallback(async () => {
    try {
      if (!eventId || !seasonId || !bundleId) {
        throw new Error("Missing event/bundle context");
      }
      setLoading(true);
      setError(null);

      // Fetch all tickets for this event, then filter by bundleId on client
      const res = await scannerApi.fetchTickets(eventId, seasonId, []);
      const items = Array.isArray(res.items) ? res.items : [];

      let bundleItems = items.filter((src: TicketSummary) => {
        const srcBundle = (src as any).bundleId;
        return srcBundle && String(srcBundle) === bundleId;
      });

      if (!bundleItems.length) {
        throw new Error("No tickets found for this bundle.");
      }

      // 👇 If a specific parentTicketId is provided,
      //    only keep that parent + its child tickets.
      if (parentTicketId) {
        const parent = bundleItems.find((t) => t.id === parentTicketId);

        if (parent) {
          const parentId = parent.id;
          const children = bundleItems.filter((t) => {
            const tAny = t as any;
            const type = (tAny.type as TicketType | undefined) ?? undefined;
            const childParentId = (tAny.parentTicketId ?? "") as string;

            return (
              type === "child" &&
              childParentId &&
              String(childParentId) === String(parentId)
            );
          });

          bundleItems = [parent, ...children];
        }
        // if parentTicketId is invalid, we silently fall back to full bundle
      }

      const mapped = bundleItems.map(mapSummaryToUi);
      const sorted = sortTicketsByType(mapped); // adult → priority → child
      setTickets(sorted);
      setCurrentIndex(0);
    } catch (e: any) {
      setTickets([]);
      setError(e?.message || "Failed to load bundle tickets");
    } finally {
      setLoading(false);
    }
  }, [eventId, seasonId, bundleId, parentTicketId]); // 👈 include parentTicketId

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Clamp currentIndex whenever ticket count changes
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

  const pendingTickets = useMemo(
    () => tickets.filter((t) => t.status === "pending"),
    [tickets]
  );

  const totalAmount = useMemo(
    () =>
      pendingTickets.reduce(
        (sum, t) => sum + (t.price ?? 0),
        0
      ),
    [pendingTickets]
  );

  const previewUrl =
    tickets.length > 0 ? tickets[currentIndex]?.url || "" : "";
  const hasMultiple = tickets.length > 1;

  const handleTopBack = () => {
    router.back();
  };

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

  const handleConfirmPayment = async () => {
    if (!eventId || !seasonId || !bundleId) return;
    if (!pendingTickets.length) return;
    if (finalizing) return;

    try {
      setFinalizing(true);
      setError(null);

      // Mark all pending tickets (only the ones currently loaded) as active
      await Promise.all(
        pendingTickets.map((t) =>
          scannerApi.updateTicketStatus(
            eventId,
            seasonId,
            t.id,
            "active"
          )
        )
      );

      // Prepare items payload for ApproveBundle (so it can show previews immediately)
      const itemsForParam = tickets.map((t) => ({
        id: t.id,
        url: t.url,
        seatLabel: t.seatLabel,
        seatDetail: t.seatDetail,
        price: t.price,
        status: t.status,
        type: t.type,
      }));

      router.replace({
        pathname: "/views/approveBundle",
        params: {
          eventId,
          seasonId,
          eventName,
          bundleId,
          count: String(tickets.length),
          amountPaid:
            totalAmount > 0 ? `₱${totalAmount.toFixed(2)}` : "",
          items: JSON.stringify(itemsForParam),
          initialIndex: String(currentIndex),
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to confirm payment");
      setFinalizing(false);
    }
  };

  const confirmDisabled =
    loading || finalizing || !pendingTickets.length;

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
          <Text style={styles.headerTitle}>
            Confirm Reserved Bundle
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* MAIN SCROLL: whole page scrolls */}
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
              <Text style={styles.muted}>Loading bundle…</Text>
            </View>
          )}

          {!loading && error && !tickets.length && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !!tickets.length && (
            <>
              {/* PREVIEW BOX (swipe + zoom) */}
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
                    <Text style={styles.tapHint}>
                      Tap ticket to zoom
                    </Text>

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

              {/* BUNDLE SUMMARY */}
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>
                  Bundle Reservation
                </Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tickets</Text>
                  <Text style={styles.infoValue}>
                    {tickets.length}
                  </Text>
                </View>

                {!!bundleId && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bundle ID</Text>
                    <Text style={styles.infoValue}>{bundleId}</Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pending</Text>
                  <Text style={styles.infoValue}>
                    {pendingTickets.length}
                  </Text>
                </View>

                {!!totalAmount && totalAmount > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Amount</Text>
                    <Text style={styles.infoValue}>
                      ₱{totalAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                <Text style={styles.infoHint}>
                  Confirm payment to activate all pending tickets
                  in this bundle.
                </Text>
              </View>

              {/* TICKET LIST */}
              <Text style={styles.listTitle}>Tickets in Bundle</Text>

              <View style={styles.listContent}>
                {tickets.map((t, idx) => (
                  <View key={t.id} style={styles.ticketRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketName}>
                        {t.seatLabel}
                      </Text>
                      <Text style={styles.ticketSeat}>
                        {t.seatDetail}
                      </Text>
                    </View>
                    <View style={styles.ticketRight}>
                      {typeof t.price === "number" && (
                        <Text style={styles.ticketPrice}>
                          ₱{t.price.toFixed(2)}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.ticketStatus,
                          t.status === "pending" && {
                            color: "#F59E0B",
                          },
                          t.status === "active" && {
                            color: "#16A34A",
                          },
                        ]}
                      >
                        {t.status}
                      </Text>
                      {idx === currentIndex && (
                        <Text style={styles.currentTag}>
                          Previewing
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* footer (sticky) */}
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
            {finalizing
              ? "Finalizing…"
              : pendingTickets.length
              ? `Confirm Payment for ${pendingTickets.length} Ticket${
                  pendingTickets.length > 1 ? "s" : ""
                }`
              : "No Pending Tickets"}
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

  // preview box
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

  listTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  listContent: {
    paddingBottom: 10,
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  ticketName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  ticketSeat: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  ticketRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  ticketPrice: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  ticketStatus: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    textTransform: "capitalize",
  },
  currentTag: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#071689",
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
