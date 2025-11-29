import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi, type EventDetails } from "../../lib/api";

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
};

type TicketForm = {
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

type SeatOption = {
  label: string;
  section: string;
  side: string;
  price: number;
  teamId?: string | null;
  teamName?: string | null;
};

export default function CreateTicket() {
  const [backDisabled, setBackDisabled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const parent: any = (global as any).__navParentRef || null;
      parent?.setOptions?.({ tabBarStyle: { display: "none" } });
      return () => parent?.setOptions?.({ tabBarStyle: undefined });
    }, [])
  );

  const [activeIds, setActiveIds] = useState<{ eventId: string; seasonId: string }>({
    eventId: "",
    seasonId: "",
  });

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [options, setOptions] = useState<SeatOption[]>([]);

  const [headerTitle, setHeaderTitle] = useState("Create Ticket");
  const [headerSubtitle, setHeaderSubtitle] = useState("");

  const [imgViewerVisible, setImgViewerVisible] = useState(false);

  // 🔍 Shared values for pinch & pan (map image)
  const mapScale = useSharedValue(1);
  const mapSavedScale = useSharedValue(1);
  const mapTranslateX = useSharedValue(0);
  const mapTranslateY = useSharedValue(0);
  const mapSavedTranslateX = useSharedValue(0);
  const mapSavedTranslateY = useSharedValue(0);

  const mkAdult = (): TicketForm => ({
    fullName: "",
    age: "",
    number: "",
    price: 0,
    isPWD: false,
    isChild: false,
  });
  const mkChild = (): TicketForm => ({
    fullName: "",
    age: "",
    number: "",
    price: 0,
    isPWD: false,
    isChild: true,
  });

  const [adults] = useState(1);
  const [children, setChildren] = useState(0);
  const [tickets, setTickets] = useState<TicketForm[]>([mkAdult()]);
  const [openDropdown, setOpenDropdown] = useState<number | "adults" | "children" | null>(null);
  const [isAdultsView, setIsAdultsView] = useState(true);
  const [childIndex, setChildIndex] = useState(0);

  const [warnVisible, setWarnVisible] = useState(false);
  const [pendingToggleIdx, setPendingToggleIdx] = useState<number | null>(null);
  const [backWarnVisible, setBackWarnVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedEventId, savedSeasonId] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.eventId),
          AsyncStorage.getItem(STORAGE_KEYS.seasonId),
        ]);
        const eventId = (savedEventId || "").trim();
        const seasonId = (savedSeasonId || "").trim();
        setActiveIds({ eventId, seasonId });
        if (!eventId) {
          setLoadingEvent(false);
          return;
        }

        const res = await scannerApi.eventDetails(eventId, seasonId);
        const details = res.item;
        setEvent(details);

        if (!seasonId && details.seasonId) {
          const sid = String(details.seasonId);
          setActiveIds({ eventId, seasonId: sid });
          await AsyncStorage.setItem(STORAGE_KEYS.seasonId, sid);
        }

        setHeaderTitle(details.name || "Create Ticket");
        setHeaderSubtitle(`${details.date || ""} • ${details.venue?.name || ""}`.trim());

        const built: SeatOption[] = (details.seats || []).map((s: any) => {
          const sectionName = s.sectionName ?? s.section ?? "";
          const side =
            s.teamSide ?? s.sideLabel ?? s.teamRef?.teamName ?? s.side ?? "";
          const price =
            typeof s.ticketPrice === "number"
              ? s.ticketPrice
              : typeof s.price === "number"
              ? s.price
              : 0;
          return {
            label: `${sectionName} – ${side}`,
            section: sectionName,
            side,
            price,
            teamId: s.teamRef?.teamId ?? null,
            teamName: s.teamRef?.teamName ?? null,
          };
        });
        setOptions(built);
      } finally {
        setLoadingEvent(false);
      }
    })();
  }, []);

  const maxChildrenForAdults = (a: number) => Math.min(5, Math.max(0, a + 2));

  const rebuildTickets = (adultCount: number, childCount: number) => {
    const a = 1;
    const c = Math.max(0, Math.min(maxChildrenForAdults(a), childCount));
    const existingAdults = tickets.filter((t) => !t.isChild);
    const existingChildren = tickets.filter((t) => t.isChild);
    const adultList: TicketForm[] = [];
    for (let i = 0; i < a; i++) {
      const base = existingAdults[i] ?? mkAdult();
      adultList.push({ ...base, isChild: false, isPWD: base.isPWD ?? false });
    }
    const childList: TicketForm[] = [];
    for (let i = 0; i < c; i++) {
      const base = existingChildren[i] ?? mkChild();
      childList.push({ ...base, isChild: true, price: 0, isPWD: base.isPWD ?? false });
    }
    const next = [...adultList, ...childList];
    setTickets(next);
    setOpenDropdown(null);
    setChildIndex(0);
    if (c === 0) setIsAdultsView(true);
  };

  const setChildrenCount = (val: number) => {
    const cap = maxChildrenForAdults(adults);
    const newChildren = Math.max(0, Math.min(cap, val));
    setChildren(newChildren);
    rebuildTickets(adults, newChildren);
  };

  const updateTicket = (idx: number, patch: Partial<TicketForm>) => {
    setTickets((arr) => arr.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const onChangeAge = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    let val = digits;
    const t = tickets[idx];
    if (t.isChild) {
      if (digits === "") val = "";
      else {
        const n = parseInt(digits, 10);
        if (isNaN(n) || n < 1) val = "";
        else if (n > 12) val = "12";
        else val = String(n);
      }
    } else {
      val = digits.slice(0, 2);
    }
    updateTicket(idx, { age: val });
  };

  const onChangeNumber = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    updateTicket(idx, { number: digits });
  };

  const onPickSection = (idx: number, opt: SeatOption) => {
    const isChild = !!tickets[idx]?.isChild;
    updateTicket(idx, {
      section: opt.section,
      side: opt.side,
      price: isChild ? 0 : opt.price,
      teamId: opt.teamId ?? null,
      teamName: opt.teamName ?? null,
    });
    setOpenDropdown(null);
  };

  const subtotal = useMemo(
    () => tickets.reduce((s, t) => s + (t.price || 0), 0),
    [tickets]
  );

  const adultTickets = tickets.filter((t) => !t.isChild);
  const childTickets = tickets.filter((t) => t.isChild);

  useEffect(() => {
    if (!isAdultsView && childIndex >= childTickets.length && childTickets.length > 0) {
      setChildIndex(0);
    }
  }, [isAdultsView, childIndex, childTickets.length]);

  const current = isAdultsView ? adultTickets[0] : childTickets[childIndex];

  const ticketErrors = (t: TicketForm): string[] => {
    const errs: string[] = [];
    const ageNum = parseInt(t.age || "0", 10);
    if (!t.fullName?.trim()) errs.push("fullName");
    if (!t.age) errs.push("age");
    if (t.isChild) {
      if (!(ageNum >= 1 && ageNum <= 12)) errs.push("childAgeRange");
    } else {
      if (t.age && ageNum > 0 && ageNum <= 12) errs.push("adultAgeRange");
    }
    if (!t.section || !t.side) errs.push("section");
    if (!t.isChild && !t.number) errs.push("number");
    return errs;
  };

  useEffect(() => {
    if (tickets.length === 0) {
      setTickets([mkAdult()]);
      setChildren(0);
    }
  }, [tickets.length]);

  const requestTogglePWD = (idx: number, nextVal: boolean) => {
    if (nextVal) {
      setPendingToggleIdx(idx);
      setWarnVisible(true);
    } else {
      updateTicket(idx, { isPWD: false });
    }
  };

  const confirmTogglePWD = () => {
    if (pendingToggleIdx !== null) {
      updateTicket(pendingToggleIdx, { isPWD: true });
    }
    setWarnVisible(false);
    setPendingToggleIdx(null);
  };

  const cancelTogglePWD = () => {
    setWarnVisible(false);
    setPendingToggleIdx(null);
  };

  const onBackPress = () => {
    if (backDisabled) return;
    if (openDropdown !== null) {
      setOpenDropdown(null);
      return;
    }
    if (warnVisible) {
      setWarnVisible(false);
      setPendingToggleIdx(null);
      return;
    }
    setBackWarnVisible(true);
  };

  const confirmBack = () => {
    setBackWarnVisible(false);
    setBackDisabled(true);
    // keep event in storage so welcome still knows the active event
    router.replace("/views/welcome");
    setTimeout(() => setBackDisabled(false), 450);
  };

  const cancelBack = () => setBackWarnVisible(false);

  const onProceed = () =>
    router.push({
      pathname: "/views/confirmPayment",
      params: {
        tickets: JSON.stringify(tickets),
        subtotal: String(subtotal),
        eventId: activeIds.eventId,
        seasonId: activeIds.seasonId,
      },
    });

  const venueImageUri = useMemo(() => {
    const v: any = event?.venue || null;
    const url =
      v?.imageUrl ||
      v?.image_url ||
      v?.img ||
      (typeof v?.imagePath === "string" && v.imagePath.startsWith("http") ? v.imagePath : null);
    return typeof url === "string" && url.startsWith("http")
      ? url
      : "https://via.placeholder.com/700x300.png?text=Seating+Map";
  }, [event]);

  // 🌀 Gesture definitions for map zoom modal
  const mapPinch = Gesture.Pinch()
    .onStart(() => {
      mapSavedScale.value = mapScale.value;
    })
    .onUpdate((e) => {
      mapScale.value = mapSavedScale.value * e.scale;
    })
    .onEnd(() => {
      if (mapScale.value < 1) {
        mapScale.value = withTiming(1);
        mapTranslateX.value = withTiming(0);
        mapTranslateY.value = withTiming(0);
      } else if (mapScale.value > 4) {
        mapScale.value = withTiming(4);
      }
    });

  const mapPan = Gesture.Pan()
    .onStart(() => {
      mapSavedTranslateX.value = mapTranslateX.value;
      mapSavedTranslateY.value = mapTranslateY.value;
    })
    .onUpdate((e) => {
      mapTranslateX.value = mapSavedTranslateX.value + e.translationX;
      mapTranslateY.value = mapSavedTranslateY.value + e.translationY;
    });

  const mapGesture = Gesture.Simultaneous(mapPinch, mapPan);

  const mapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapTranslateX.value },
      { translateY: mapTranslateY.value },
      { scale: mapScale.value },
    ],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* WRAPPER ADDED HERE */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={onBackPress}
                hitSlop={10}
                disabled={backDisabled}
                style={{ paddingRight: 6, opacity: backDisabled ? 0.6 : 1 }}
              >
                <Ionicons name="arrow-back" size={22} color="#071689" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{headerTitle}</Text>
                {!!headerSubtitle && <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>}
              </View>
              <View style={{ width: 22 }} />
            </View>

            {/* Preview box styled like confirmVoucher */}
            <View style={styles.ticketBox}>
              <Pressable
                style={styles.ticketPressable}
                onPress={() => {
                  // reset zoom + pan when opening viewer
                  mapScale.value = 1;
                  mapTranslateX.value = 0;
                  mapTranslateY.value = 0;
                  setImgViewerVisible(true);
                }}
              >
                <View style={styles.ticketInnerShadow}>
                  <Image
                    source={{ uri: venueImageUri }}
                    style={styles.ticketImage}
                    resizeMode="contain"
                  />
                </View>
              </Pressable>
              <Text style={styles.ticketTapHint}>Tap seating map to zoom</Text>
            </View>

            {/* FIX: Added zIndex: 100 here so this container sits on top of the next card */}
            <View style={[styles.ticketCountCard, { zIndex: 100 }]}>
              <Text style={styles.ticketCountTitle}>Number of Tickets</Text>
              
              {/* FIX: Added zIndex: 100 here so the row is elevated */}
              <View style={[styles.ticketCountRow, { zIndex: 100 }]}>
                <View style={styles.ticketCountItem}>
                  <Text style={styles.ticketCountLabel}>Adults</Text>
                  <View style={[styles.selectBtn, { opacity: 0.6 }]}>
                    <Text style={styles.selectText}>1</Text>
                    <Ionicons name="chevron-down" size={16} color="#222" style={{ opacity: 0 }} />
                  </View>
                </View>

                {/* FIX: Added zIndex: 100 here so this specific item (Children) overlaps others */}
                <View style={[styles.ticketCountItem, { zIndex: 100 }]}>
                  <Text style={styles.ticketCountLabel}>Children</Text>
                  <Pressable
                    style={styles.selectBtn}
                    onPress={() =>
                      setOpenDropdown((prev) => (prev === "children" ? null : "children"))
                    }
                  >
                    <Text style={styles.selectText}>{children}</Text>
                    <Ionicons name="chevron-down" size={16} color="#222" />
                  </Pressable>
                  {openDropdown === "children" && (
                    <View style={styles.dropdownMenu}>
                      {Array.from({ length: maxChildrenForAdults(adults) + 1 }, (_, i) => i).map(
                        (n) => (
                          <Pressable
                            key={n}
                            onPress={() => setChildrenCount(n)}
                            style={[
                              styles.optionItem,
                              children === n && styles.optionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                children === n && styles.optionTextActive,
                              ]}
                            >
                              {n}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.ticketCountItem}>
                  <Text style={styles.ticketCountLabel}>Total</Text>
                  <Text style={styles.ticketCountTotal}>{1 + children}</Text>
                </View>
              </View>
              <Text style={styles.ticketCountNote}>Maximum of 3 child tickets per adult ticket</Text>
            </View>

            {children > 0 && (
              <View style={[styles.typeToggle, { zIndex: 1 }]}>
                <Pressable
                  onPress={() => setIsAdultsView(true)}
                  style={[styles.typeBtn, isAdultsView && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, isAdultsView && styles.typeBtnTextActive]}>
                    Adults
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsAdultsView(false);
                    setChildIndex((idx) => (idx < childTickets.length ? idx : 0));
                  }}
                  style={[styles.typeBtn, !isAdultsView && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, !isAdultsView && styles.typeBtnTextActive]}>
                    Children
                  </Text>
                </Pressable>
              </View>
            )}

            {/* This card is naturally below, so we keep default zIndex (0 or 1) */}
            <View style={[styles.ticketCard, { zIndex: 1 }]}>
              {!current ? (
                <Text>No tickets selected.</Text>
              ) : (
                <>
                  <Text style={styles.ticketTitle}>
                    {current.isChild
                      ? `Child Ticket${
                          childTickets.length > 1
                            ? ` (${childIndex + 1} of ${childTickets.length})`
                            : ""
                        }`
                      : "Adult Ticket"}
                  </Text>

                  <View style={styles.dualRow}>
                    <View style={styles.fullNameContainer}>
                      <Text style={styles.label}>Full Name</Text>
                      <TextInput
                        value={current?.fullName || ""}
                        onChangeText={(v) =>
                          updateTicket(tickets.indexOf(current), { fullName: v })
                        }
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.ageBox}>
                      <Text style={styles.label}>Age{current.isChild ? " (1–12)" : ""}</Text>
                      <TextInput
                        value={current?.age || ""}
                        onChangeText={(v) => onChangeAge(tickets.indexOf(current), v)}
                        style={styles.input}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  {!current.isChild && (
                    <View>
                      <Text style={styles.label}>Number</Text>
                      <TextInput
                        value={current?.number || ""}
                        onChangeText={(v) => onChangeNumber(tickets.indexOf(current), v)}
                        style={styles.input}
                        keyboardType="number-pad"
                      />
                    </View>
                  )}

                  <View style={[styles.sectionFullWidth, { position: "relative", zIndex: 50 }]}>
                    <Text style={styles.label}>Section</Text>
                    <Pressable
                      style={styles.selectBtn}
                      disabled={loadingEvent || options.length === 0}
                      onPress={() =>
                        setOpenDropdown((prev) =>
                          prev === tickets.indexOf(current) ? null : tickets.indexOf(current)
                        )
                      }
                    >
                      <Text style={styles.selectText}>
                        {current?.section && current?.side
                          ? `${current.section} – ${current.side}`
                          : loadingEvent
                          ? "Loading..."
                          : options.length
                          ? "Select section"
                          : "No sections available"}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#222" />
                    </Pressable>

                    {openDropdown === tickets.indexOf(current) && options.length > 0 && (
                      <View style={styles.dropdownMenu}>
                        {options.map((opt, i) => {
                          const active =
                            current?.section === opt.section && current?.side === opt.side;
                          return (
                            <Pressable
                              key={i}
                              onPress={() => onPickSection(tickets.indexOf(current), opt)}
                              style={[styles.optionItem, active && styles.optionActive]}
                            >
                              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                                {opt.label}
                                {!current.isChild ? ` • ₱${opt.price}` : " • ₱0"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {!current.isChild && (
                    <View style={styles.ticketOptions}>
                      <View style={styles.pwdRow}>
                        <Text style={styles.pwdLabel}>PWD/Senior Citizen/Pregnant Woman</Text>
                        <Switch
                          value={!!current.isPWD}
                          onValueChange={(next) => requestTogglePWD(tickets.indexOf(current), next)}
                          thumbColor={current.isPWD ? "#071689" : "#f4f3f4"}
                          trackColor={{ false: "#D1D5DB", true: "#BFD0FF" }}
                        />
                      </View>
                    </View>
                  )}

                  {current.isChild && childTickets.length > 1 && (
                    <View style={styles.childNavRow}>
                      <Pressable
                        onPress={() => setChildIndex((i) => Math.max(0, i - 1))}
                        disabled={childIndex === 0}
                        style={[styles.childNavBtn, childIndex === 0 && { opacity: 0.5 }]}
                      >
                        <Text style={styles.childNavBtnText}>Previous</Text>
                      </Pressable>
                      <Text style={styles.childNavLabel}>
                        {childIndex + 1} / {childTickets.length}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setChildIndex((i) => Math.min(childTickets.length - 1, i + 1))
                        }
                        disabled={childIndex >= childTickets.length - 1}
                        style={[
                          styles.childNavBtn,
                          childIndex >= childTickets.length - 1 && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={styles.childNavBtnText}>Next</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={[styles.subtotalSection, { zIndex: -1 }]}>
              <Text style={styles.subtotalTitle}>Subtotal:</Text>
              {tickets.map((t, i) => (
                <View key={i} style={styles.lineItemRow}>
                  <Text style={styles.lineItemLeft}>
                    1x {t.section ? `${t.section} (${t.side})` : "Unassigned"}{" "}
                    {t.isChild ? "(Child)" : "(Adult)"}
                  </Text>
                  <Text style={styles.lineItemRight}>₱{t.price || 0}</Text>
                </View>
              ))}
              <View style={styles.hr} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₱{subtotal}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={onBackPress} style={styles.backBtn} disabled={backDisabled}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={onProceed}
                disabled={tickets.length === 0 || tickets.some((t) => ticketErrors(t).length > 0)}
                style={[
                  styles.nextBtn,
                  (tickets.length === 0 || tickets.some((t) => ticketErrors(t).length > 0)) && {
                    backgroundColor: "#9CA3AF",
                  },
                ]}
              >
                <Text style={styles.nextBtnText}>Confirm Payment</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={warnVisible} transparent animationType="fade" onRequestClose={cancelTogglePWD}>
        <Pressable style={styles.modalOverlay} onPress={cancelTogglePWD}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Before you proceed</Text>
              <Text style={styles.modalBody}>
                Be prepared to show a valid ID or proof at the venue; non-compliance may lead to
                cancellation of the tickets.
              </Text>
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={cancelTogglePWD}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirm} onPress={confirmTogglePWD}>
                  <Text style={styles.modalConfirmText}>I understand</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <Modal
        visible={imgViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImgViewerVisible(false)}
      >
        <GestureHandlerRootView style={styles.viewerBackdrop}>
          <View style={styles.viewerHeader}>
            <Pressable onPress={() => setImgViewerVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.viewerTitle}>{event?.venue?.name || "Venue Image"}</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.viewerBody}>
            {venueImageUri ? (
              <GestureDetector gesture={mapGesture}>
                <Animated.View collapsable={false} style={styles.viewerImageWrap}>
                  <Animated.Image
                    source={{ uri: venueImageUri }}
                    style={[styles.viewerImage, mapAnimatedStyle]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            ) : null}
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={backWarnVisible} transparent animationType="fade" onRequestClose={cancelBack}>
        <Pressable style={styles.modalOverlay} onPress={cancelBack}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Leave this screen?</Text>
              <Text style={styles.modalBody}>Your current ticket inputs will be discarded.</Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalCancel, { backgroundColor: "#E5E7EB" }]}
                  onPress={cancelBack}
                >
                  <Text style={[styles.modalCancelText, { color: "#111827" }]}>Stay</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalConfirm, { backgroundColor: "#E53935" }]}
                  onPress={confirmBack}
                >
                  <Text style={styles.modalConfirmText}>Leave</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#071689" },
  headerSubtitle: { fontSize: 13, color: "#4B5563" },

  // 🔹 Preview box styled like confirmVoucher ticketBox
  ticketBox: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 18,
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
    backgroundColor: "#E5E7EB",
  },
  ticketTapHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingBottom: 8,
  },

  ticketCountCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#fdfdfdff",
  },
  ticketCountTitle: { fontSize: 16, fontWeight: "800", color: "#071689", marginBottom: 12 },
  ticketCountRow: { flexDirection: "row", gap: 16, alignItems: "flex-end" },
  ticketCountItem: { flex: 1 },
  ticketCountLabel: { fontSize: 13, color: "#374151", marginBottom: 4, fontWeight: "500" },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#D7DBE0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: "#FFFFFF",
  },
  selectText: { fontSize: 14, color: "#222" },
  ticketCountTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#071689",
    textAlign: "center",
    paddingVertical: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    minHeight: 40,
    lineHeight: 24,
  },
  ticketCountNote: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  dropdownMenu: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#D7DBE0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 12,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  optionItem: { paddingVertical: 10, paddingHorizontal: 12 },
  optionActive: { backgroundColor: "#EEF2FF" },
  optionText: { fontSize: 14, color: "#222" },
  optionTextActive: { color: "#071689", fontWeight: "700" },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  typeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  typeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  typeBtnTextActive: { color: "#071689", fontWeight: "700" },
  ticketCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fdfdfdff",
    gap: 12,
  },
  ticketTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  label: { fontSize: 13, color: "#374151", marginBottom: 4, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    minHeight: 40,
  },
  dualRow: { flexDirection: "row", gap: 12 },
  fullNameContainer: { flex: 1 },
  ageBox: { width: 110 },
  sectionFullWidth: { marginTop: 4 },
  ticketOptions: { gap: 8, marginTop: 4 },
  pwdRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pwdLabel: { fontSize: 12, color: "#374151", flex: 1 },
  childNavRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  childNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  childNavBtnText: { color: "#111827", fontWeight: "700" },
  childNavLabel: { color: "#6B7280", fontSize: 12 },
  subtotalSection: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  subtotalTitle: { fontSize: 16, fontWeight: "800", color: "#071689", marginBottom: 8 },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  lineItemLeft: { color: "#111827", fontSize: 14 },
  lineItemRight: { color: "#111827", fontWeight: "700", fontSize: 14 },
  hr: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#071689", fontWeight: "800", fontSize: 16 },
  totalValue: { color: "#071689", fontWeight: "800", fontSize: 16 },
  actionsRow: { marginTop: 20, flexDirection: "row", gap: 16 },
  backBtn: {
    flex: 1,
    backgroundColor: "#9CA3AF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: "#071689",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },
  nextBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: "88%",
    maxWidth: 420,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalBody: { fontSize: 14, color: "#111827" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  modalCancelText: { color: "#111827", fontWeight: "700" },
  modalConfirm: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#071689",
  },
  modalConfirmText: { color: "#fff", fontWeight: "700" },

  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  viewerHeader: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewerTitle: { color: "#fff", fontWeight: "800" },
  viewerBody: { flex: 1, paddingHorizontal: 10, paddingBottom: 18 },
  viewerImageWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%" },
});