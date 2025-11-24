// app/views/confirmPayment.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type TicketSummary } from "../../lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type UITicket = {
  id: string;
  url: string;
  seatLabel: string;
  seatDetail: string;
  type: "adult" | "child" | "priority";
  backgroundColor: string;
};

type IncomingTicketForm = {
  fullName: string;
  age: string;
  number: string;
  section?: string;
  side?: string;
  price: number;
  isPWD: boolean;
  isChild: boolean;
  teamId?: string | null;
  teamName?: string | null;
};

const BG_BY_TYPE: Record<UITicket["type"], string> = {
  adult: "#DBEAFE",
  child: "#FEF3C7",
  priority: "#DCFCE7",
};

export default function ConfirmPayment() {
  const params = useLocalSearchParams<{
    tickets?: string;
    subtotal?: string;
    eventId?: string;
    seasonId?: string;
    eventName?: string;
  }>();

  const createdIdsRef = useRef<string[]>([]);
  const confirmedRef = useRef(false);
  const cleaningRef = useRef(false);
  const bundleIdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [uiTickets, setUiTickets] = useState<UITicket[]>([]);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<FlatList<UITicket>>(null);
  const [idx, setIdx] = useState(0);

  const eventId = String(params.eventId || "");
  const seasonId = String(params.seasonId || "");
  const eventTitle = String(params.eventName || ""); // use real event name if the previous screen passes it

  const goBackToCreate = useCallback(() => {
    router.replace("/views/createTicket");
  }, []);

  const cancelProvisional = useCallback(async () => {
    if (cleaningRef.current) return;
    const ids = createdIdsRef.current;
    const bundleId = bundleIdRef.current || undefined;
    if ((!ids?.length && !bundleId) || confirmedRef.current) return;
    cleaningRef.current = true;
    try {
      await scannerApi.cancelTickets(eventId, seasonId, ids, bundleId);
    } catch {
      // ignore cleanup errors
    } finally {
      cleaningRef.current = false;
      createdIdsRef.current = [];
      bundleIdRef.current = null;
    }
  }, [eventId, seasonId]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        cancelProvisional().finally(goBackToCreate);
        return true;
      };
      if (Platform.OS === "android") {
        const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => sub.remove();
      }
      return undefined;
    }, [cancelProvisional, goBackToCreate])
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        createdIdsRef.current = [];
        confirmedRef.current = false;
        bundleIdRef.current = null;

        const rawStr = String(params.tickets || "[]");
        const input: IncomingTicketForm[] = JSON.parse(rawStr || "[]");

        if (!eventId || !seasonId) throw new Error("Missing eventId/seasonId");
        if (!Array.isArray(input) || input.length === 0) throw new Error("No tickets to create");

        const ordered = [
          ...input.filter((t) => !t.isChild),
          ...input.filter((t) => t.isChild),
        ];

        const payload = ordered.map((t) => ({
          fullName: t.fullName?.trim() || "",
          age: t.age || "",
          number: t.isChild ? undefined : (t.number || "").trim(),
          section: String(t.section || ""),
          side: String(t.side || ""),
          isChild: !!t.isChild,
          isPriority: !!t.isPWD,
        }));

        const createRes = await scannerApi.createTickets(eventId, seasonId, payload);

        const createdIds = (createRes.ids as string[]) || [];
        let summaries: TicketSummary[] | undefined = createRes.items;

        if (!summaries || summaries.length === 0) {
          const ids = createdIds || [];
          if (ids.length === 0) throw new Error("Server did not return ticket ids");
          const fetchRes = await scannerApi.fetchTickets(eventId, seasonId, ids);
          summaries = fetchRes.items;
        }

        if ((!createdIds || createdIds.length === 0) && summaries?.length) {
          createdIdsRef.current = summaries.map((s) => s.id);
        } else {
          createdIdsRef.current = createdIds;
        }
        bundleIdRef.current = (summaries?.[0]?.bundleId as string | null) ?? null;

        const mapped: UITicket[] = (summaries || []).map((s) => ({
          id: s.id,
          url: s.ticketUrl || "",
          seatLabel: s.assignedName || "Unnamed",
          seatDetail: `${s.sectionName || "Section"} @ ${s.sideLabel || "Side"}`,
          type: (s.type || "adult") as UITicket["type"],
          backgroundColor: BG_BY_TYPE[(s.type || "adult") as UITicket["type"]],
        }));

        setUiTickets(mapped);
        setIdx(0);
      } catch (e: any) {
        setError(e?.message || "Failed to prepare tickets");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelProvisional();
    };
  }, [eventId, seasonId, params.tickets, cancelProvisional]);

  const onViewableItemsChanged = useRef(
    (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const firstVisible = info.viewableItems.find((v) => v.index != null);
      if (firstVisible && firstVisible.index != null) setIdx(firstVisible.index);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const getItemLayout = useCallback(
    (_data: ArrayLike<UITicket> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleTopBack = useCallback(() => {
    cancelProvisional().finally(goBackToCreate);
  }, [cancelProvisional, goBackToCreate]);

    const handleConfirmPayment = async () => {
      if (finalizing) return;
      try {
        setFinalizing(true);
        const ids = createdIdsRef.current;
        const bundleId = bundleIdRef.current || undefined;
        if (!ids?.length && !bundleId) throw new Error("Nothing to confirm");

        await scannerApi.confirmTickets(eventId, seasonId, ids, bundleId, "active");
        confirmedRef.current = true;

        const itemsJson = JSON.stringify(
          uiTickets.map((s) => ({
            id: s.id,
            url: s.url,
            seatLabel: s.seatLabel,
            seatDetail: s.seatDetail,
            type: s.type,
          }))
        );

        const t = uiTickets[idx];
        if (t) {
          router.push({
            pathname: "/views/approveTicket",
            params: {
              status: "active",
              eventName: eventTitle || "",
              items: itemsJson,
              initialIndex: String(idx),

              eventId,
              seasonId,
              bundleId: bundleId || "",

              // single-ticket fallback
              ticketId: t.id,
              ticketUrl: t.url,
            },
          });
        } else {
          router.replace("/views/allTickets");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to confirm tickets");
      } finally {
        setFinalizing(false);
      }
    };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleTopBack} hitSlop={10} style={{ paddingRight: 6 }}>
            <Ionicons name="arrow-back" size={22} color="#071689" />
          </Pressable>
          <Text style={styles.headerTitle}>Preview & Confirm</Text>
          <View style={{ width: 22 }} />
        </View>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.muted}>Preparing tickets…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && uiTickets.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.muted}>No tickets generated.</Text>
          </View>
        )}

        {!loading && !error && uiTickets.length > 0 && (
          <>
            <View style={styles.ticketCounter}>
              <Text style={styles.counterText}>
                Ticket {idx + 1} of {uiTickets.length}
              </Text>
            </View>

            <View style={styles.ticketContainer}>
              <FlatList
                ref={listRef}
                data={uiTickets}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                snapToInterval={SCREEN_WIDTH}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={0}
                getItemLayout={getItemLayout}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    listRef.current?.scrollToOffset({
                      offset: info.index * SCREEN_WIDTH,
                      animated: true,
                    });
                  }, 0);
                }}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                contentContainerStyle={{ paddingBottom: 92 }}
                renderItem={({ item }) => (
                  <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 20 }}>
                    <View style={[styles.ticketFrame, { backgroundColor: item.backgroundColor }]}>
                      {item.url ? (
                        <Image
                          source={{ uri: item.url }}
                          style={styles.ticketImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.noImageBox}>
                          <Text style={styles.muted}>No preview available</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              />
            </View>

            <View style={styles.dotsIndicator} accessibilityRole="progressbar">
              {uiTickets.map((_, i) => (
                <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleConfirmPayment}
          disabled={loading || !!error || uiTickets.length === 0 || finalizing}
          style={[
            styles.confirmBtn,
            (loading || !!error || uiTickets.length === 0 || finalizing) && { backgroundColor: "#9CA3AF" },
          ]}
        >
          <Text style={styles.confirmText}>{finalizing ? "Finalizing…" : "Confirm Payment"}</Text>
        </Pressable>
      </View>
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
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },

  centerBox: { padding: 24, alignItems: "center", justifyContent: "center" },
  muted: { color: "#6B7280" },
  errorText: { color: "#E53935", fontWeight: "700" },

  ticketCounter: { alignItems: "center", marginBottom: 12, paddingHorizontal: 20 },
  counterText: { fontSize: 14, color: "#6B7280", fontWeight: "600" },

  ticketContainer: { flex: 1, marginBottom: 16 },

  ticketFrame: {
    borderRadius: 12,
    padding: 10,
    minHeight: SCREEN_HEIGHT * 0.65,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketImage: { width: "100%", height: SCREEN_HEIGHT * 0.7 },
  noImageBox: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.7,
    alignItems: "center",
    justifyContent: "center",
  },

  dotsIndicator: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  dotActive: { backgroundColor: "#071689" },

  footer: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1, borderTopColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: -2 }, shadowRadius: 6, elevation: 10,
  },
  confirmBtn: {
    height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#071689",
  },
  confirmText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
