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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type TicketSummary } from "../../lib/api";

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
    code?: string; // QR payload (JSON), URL-encoded
  }>();

  const mode =
    (Array.isArray(params.mode) ? params.mode[0] : params.mode) || "scan";
  const isScanMode = mode === "scan";
  const isCreateMode = mode === "create";

  const [status, setStatus] = useState<TicketStatus>(
    (Array.isArray(params.status) ? params.status[0] : params.status) ??
      "active"
  );
  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(isScanMode);
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Context for update calls
  const [ctx, setCtx] = useState<{
    seasonId: string;
    eventId: string;
    ticketId: string;
  } | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

  // Fallback values (for create/manual mode)
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

  // Event name: for scanner, we trust what was passed from the Scanner screen;
  // otherwise use a generic label.
  const eventName = fallbackEventName;

  // Fetch ticket details when in scanner mode
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

  // Derive display fields
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

  const imageFromTicket = ticket?.ticketUrl || null;

  const effectiveHolder = holderFromTicket || fallbackHolder;
  const effectiveSide = sideFromTicket || fallbackSide;
  const effectiveTicketId = idFromTicket || fallbackTicketId;
  const effectiveType: "adult" | "child" | "priority" =
    normalizedType === "child"
      ? "child"
      : normalizedType === "priority"
      ? "priority"
      : "adult";

  // In scan mode, use ticket image; in create mode, use ticketUrl from params
  const ticketImageUrl = isScanMode ? imageFromTicket : fallbackTicketUrl || null;

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

    // If somehow we don't have context (manual mode), just update UI
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

  const handleRedeem = () => void handleUpdateStatus("redeemed");
  const handleInvalidate = () => void handleUpdateStatus("invalid");

  const handleBack = () => {
    if (isCreateMode) {
      router.replace("/views/welcome");
      return;
    }
    if (
      status === "active" ||
      status === "expired" ||
      status === "cancelled" ||
      status === "pending"
    ) {
      router.back();
    } else {
      // for redeemed/invalid we reset local state when going back
      setTimeout(() => setStatus("active"), 50);
      router.back();
    }
  };

  const handleScanAgain = () => router.replace("/views/scanner");
  const goHome = () => router.replace("/views/welcome");
  const createNextTicket = () => router.replace("/views/createTicket");

  const showPriorityBadge = effectiveType === "priority";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
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
            {/* Clickable + zoomable ticket preview */}
            <Pressable
              style={styles.ticketWrap}
              onPress={() => {
                if (ticketImageUrl) setZoomOpen(true);
              }}
            >
              {ticketImageUrl ? (
                <Image
                  source={{ uri: ticketImageUrl }}
                  style={styles.ticketImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.ticketFallback}>
                  <Text style={styles.muted}>No ticket image available</Text>
                </View>
              )}
            </Pressable>

            {/* Priority badge */}
            {showPriorityBadge && (
              <View style={styles.badgeRow}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>PRIORITY TICKET</Text>
                </View>
              </View>
            )}

            {/* Meta details */}
            <View style={styles.meta}>
              <MetaRow label="Event" value={eventName} />
              <MetaRow label="Name" value={effectiveHolder} />
              <MetaRow label="Side" value={effectiveSide} />
              <MetaRow label="Ticket ID" value={effectiveTicketId} />
            </View>

            {/* CREATE MODE actions */}
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

            {/* SCAN / VALIDATE MODE actions */}
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
                    <Text style={[styles.ctaText, { color: "#111" }]}>Back</Text>
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

      {/* Zoom modal with pinch + swipe */}
      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
      >
        <View style={styles.modalBackdrop}>
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
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.zoomWrap}
              minimumZoomScale={1}
              maximumZoomScale={3}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bouncesZoom
            >
              {ticketImageUrl ? (
                <Image
                  source={{ uri: ticketImageUrl }}
                  style={styles.zoomImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.ticketFallback}>
                  <Text>No ticket image available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
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
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  zoomImage: { width: "100%", height: "100%" },
});
