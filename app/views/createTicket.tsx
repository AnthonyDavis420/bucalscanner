// app/views/createTicket.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TicketForm = {
  fullName: string;
  age: string;
  number: string;
  section?: string;
  side?: "A" | "B";
  price: number;
  isPWD: boolean;
  isChild: boolean;
};

const OPTIONS = [
  { label: "Courtside – Team A", section: "Courtside", side: "A", price: 100 },
  { label: "Courtside – Team B", section: "Courtside", side: "B", price: 100 },
  { label: "Bleachers – Team A", section: "Bleachers", side: "A", price: 40 },
  { label: "Bleachers – Team B", section: "Bleachers", side: "B", price: 40 },
];

export default function CreateTicket() {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const tabsNamed = navigation.getParent?.("mainViews");
      if (tabsNamed && tabsNamed.setOptions) {
        tabsNamed.setOptions({ tabBarStyle: { display: "none" } });
        return () => tabsNamed.setOptions({ tabBarStyle: undefined });
      }
      const parent = navigation.getParent?.();
      const maybeTabs = (parent as any)?.getParent?.() ?? parent;
      (maybeTabs as any)?.setOptions?.({ tabBarStyle: { display: "none" } });
      return () => (maybeTabs as any)?.setOptions?.({ tabBarStyle: undefined });
    }, [navigation])
  );

  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    subtitle?: string;
    dateTime?: string;
    venue?: string;
  }>();

  const id = params.id || "ev1";
  const title = params.title || "NCF vs ADNU Game 2";
  const subtitle = params.subtitle || "Basketball Senior Division Semi-finals";
  const dateTime = params.dateTime || "5PM, July 28, 2025";
  const venue = params.venue || "Ateneo de Naga University Gymnasium";

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const maxChildrenForAdults = (a: number) => Math.min(5, Math.max(0, a + 2));

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

  const [tickets, setTickets] = useState<TicketForm[]>([mkAdult()]);
  const [openDropdown, setOpenDropdown] = useState<number | "adults" | "children" | null>(null);
  const [isAdultsView, setIsAdultsView] = useState(true);

  // PWD warning modal
  const [warnVisible, setWarnVisible] = useState(false);
  const [pendingToggleIdx, setPendingToggleIdx] = useState<number | null>(null);

  // Back confirm modal
  const [backWarnVisible, setBackWarnVisible] = useState(false);
  const [backDisabled, setBackDisabled] = useState(false);

  const rebuildTickets = (adultCount: number, childCount: number) => {
    const a = Math.max(1, Math.min(3, adultCount));
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
      childList.push({ ...base, isChild: true, isPWD: base.isPWD ?? false });
    }

    const next = [...adultList, ...childList];
    setTickets(next);
    setOpenDropdown(null);

    if (c === 0) setIsAdultsView(true);
  };

  const setAdultsCount = (val: number) => {
    const newAdults = Math.max(1, Math.min(3, val));
    const childCap = maxChildrenForAdults(newAdults);
    const newChildren = Math.min(children, childCap);
    setAdults(newAdults);
    setChildren(newChildren);
    rebuildTickets(newAdults, newChildren);
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

  const onPickSection = (idx: number, opt: typeof OPTIONS[number]) => {
    updateTicket(idx, { section: opt.section, side: opt.side, price: opt.price });
    setOpenDropdown(null);
  };

  const subtotal = useMemo(
    () => tickets.reduce((s, t) => s + (t.price || 0), 0),
    [tickets]
  );

  // Back button flow:
  // 1) Close dropdown if open
  // 2) Close PWD modal if open
  // 3) Show back warning modal
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
    const canGo = (navigation as any)?.canGoBack?.() ?? false;
    if (canGo) {
      (navigation as any).goBack();
    } else {
      router.replace("/");
    }
    setTimeout(() => setBackDisabled(false), 450);
  };

  const cancelBack = () => setBackWarnVisible(false);

  const onProceed = () =>
    router.push({
      pathname: "/views/confirmPayment",
      params: { tickets: JSON.stringify(tickets), subtotal: String(subtotal) },
    });

  const adultTickets = tickets.filter((t) => !t.isChild);
  const childTickets = tickets.filter((t) => t.isChild);
  const currentList = isAdultsView ? adultTickets : childTickets;
  const current = currentList[0];

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

  const anyInvalid = useMemo(
    () => tickets.some((t) => ticketErrors(t).length > 0),
    [tickets]
  );

  useEffect(() => {
    if (tickets.length === 0) {
      setTickets([mkAdult()]);
      setAdults(1);
      setChildren(0);
    }
  }, [tickets.length]);

  const childChoices = Array.from(
    { length: maxChildrenForAdults(adults) + 1 },
    (_, i) => i
  );

  // PWD confirm modal flow
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
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
              <Text style={styles.headerTitle}>Create Ticket</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
            <View style={{ width: 22 }} />
          </View>

          {/* Seating Map Card */}
          <View style={styles.card}>
            <Image
              source={{ uri: "https://via.placeholder.com/700x300.png?text=Seating+Map" }}
              style={styles.mapImage}
            />
          </View>

          {/* Ticket Count Selection */}
          <View style={styles.ticketCountCard}>
            <Text style={styles.ticketCountTitle}>Number of Tickets</Text>
            <View style={styles.ticketCountRow}>
              {/* Adults dropdown */}
              <View style={styles.ticketCountItem}>
                <Text style={styles.ticketCountLabel}>Adults</Text>
                <Pressable
                  style={styles.selectBtn}
                  onPress={() =>
                    setOpenDropdown((prev) => (prev === "adults" ? null : "adults"))
                  }
                >
                  <Text style={styles.selectText}>{adults}</Text>
                  <Ionicons name="chevron-down" size={16} color="#222" />
                </Pressable>
                {openDropdown === "adults" && (
                  <View style={styles.dropdownMenu}>
                    {[1, 2, 3].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setAdultsCount(n)}
                        style={[
                          styles.optionItem,
                          adults === n && styles.optionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            adults === n && styles.optionTextActive,
                          ]}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Children dropdown */}
              <View style={styles.ticketCountItem}>
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
                    {childChoices.map((n) => (
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
                    ))}
                  </View>
                )}
              </View>

              {/* Total */}
              <View style={styles.ticketCountItem}>
                <Text style={styles.ticketCountLabel}>Total</Text>
                <Text style={styles.ticketCountTotal}>{adults + children}</Text>
              </View>
            </View>
            <Text style={styles.ticketCountNote}>Maximum of 3 adult tickets per purchase</Text>
          </View>

          {/* Adults / Children toggle */}
          {children > 0 && (
            <View style={styles.typeToggle}>
              <Pressable
                onPress={() => setIsAdultsView(true)}
                style={[styles.typeBtn, isAdultsView && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, isAdultsView && styles.typeBtnTextActive]}>
                  Adults
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsAdultsView(false)}
                style={[styles.typeBtn, !isAdultsView && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, !isAdultsView && styles.typeBtnTextActive]}>
                  Children
                </Text>
              </Pressable>
            </View>
          )}

          {/* Single Ticket Card */}
          <View style={styles.ticketCard}>
            {current ? (
              <>
                <Text style={styles.ticketTitle}>
                  {current.isChild ? "Child Ticket" : "Adult Ticket"}
                </Text>

                {/* Full Name + Age */}
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
                    <Text style={styles.label}>Age</Text>
                    <TextInput
                      value={current?.age || ""}
                      onChangeText={(v) => onChangeAge(tickets.indexOf(current), v)}
                      style={styles.input}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {/* Number (adults only) */}
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

                {/* Section */}
                <View style={[styles.sectionFullWidth, { position: "relative" }]}>
                  <Text style={styles.label}>Section</Text>
                  <Pressable
                    style={styles.selectBtn}
                    onPress={() =>
                      setOpenDropdown((prev) =>
                        prev === tickets.indexOf(current) ? null : tickets.indexOf(current)
                      )
                    }
                  >
                    <Text style={styles.selectText}>
                      {current?.section && current?.side
                        ? `${current.section} – Team ${current.side}`
                        : "Select section"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#222" />
                  </Pressable>

                  {openDropdown === tickets.indexOf(current) && (
                    <View style={styles.dropdownMenu}>
                      {OPTIONS.map((opt, i) => {
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
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* PWD toggle */}
                <View style={styles.ticketOptions}>
                  <View style={styles.pwdRow}>
                    <Text style={styles.pwdLabel}>
                      {current.isChild ? "PWD" : "PWD/Senior Citizen/Pregnant Woman"}
                    </Text>
                    <Switch
                      value={!!current.isPWD}
                      onValueChange={(next) =>
                        requestTogglePWD(tickets.indexOf(current), next)
                      }
                      thumbColor={current.isPWD ? "#071689" : "#f4f3f4"}
                      trackColor={{ false: "#D1D5DB", true: "#BFD0FF" }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Text>No tickets selected.</Text>
            )}
          </View>

          {/* Subtotal */}
          <View style={styles.subtotalSection}>
            <Text style={styles.subtotalTitle}>Subtotal:</Text>
            {tickets.map((t, i) => (
              <View key={i} style={styles.lineItemRow}>
                <Text style={styles.lineItemLeft}>
                  1x {t.section ? `${t.section} (Team ${t.side})` : "Unassigned"} {t.isChild ? "(Child)" : ""}
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

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable onPress={onBackPress} style={styles.backBtn} disabled={backDisabled}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              onPress={onProceed}
              disabled={tickets.length === 0 || anyInvalid}
              style={[
                styles.nextBtn,
                (tickets.length === 0 || anyInvalid) && { backgroundColor: "#9CA3AF" },
              ]}
            >
              <Text style={styles.nextBtnText}>Confirm Payment</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* PWD Warning Modal */}
      <Modal
        visible={warnVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelTogglePWD}
      >
        <Pressable style={styles.modalOverlay} onPress={cancelTogglePWD}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Before you proceed</Text>
              <Text style={styles.modalBody}>
                Be prepared to show a valid ID or proof at the venue, non-compliance may lead to cancellation of the tickets.
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

      {/* Back Confirm Modal */}
      <Modal
        visible={backWarnVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelBack}
      >
        <Pressable style={styles.modalOverlay} onPress={cancelBack}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Leave this screen?</Text>
              <Text style={styles.modalBody}>
                Your current ticket inputs will be discarded.
              </Text>
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

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 12,
  },
  mapImage: { width: "100%", height: 180, borderRadius: 8, backgroundColor: "#E5E7EB" },

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

  // Adults / Children toggle
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
  typeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  typeBtnTextActive: {
    color: "#071689",
    fontWeight: "700",
  },

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

  subtotalSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
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

  // Shared modal styles
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
});
