// app/views/confirmPayment.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Ticket = {
  id: number;
  seatLabel: string;   // holder name
  seatDetail: string;  // section/side detail
  ticketType: "Adult" | "Child";
  backgroundColor: string;
};

export default function ConfirmPayment() {
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    subtitle?: string;
    venue?: string;
    venueUrl?: string;
    homeName?: string;
    awayName?: string;
    homeLogo?: string;
    awayLogo?: string;
    seatLabel?: string;
    seatDetail?: string;
    startIndex?: string;
  }>();

  // Intercept Android hardware back → go to tickets tab
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace("tabs/tickets");
        return true;
      };
      if (Platform.OS === "android") {
        const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => sub.remove();
      }
      return undefined;
    }, [])
  );

  const title = params.title || "NCF vs ADNU Game 2";
  const subtitle = params.subtitle || "Basketball Senior Division Semi-finals";
  const venue = params.venue || "ADNU Gymnasium";
  const venueUrl = params.venueUrl || "";
  const homeName = params.homeName || "NCF Tigers";
  const awayName = params.awayName || "ADNU Golden Knights";
  const homeLogo =
    params.homeLogo || "https://via.placeholder.com/240x240.png?text=NCF";
  const awayLogo =
    params.awayLogo || "https://via.placeholder.com/240x240.png?text=ADNU";

  const tickets = useMemo<Ticket[]>(
    () => [
      {
        id: 1,
        seatLabel: "Sai Bawang",
        seatDetail: "Courtside Seating @ ADNU Side",
        ticketType: "Adult",
        backgroundColor: "#BFE0FF",
      },
      {
        id: 2,
        seatLabel: "Maria Santos",
        seatDetail: "Upper Box Section A, Row 3",
        ticketType: "Adult",
        backgroundColor: "#D1FAE5",
      },
      {
        id: 3,
        seatLabel: "Juan Santos",
        seatDetail: "Upper Box Section A, Row 3",
        ticketType: "Child",
        backgroundColor: "#FEF3C7",
      },
    ],
    []
  );

  const initialIndex = Math.min(
    Math.max(parseInt(String(params.startIndex ?? "0"), 10) || 0, 0),
    Math.max(tickets.length - 1, 0)
  );

  const listRef = useRef<FlatList<Ticket>>(null);
  const [idx, setIdx] = useState(initialIndex);

  const openVenue = useCallback(async () => {
    if (!venueUrl) return;
    try {
      await Linking.openURL(venueUrl);
    } catch {}
  }, [venueUrl]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index?: number }[] }) => {
      const firstVisible = viewableItems.find((v) => v.index !== undefined);
      if (firstVisible?.index !== undefined) setIdx(firstVisible.index!);
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const getItemLayout = useCallback(
    (_: Ticket[] | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const scrollTo = (nextIndex: number) => {
    if (!listRef.current) return;
    listRef.current.scrollToIndex({ index: nextIndex, animated: true });
  };

  const handleConfirmPayment = () => {
    const t = tickets[idx];
    const now = Date.now();
    const code = `EVT-${now.toString().slice(-7)}`;

  router.push({
    pathname: "/views/confirmTicket",
    params: {
      mode: "create",                // <-- tell confirmTicket it's the create flow
      nextIndex: String(idx + 1),    // <-- which ticket to open next
      status: "active",
      eventName: title,
      holderName: t.seatLabel,
      side: t.seatDetail,
      ticketId: String(t.id),
      code,
    },
  });
};


  if (tickets.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View
          style={[styles.container, { justifyContent: "center", alignItems: "center" }]}
        >
          <Text style={{ color: "#0F172A", fontWeight: "700" }}>
            No tickets found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.replace("tabs/tickets")}
            hitSlop={10}
            style={{ paddingRight: 6 }}
          >
            <Ionicons name="arrow-back" size={22} color="#071689" />
          </Pressable>
          <Text style={styles.headerTitle}>Ticket Details</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Ticket position indicator */}
        <View style={styles.ticketCounter}>
          <Text style={styles.counterText}>
            Ticket {idx + 1} of {tickets.length}
          </Text>
        </View>

        {/* Horizontal pager */}
        <View style={styles.ticketContainer}>
          <FlatList
            ref={listRef}
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            horizontal
            pagingEnabled
            snapToInterval={SCREEN_WIDTH}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
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
            contentContainerStyle={{ paddingBottom: 92 }} // leave space for footer button
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH }}>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={[
                      styles.ticketWrapper,
                      { backgroundColor: item.backgroundColor, marginHorizontal: 20 },
                    ]}
                  >
                    {/* Notches (cutouts) */}
                    <View style={[styles.notch, styles.notchTopLeft]} />
                    <View style={[styles.notch, styles.notchTopRight]} />
                    <View style={[styles.notch, styles.notchBottom]} />

                    <View style={styles.ticketInner}>
                      {/* Ticket type badge */}
                      <View style={styles.ticketTypeBadge}>
                        <Text
                          style={[
                            styles.ticketTypeText,
                            item.ticketType === "Child" && styles.childTicketText,
                          ]}
                        >
                          {item.ticketType} Ticket
                        </Text>
                      </View>

                      {/* Top: title + subtitle + venue */}
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{title}</Text>
                        <Text style={styles.eventSubtitle}>{subtitle}</Text>
                        <Text style={styles.eventVenue}>
                          @ {venue}{" "}
                          {venueUrl ? (
                            <Text onPress={openVenue} style={styles.venueLink}>
                              View Venue
                            </Text>
                          ) : null}
                        </Text>
                      </View>

                      {/* Teams row */}
                      <View style={styles.teamsRow}>
                        <View style={styles.teamCol}>
                          <Image source={{ uri: homeLogo }} style={styles.teamLogo} />
                          <Text style={styles.teamName}>{homeName}</Text>
                        </View>

                        <Text style={styles.vsText}>vs</Text>

                        <View style={styles.teamCol}>
                          <Image source={{ uri: awayLogo }} style={styles.teamLogo} />
                          <Text style={styles.teamName}>{awayName}</Text>
                        </View>
                      </View>

                      {/* Perforation */}
                      <View style={styles.dashed} />

                      {/* Barcode */}
                      <View style={styles.barcodeSection}>
                        <View style={styles.barcodeWrap}>
                          <BarcodeStub />
                        </View>
                      </View>

                      {/* Seat / Holder */}
                      <View style={styles.seatSection}>
                        <Text style={styles.seatLabel}>{item.seatLabel}</Text>
                        <Text style={styles.seatDetail}>{item.seatDetail}</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}
          />
        </View>

        {/* Dots indicator */}
        <View style={styles.dotsIndicator} accessibilityRole="progressbar">
          {tickets.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* Footer: Confirm Payment */}
      <View style={styles.footer}>
        <Pressable onPress={handleConfirmPayment} style={styles.confirmBtn}>
          <Text style={styles.confirmText}>Confirm Payment</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function BarcodeStub() {
  const bars = [3, 2, 1, 2, 4, 1, 3, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 3, 2, 1, 4, 2, 1, 3, 2, 1, 3, 4, 2, 1];
  return (
    <View style={barcodeStyles.wrap}>
      {bars.map((w, i) => (
        <View
          key={i}
          style={{ width: w, height: "100%", backgroundColor: "#0F172A", marginRight: 2 }}
        />
      ))}
    </View>
  );
}

