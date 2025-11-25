import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Modal,
  ScrollView,
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

function asString(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default function ApproveReserved() {
  const params = useLocalSearchParams<{
    eventId?: string | string[];
    seasonId?: string | string[];
    eventName?: string | string[];
    ticketId?: string | string[];
    ticketUrl?: string | string[];
    holderName?: string | string[];
    section?: string | string[];
    side?: string | string[];
    amountPaid?: string | string[];
    refNumber?: string | string[];
  }>();

  const eventName = asString(params.eventName, "");
  const ticketUrl = asString(params.ticketUrl, "");
  const holderName = asString(params.holderName, "");
  const section = asString(params.section, "");
  const side = asString(params.side, "");
  const amountPaid = asString(params.amountPaid, "");
  const refNumber = asString(params.refNumber, "");

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

  const goBackToTickets = () => router.back();

  const resetZoom = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Payment Confirmed</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {!!eventName && (
            <Text style={styles.eventName} numberOfLines={2}>
              {eventName}
            </Text>
          )}

          <View style={styles.ticketBox}>
            {ticketUrl ? (
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
                      source={{ uri: ticketUrl }}
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

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#071689" />
            </View>
            <Text style={styles.mainText}>Ticket Activated</Text>
            <Text style={styles.subtitle}>
              The reserved ticket has been marked as{" "}
              <Text style={{ fontWeight: "700" }}>active</Text>. You can now
              use it for entry.
            </Text>

            <View style={styles.detailsBox}>
              {!!holderName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{holderName}</Text>
                </View>
              )}
              {(section || side) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Seat</Text>
                  <Text style={styles.detailValue}>
                    {section}
                    {section && side ? " · " : ""}
                    {side}
                  </Text>
                </View>
              )}
              {!!amountPaid && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>{amountPaid}</Text>
                </View>
              )}
              {!!refNumber && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reference</Text>
                  <Text style={styles.detailValue}>{refNumber}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.singleRow}>
          <Pressable
            onPress={goBackToTickets}
            style={[styles.cta, { backgroundColor: "#071689" }]}
          >
            <Text style={styles.ctaText}>Back to Tickets</Text>
          </Pressable>
        </View>
      </View>

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
              {ticketUrl && (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View collapsable={false}>
                    <Animated.Image
                      source={{ uri: ticketUrl }}
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
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
