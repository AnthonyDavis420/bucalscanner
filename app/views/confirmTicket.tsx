// app/views/confirmTicket.tsx
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

type TicketStatus =
  | "active"
  | "redeemed"
  | "invalid"
  | "expired"
  | "cancelled"
  | "pending";

type TicketType = "adult" | "child" | "priority";

type BundleTicket = TicketSummary & {
  type?: TicketType;
};

type Mode = "create" | "scan" | "list" | "bundle";

function typeRank(type?: TicketType | null): number {
  if (type === "adult") return 0;
  if (type === "priority") return 1;
  if (type === "child") return 2;
  return 3;
}

const ALLOWED_STATUSES: TicketStatus[] = [
  "active",
  "redeemed",
  "invalid",
  "expired",
  "cancelled",
  "pending",
];

export default function ConfirmTicket() {
  const params = useLocalSearchParams<{
    mode?: Mode;
    status?: TicketStatus;
    eventName?: string;
    holderName?: string;
    side?: string;
    ticketId?: string;
    ticketUrl?: string;
    code?: string;
    eventId?: string;
    seasonId?: string;
    bundleId?: string;
  }>();

  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode: Mode =
    rawMode === "create"
      ? "create"
      : rawMode === "list"
      ? "list"
      : rawMode === "bundle"
      ? "bundle"
      : "scan";

  const isScanMode = mode === "scan";
  const isCreateMode = mode === "create";
  const isBundleMode = mode === "bundle";
  const fromAllTickets = mode === "list" || mode === "bundle";

  const [status, setStatus] = useState<TicketStatus>(
    (Array.isArray(params.status) ? params.status[0] : params.status) ??
      "active"
  );

  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [bundleTickets, setBundleTickets] = useState<BundleTicket[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState<boolean>(
    isScanMode || fromAllTickets || isBundleMode
  );
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  const [ctx, setCtx] = useState<{
    seasonId: string;
    eventId: string;
    ticketId: string;
  } | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

  const rawEventName = Array.isArray(params.eventName)
    ? params.eventName[0]
    : params.eventName;
  const rawHolder = Array.isArray(params.holderName)
    ? params.holderName[0]
    : params.holderName;
  const rawSide = Array.isArray(params.side) ? params.side[0] : params.side;
  const rawTicketUrlParam = Array.isArray(params.ticketUrl)
    ? params.ticketUrl[0]
    : params.ticketUrl;
  const rawTicketIdParam = Array.isArray(params.ticketId)
    ? params.ticketId[0]
    : params.ticketId;

  const rawEventIdParam = Array.isArray(params.eventId)
    ? params.eventId[0]
    : params.eventId;
  const rawSeasonIdParam = Array.isArray(params.seasonId)
    ? params.seasonId[0]
    : params.seasonId;
  const rawBundleIdParam = Array.isArray(params.bundleId)
    ? params.bundleId[0]
    : params.bundleId;

  const eventIdFromParams = (rawEventIdParam || "").trim();
  const seasonIdFromParams = (rawSeasonIdParam || "").trim();
  const ticketIdFromParams = (rawTicketIdParam || "").trim();
  const bundleId = (rawBundleIdParam || "").trim();

  const fallbackEventName = rawEventName || "Event Ticket";
  const fallbackHolder = rawHolder || "John Doe";
  const fallbackSide = rawSide || "Section @ Side";
  const fallbackTicketId = ticketIdFromParams || "TICKET-ID";
  const fallbackTicketUrl = rawTicketUrlParam || "";

  const eventName = fallbackEventName;

  useEffect(() => {
    if (mode === "bundle") {
      if (!eventIdFromParams || !seasonIdFromParams || !bundleId) {
        setError("Missing bundle ticket context.");
        setLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await scannerApi.fetchTickets(
            eventIdFromParams,
            seasonIdFromParams,
            []
          );
          const items = Array.isArray(res.items) ? res.items : [];
          const bundleItems = items.filter((src: TicketSummary) => {
            const srcBundle = (src as any).bundleId;
            return srcBundle && String(srcBundle) === bundleId;
          });

          if (!bundleItems.length) {
            throw new Error("No tickets found for this bundle.");
          }

          const sorted = [...bundleItems].sort((a, b) => {
            const ta = (a as any).type as TicketType | undefined;
            const tb = (b as any).type as TicketType | undefined;
            return typeRank(ta) - typeRank(tb);
          });

          if (!cancelled) {
            setBundleTickets(sorted as BundleTicket[]);
            setCurrentIndex(0);
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message || "Failed to load bundle tickets.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (isCreateMode) {
      setLoading(false);
      return;
    }

    if (isScanMode) {
      const rawParam = Array.isArray(params.code)
        ? params.code[0]
        : params.code;
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
        payload?.ticketId || ticketIdFromParams || ""
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
          const res = await scannerApi.fetchTickets(eventId, seasonId, [
            ticketId,
          ]);
          const t = (res.items || [])[0] || null;
          if (!t) {
            setError("Ticket not found.");
          } else {
            setTicket(t);
            const rawStatus = String((t as any).status || "").toLowerCase();
            if (ALLOWED_STATUSES.includes(rawStatus as TicketStatus)) {
              setStatus(rawStatus as TicketStatus);
            } else {
              setStatus("active");
            }
          }
        } catch (e: any) {
          setError(e?.message || "Failed to load ticket.");
        } finally {
          setLoading(false);
        }
      })();

      return;
    }

    if (
      fromAllTickets &&
      eventIdFromParams &&
      seasonIdFromParams &&
      ticketIdFromParams
    ) {
      setCtx({
        seasonId: seasonIdFromParams,
        eventId: eventIdFromParams,
        ticketId: ticketIdFromParams,
      });

      (async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await scannerApi.fetchTickets(
            eventIdFromParams,
            seasonIdFromParams,
            [ticketIdFromParams]
          );
          const t = (res.items || [])[0] || null;
          if (!t) {
            setError("Ticket not found.");
          } else {
            setTicket(t);
            const rawStatus = String((t as any).status || "").toLowerCase();
            if (ALLOWED_STATUSES.includes(rawStatus as TicketStatus)) {
              setStatus(rawStatus as TicketStatus);
            } else {
              setStatus("active");
            }
          }
        } catch (e: any) {
          setError(e?.message || "Failed to load ticket.");
        } finally {
          setLoading(false);
        }
      })();

      return;
    }

    setLoading(false);
  }, [
    mode,
    isScanMode,
    isCreateMode,
    fromAllTickets,
    params.code,
    eventIdFromParams,
    seasonIdFromParams,
    ticketIdFromParams,
    bundleId,
  ]);

  useEffect(() => {
    if (!isBundleMode || !bundleTickets.length) return;

    const maxIndex = bundleTickets.length - 1;
    const safeIndex =
      currentIndex < 0
        ? 0
        : currentIndex > maxIndex
        ? maxIndex
        : currentIndex;

    if (safeIndex !== currentIndex) {
      setCurrentIndex(safeIndex);
      return;
    }

    const current = bundleTickets[safeIndex];
    if (!current) return;

    setTicket(current);
    const rawStatus = String((current as any).status || "").toLowerCase();
    if (ALLOWED_STATUSES.includes(rawStatus as TicketStatus)) {
      setStatus(rawStatus as TicketStatus);
    } else {
      setStatus("active");
    }

    if (eventIdFromParams && seasonIdFromParams) {
      setCtx({
        seasonId: seasonIdFromParams,
        eventId: eventIdFromParams,
        ticketId: current.id,
      });
    }
  }, [
    isBundleMode,
    bundleTickets,
    currentIndex,
    eventIdFromParams,
    seasonIdFromParams,
  ]);

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
      if (isBundleMode) {
        setBundleTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id ? ({ ...t, status: nextStatus } as BundleTicket) : t
          )
        );
      }
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
      if (isBundleMode) {
        setBundleTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id ? ({ ...t, status: "active" } as BundleTicket) : t
          )
        );
      }
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

  const goBackToTickets = () => router.back();

  const handleBack = async () => {
    if (fromAllTickets) {
      goBackToTickets();
      return;
    }

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

  const hasBundlePagination =
    isBundleMode && bundleTickets.length > 1 && !!ticketImageUrl;

  const handlePrevBundleTicket = () => {
    if (!hasBundlePagination) return;
    setCurrentIndex((prev) =>
      prev <= 0 ? bundleTickets.length - 1 : prev - 1
    );
  };

  const handleNextBundleTicket = () => {
    if (!hasBundlePagination) return;
    setCurrentIndex((prev) =>
      prev >= bundleTickets.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { backgroundColor: "#F3F4F6" },
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={header?.color ?? "#071689"}
          />
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
            {!fromAllTickets && (
              <Pressable
                onPress={handleScanAgain}
                style={[
                  styles.cta,
                  { backgroundColor: "#071689", marginTop: 18 },
                ]}
              >
                <Text style={styles.ctaText}>Scan Again</Text>
              </Pressable>
            )}
            {fromAllTickets && (
              <Pressable
                onPress={goBackToTickets}
                style={[
                  styles.cta,
                  { backgroundColor: "#071689", marginTop: 18 },
                ]}
              >
                <Text style={styles.ctaText}>Back to Tickets</Text>
              </Pressable>
            )}
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
                        onError={(e) => {
                          console.log("IMAGE LOAD ERROR:", e.nativeEvent);
                          console.log(
                            "IMAGE URI THAT FAILED:",
                            ticketImageUrl
                          );
                        }}
                      />
                    </View>
                  </Pressable>
                  <Text style={styles.tapHint}>
                    {hasBundlePagination
                      ? `Tap to zoom · Ticket ${
                          currentIndex + 1
                        } of ${bundleTickets.length}`
                      : "Tap ticket to zoom"}
                  </Text>
                  {hasBundlePagination && (
                    <View style={styles.paginationRow}>
                      <Pressable
                        onPress={handlePrevBundleTicket}
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
                        Ticket {currentIndex + 1} of {bundleTickets.length}
                      </Text>
                      <Pressable
                        onPress={handleNextBundleTicket}
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
                    <Text style={[styles.ctaText, { color: "#111" }]}>
                      Back
                    </Text>
                  </Pressable>
                </View>
              )}

            {!isCreateMode &&
              (status === "redeemed" || status === "invalid") && (
                <View style={styles.row}>
                  <Pressable
                    onPress={handleUndoToActive}
                    disabled={actionBusy}
                    style={[styles.cta, styles.ghost]}
                  >
                    <Text style={[styles.ctaText, { color: "#111" }]}>
                      Revert Changes
                    </Text>
                  </Pressable>

                  {!fromAllTickets ? (
                    <Pressable
                      onPress={handleScanAgain}
                      disabled={actionBusy}
                      style={[styles.cta, { backgroundColor: "#071689" }]}
                    >
                      <Text style={styles.ctaText}>Scan Again</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={goBackToTickets}
                      disabled={actionBusy}
                      style={[styles.cta, { backgroundColor: "#071689" }]}
                    >
                      <Text style={styles.ctaText}>Back to Tickets</Text>
                    </Pressable>
                  )}
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