const barcodeStyles = StyleSheet.create({
  wrap: {
    height: 60,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: {
    flex: 1,
    paddingTop: 12,
  },

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

  ticketCounter: {
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  counterText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  ticketContainer: {
    flex: 1,
    marginBottom: 16,
  },

  ticketWrapper: {
    borderRadius: 0,
    padding: 16,
    paddingTop: 20,
    paddingBottom: 20,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginVertical: 8,
    minHeight: SCREEN_HEIGHT * 0.65,
  },
  ticketInner: {
    backgroundColor: "transparent",
    flex: 1,
  },

  notch: {
    position: "absolute",
    width: 72,
    height: 72,
    backgroundColor: "#FFFFFF",
    borderRadius: 36,
    zIndex: 1,
  },
  notchTopLeft: { top: -36, left: -24 },
  notchTopRight: { top: -36, right: -24 },
  notchBottom: { bottom: -45, left: "55%", marginLeft: -36 },

  ticketTypeBadge: {
    alignSelf: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  ticketTypeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  childTicketText: {
    color: "#F59E0B",
  },

  eventHeader: {
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 22,
  },
  eventSubtitle: {
    fontSize: 13,
    color: "#0F172A",
    opacity: 0.85,
    textAlign: "center",
    lineHeight: 16,
  },
  eventVenue: {
    fontSize: 12,
    color: "#0F172A",
    opacity: 0.9,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 15,
  },
  venueLink: {
    color: "#071689",
    textDecorationLine: "underline",
    fontWeight: "700",
  },

  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  teamCol: {
    width: "40%",
    alignItems: "center",
    gap: 8,
  },
  teamLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  teamName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    paddingHorizontal: 8,
  },

  dashed: {
    marginTop: 16,
    marginBottom: 18,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#0F172A",
    opacity: 0.6,
    marginHorizontal: 8,
  },

  barcodeSection: {
    alignItems: "center",
    marginBottom: 18,
  },
  barcodeWrap: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "90%",
    alignItems: "center",
  },

  seatSection: {
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  seatLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  seatDetail: {
    fontSize: 12,
    color: "#0F172A",
    opacity: 0.85,
    lineHeight: 15,
    textAlign: "center",
  },

  dotsIndicator: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#071689",
  },

  // Sticky footer
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
  confirmText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
