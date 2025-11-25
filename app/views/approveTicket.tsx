// app/views/approveTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Modal,
  Alert,
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

type TicketStatus = "active" | "redeemed";

type UITicket = {
  id: string;
  url: string;
  seatLabel: string;
  seatDetail: string;
  type: "adult" | "child" | "priority";
};

export default function ApproveTicket() {
  const params = useLocalSearchParams<{
    status?: TicketStatus;
    ticketUrl?: string;
    eventId?: string;
    seasonId?: string;
    eventName?: string;
    items?: string;        // JSON string of UITicket[]
    initialIndex?: string; // which ticket user was on
    bundleId?: string;
    ticketId?: string;     // fallback
  }>();

  // --------- Basic params ---------
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const [status, setStatus] = useState<TicketStatus>(
    rawStatus === "redeemed" ? "redeemed" : "active"
  );

  const rawEventId = Array.isArray(params.eventId)
    ? params.eventId[0]
    : params.eventId;
  const rawSeasonId = Array.isArray(params.seasonId)
    ? params.seasonId[0]
    : params.seasonId;
  const rawEventName = Array.isArray(params.eventName)
    ? params.eventName[0]
    : params.eventName;
  const rawBundleId = Array.isArray(params.bundleId)
    ? params.bundleId[0]
    : params.bundleId;
  const rawTicketUrlParam = Array.isArray(params.ticketUrl)
    ? params.ticketUrl[0]
    : params.ticketUrl;
  const rawTicketIdParam = Array.isArray(params.ticketId)
    ? params.ticketId[0]
    : params.ticketId;

  const eventId = (rawEventId || "").trim() || null;
  const seasonId = (rawSeasonId || "").trim() || null;
  const bundleId = (rawBundleId || "").trim() || null;
  const eventName = rawEventName || "";

  // --------- Items + index from ConfirmPayment ---------
  const rawItems = Array.isArray(params.items) ? params.items[0] : params.items;
  const rawInitialIndex = Array.isArray(params.initialIndex)
    ? params.initialIndex[0]
    : params.initialIndex;

  let items: UITicket[] = [];
  try {
    if (rawItems) {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) items = parsed as UITicket[];
    }
  } catch {
    items = [];
  }

  const initialIndex = (() => {
    const n = rawInitialIndex ? parseInt(rawInitialIndex, 10) : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    if (items.length === 0) return 0;
    if (n >= items.length) return items.length - 1;
    return n;
  })();

  // ✅ Allow changing index now
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const currentTicket = items[currentIndex];

  const previewUrl = currentTicket?.url || rawTicketUrlParam || null;

  const hasMultiple = items.length > 1;

  const handlePrevTicket = () => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => {
      if (prev <= 0) return items.length - 1;
      return prev - 1;
    });
  };

  const handleNextTicket = () => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => {
      if (prev >= items.length - 1) return 0;
      return prev + 1;
    });
  };

  // For Redeem All, collect all IDs (fallback if no bundleId)
  const allTicketIds: string[] =
    items.length > 0
      ? items.map((t) => t.id).filter(Boolean)
      : rawTicketIdParam
      ? [rawTicketIdParam]
      : [];

  // Zoom modal state
  const [zoomVisible, setZoomVisible] = useState(false);

  // Redeem-all busy flag
  const [redeemBusy, setRedeemBusy] = useState(false);

  // --------- Zoom + Pan shared values (same logic as ConfirmVoucher) ---------
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

  // --------- Header text + color ---------
  const header = useMemo(() => {
    if (status === "active") {
      return { text: "Tickets Created!", color: "#071689" };
    }
    // status === "redeemed"
    return { text: "Tickets Redeemed!", color: "#071689" };
  }, [status]);

  // --------- Subtitle text ---------
  const subtitle = useMemo(() => {
    if (status === "active") {
      return "The tickets have been purchased successfully.";
    }
    return "All tickets in this purchase have been redeemed.";
  }, [status]);

  // --------- Navigation helpers ---------
  const handleTopBack = () => {
    // After purchase, going back should just reset to create or home
    router.replace("/views/createTicket");
  };

  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");

  // --------- Redeem ALL tickets in this purchase ---------
  const handleRedeemNow = async () => {
    if (redeemBusy || status === "redeemed") return;

    try {
      setRedeemBusy(true);

      // Only hit backend if we have event + season + at least some reference
      if (eventId && seasonId) {
        if (bundleId) {
          // ✅ Redeem the entire bundle in one go
          await scannerApi.confirmTickets(
            eventId,
            seasonId,
            undefined,
            bundleId,
            "redeemed"
          );
        } else if (allTicketIds.length > 0) {
          // ✅ Redeem all ticket IDs we know about
          await scannerApi.confirmTickets(
            eventId,
            seasonId,
            allTicketIds,
            undefined,
            "redeemed"
          );
        }
      }

      setStatus("redeemed");
      Alert.alert(
        "Tickets Redeemed",
        "All tickets in this purchase have been marked as redeemed.",
        [{ text: "OK" }]
      );
    } catch (e: any) {
      Alert.alert(
        "Redeem Failed",
        e?.message || "Could not redeem these tickets. Please try again."
      );
    } finally {
      setRedeemBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleTopBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={[styles.title, { color: header.color }]}>
          {header.text}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        {/* Body area → event name, preview, card */}
        <View style={{ flex: 1 }}>
          {!!eventName && (
            <Text style={styles.eventName} numberOfLines={2}>
              {eventName}
            </Text>
          )}

          {/* Ticket preview (single ticket, but indexable) */}
          {previewUrl && (
            <View style={styles.ticketBox}>
              <Pressable
                onPress={() => {
                  // reset zoom before opening
                  scale.value = 1;
                  translateX.value = 0;
                  translateY.value = 0;
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
                    Ticket {currentIndex + 1} of {items.length}
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
            </View>
          )}

          {/* Confirmation card */}
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#071689" />
            </View>
            <Text style={styles.mainText}>{header.text}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        {/* Actions */}
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

        {/* Redeem All button (only if still active) */}
        {status === "active" && (
          <Pressable
            onPress={handleRedeemNow}
            disabled={redeemBusy}
            style={[
              styles.singleCta,
              {
                backgroundColor: "#108b00ff",
                opacity: redeemBusy ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.ctaText}>
              {redeemBusy ? "Redeeming..." : "Redeem All Now"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Full-screen zoom modal for ticket image */}
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
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    justifyContent: "space-between",
  },

  eventName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },

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
    paddingBottom: 4,
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
    paddingVertical: 32,
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

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  singleCta: {
    marginTop: 8,
    marginBottom: 32,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
