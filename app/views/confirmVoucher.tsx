// app/views/confirmVoucher.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Modal,
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

type Params = {
  code?: string;
  voucherName?: string;
  voucherCode?: string;
  issuer?: string;
  maxPax?: string;
};

function asString(v: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(v)) return (v[0] ?? fallback) as string;
  return (v ?? fallback) as string;
}

function isMethodNotAllowedError(err: any): boolean {
  const msg = String(err?.message || "");
  return msg.includes("HTTP 405");
}

export default function ConfirmVoucher() {
  const params = useLocalSearchParams<Params>();

  const rawCodeParam = asString(params.code);
  const decodedCode = rawCodeParam ? decodeURIComponent(rawCodeParam) : "";

  let parsed: any = null;
  if (decodedCode) {
    try {
      parsed = JSON.parse(decodedCode);
    } catch {}
  }

  const voucherIdFromPayload = asString(
    parsed?.voucherId ?? parsed?.voucher_id,
    ""
  );
  const eventIdFromPayload = asString(parsed?.eventId ?? parsed?.event_id, "");
  const seasonIdFromPayload = asString(
    parsed?.seasonId ?? parsed?.season_id,
    ""
  );

  const payloadName =
    typeof parsed?.voucherName === "string" && parsed.voucherName.trim()
      ? parsed.voucherName.trim()
      : undefined;
  const payloadIssuer =
    typeof parsed?.issuer === "string" && parsed.issuer.trim()
      ? parsed.issuer.trim()
      : undefined;
  const payloadCode =
    typeof parsed?.code === "string" && parsed.code.trim()
      ? parsed.code.trim()
      : undefined;

  const payloadMaxUsesRaw =
    parsed?.maxUses ?? parsed?.max_uses ?? parsed?.maxPax ?? parsed?.max_pax;
  const payloadMaxUses =
    typeof payloadMaxUsesRaw === "number" && payloadMaxUsesRaw > 0
      ? payloadMaxUsesRaw
      : undefined;

  const payloadUsedCountRaw =
    parsed?.usedCount ?? parsed?.used_count ?? parsed?.used ?? parsed?.uses;
  const payloadUsedCount =
    typeof payloadUsedCountRaw === "number" && payloadUsedCountRaw >= 0
      ? payloadUsedCountRaw
      : undefined;

  const payloadTicketUrlRaw =
    parsed?.ticket?.ticketUrl ??
    parsed?.ticket?.ticket_url ??
    parsed?.ticketUrl ??
    parsed?.ticket_url ??
    parsed?.imageUrl ??
    parsed?.image_url;
  const payloadTicketUrl =
    typeof payloadTicketUrlRaw === "string" && payloadTicketUrlRaw.trim()
      ? payloadTicketUrlRaw.trim()
      : undefined;

  const payloadType =
    typeof parsed?.type === "string" && parsed.type.trim()
      ? parsed.type.trim()
      : undefined;

  const payloadSectionNameRaw =
    parsed?.sectionName ?? parsed?.section_name ?? parsed?.section;
  const payloadSectionName =
    typeof payloadSectionNameRaw === "string" &&
    payloadSectionNameRaw.trim()
      ? payloadSectionNameRaw.trim()
      : undefined;

  const payloadTeamSideRaw =
    parsed?.teamSide ??
    parsed?.team_side ??
    parsed?.sideLabel ??
    parsed?.side_label;
  const payloadTeamSide =
    typeof payloadTeamSideRaw === "string" && payloadTeamSideRaw.trim()
      ? payloadTeamSideRaw.trim()
      : undefined;

  const payloadValidUntilRaw =
    parsed?.validUntil ?? parsed?.valid_until ?? undefined;
  const payloadValidUntil =
    typeof payloadValidUntilRaw === "string" &&
    payloadValidUntilRaw.trim()
      ? payloadValidUntilRaw.trim()
      : undefined;

  const payloadNotesRaw =
    parsed?.notes ?? parsed?.remark ?? parsed?.remarks ?? undefined;
  const payloadNotes =
    typeof payloadNotesRaw === "string" && payloadNotesRaw.trim()
      ? payloadNotesRaw.trim()
      : undefined;

  const [voucherName, setVoucherName] = useState<string>(() => {
    const fromParam = asString(params.voucherName);
    return payloadName || fromParam || "VIP Group Access";
  });

  const [voucherCode, setVoucherCode] = useState<string>(() => {
    const fromParam = asString(params.voucherCode);
    return payloadCode || fromParam || "VOU-992-AA";
  });

  const [issuer, setIssuer] = useState<string>(() => {
    const fromParam = asString(params.issuer);
    return payloadIssuer || fromParam || "ADNU Athletics";
  });

  const [eventId, setEventId] = useState<string>(() => eventIdFromPayload);
  const [seasonId, setSeasonId] = useState<string>(() => seasonIdFromPayload);
  const [voucherId, setVoucherId] = useState<string>(() => voucherIdFromPayload);

  const [maxUses, setMaxUses] = useState<number>(() => {
    const fromParamStr = asString(params.maxPax);
    const fromParam = parseInt(fromParamStr || "", 10);
    if (!Number.isNaN(fromParam) && fromParam > 0) return fromParam;
    if (payloadMaxUses) return payloadMaxUses;
    return 10;
  });

  const [usedCount, setUsedCount] = useState<number>(() => {
    if (typeof payloadUsedCount === "number") return payloadUsedCount;
    return 0;
  });

  const [ticketUrl, setTicketUrl] = useState<string | null>(
    () => payloadTicketUrl || null
  );
  const [orgType, setOrgType] = useState<string | null>(
    () => payloadType || null
  );
  const [sectionName, setSectionName] = useState<string | null>(
    () => payloadSectionName || null
  );
  const [teamSide, setTeamSide] = useState<string | null>(
    () => payloadTeamSide || null
  );
  const [validUntil, setValidUntil] = useState<string | null>(
    () => payloadValidUntil || null
  );
  const [notes, setNotes] = useState<string | null>(
    () => payloadNotes || null
  );

  const [isRedeemed, setIsRedeemed] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  const remaining = useMemo(
    () => Math.max(0, maxUses - usedCount),
    [maxUses, usedCount]
  );

  const maxSelectable = remaining > 0 ? remaining : 0;

  const [count, setCount] = useState<number>(() =>
    maxSelectable > 0 ? 1 : 0
  );

  // ✅ True when the voucher is fully consumed
  const fullyRedeemed =
    maxUses > 0 && remaining === 0;

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

  useEffect(() => {
    if (isRedeemed) return;

    setCount((prev) => {
      if (maxSelectable <= 0) return 0;
      if (prev < 1) return 1;
      if (prev > maxSelectable) return maxSelectable;
      return prev;
    });
  }, [maxSelectable, isRedeemed]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!eventId && eventIdFromPayload) setEventId(eventIdFromPayload);
      if (!seasonId && seasonIdFromPayload) setSeasonId(seasonIdFromPayload);
      if (!voucherId && voucherIdFromPayload) setVoucherId(voucherIdFromPayload);

      if (!eventIdFromPayload || !seasonIdFromPayload || !voucherIdFromPayload) {
        return;
      }

      try {
        const resp = await scannerApi.fetchVoucher(
          eventIdFromPayload,
          seasonIdFromPayload,
          voucherIdFromPayload
        );
        if (cancelled) return;

        const v = (resp.item ?? {}) as any;

        const vAssignedName =
          (v.assignedName && String(v.assignedName).trim()) ||
          (v.assigned_name && String(v.assigned_name).trim()) ||
          (v.assignedTo?.name && String(v.assignedTo.name).trim()) ||
          "";

        const vName =
          (v.name && String(v.name).trim()) ||
          vAssignedName ||
          payloadName ||
          asString(params.voucherName);

        const vCode =
          (v.code && String(v.code).trim()) ||
          payloadCode ||
          asString(params.voucherCode);
        const vIssuer =
          (v.issuer && String(v.issuer).trim()) ||
          payloadIssuer ||
          asString(params.issuer);

        const vMaxRaw =
          v.maxUses ?? v.max_uses ?? v.maxPax ?? v.max_pax ?? payloadMaxUses;
        const vMax =
          typeof vMaxRaw === "number" && vMaxRaw > 0 ? vMaxRaw : maxUses;

        const vUsedRaw =
          v.usedCount ??
          v.used_count ??
          v.used ??
          v.uses ??
          payloadUsedCount ??
          usedCount;
        const vUsed =
          typeof vUsedRaw === "number" && vUsedRaw >= 0 ? vUsedRaw : usedCount;

        const vTicketUrlRaw =
          v?.ticket?.ticketUrl ??
          v?.ticket?.ticket_url ??
          v?.ticketUrl ??
          v?.ticket_url ??
          v?.imageUrl ??
          v?.image_url ??
          payloadTicketUrl;
        const vTicketUrl =
          typeof vTicketUrlRaw === "string" && vTicketUrlRaw.trim()
            ? vTicketUrlRaw.trim()
            : null;

        const vTypeRaw =
          v?.assignedType ??
          v?.assigned_type ??
          v?.assignedTo?.type ??
          payloadType;
        const vType =
          typeof vTypeRaw === "string" && vTypeRaw.trim()
            ? vTypeRaw.trim()
            : null;

        const vSectionRaw =
          v?.sectionName ??
          v?.section_name ??
          v?.section ??
          payloadSectionName;
        const vSection =
          typeof vSectionRaw === "string" && vSectionRaw.trim()
            ? vSectionRaw.trim()
            : null;

        const vSideRaw =
          v?.teamSide ??
          v?.team_side ??
          v?.sideLabel ??
          v?.side_label ??
          payloadTeamSide;
        const vSide =
          typeof vSideRaw === "string" && vSideRaw.trim()
            ? vSideRaw.trim()
            : null;

        const vValidRaw =
          v?.validUntil ?? v?.valid_until ?? payloadValidUntil;
        const vValid =
          typeof vValidRaw === "string" && vValidRaw.trim()
            ? vValidRaw.trim()
            : null;

        const vNotesRaw =
          v?.notes ?? v?.remark ?? v?.remarks ?? payloadNotes;
        const vNotes =
          typeof vNotesRaw === "string" && vNotesRaw.trim()
            ? vNotesRaw.trim()
            : null;

        setVoucherName(vName || vAssignedName || "VIP Group Access");
        setVoucherCode(vCode || voucherCode);
        setIssuer(vIssuer || "ADNU Athletics");
        setMaxUses(vMax);
        setUsedCount(vUsed);

        if (vTicketUrl) setTicketUrl(vTicketUrl);
        if (vType) setOrgType(vType);
        if (vSection) setSectionName(vSection);
        if (vSide) setTeamSide(vSide);
        if (vValid) setValidUntil(vValid);
        if (vNotes) setNotes(vNotes);
      } catch (err) {
        console.log("FETCH VOUCHER DETAILS ERROR:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    eventIdFromPayload,
    seasonIdFromPayload,
    voucherIdFromPayload,
    payloadName,
    payloadCode,
    payloadIssuer,
    payloadMaxUses,
    payloadUsedCount,
    payloadTicketUrl,
    payloadType,
    payloadSectionName,
    payloadTeamSide,
    payloadValidUntil,
    payloadNotes,
  ]);

  const decrement = () => {
    if (count > 1) setCount((c) => c - 1);
  };

  const increment = () => {
    if (maxSelectable <= 0) return;
    setCount((c) => {
      if (c >= maxSelectable) return c;
      return c + 1;
    });
  };

  const handleConfirm = async () => {
    if (submitBusy) return;
    if (isRedeemed) return;
    if (count <= 0) {
      Alert.alert("No Pax Selected", "Please select at least 1 person to admit.", [
        { text: "OK" },
      ]);
      return;
    }

    const eId = eventId || eventIdFromPayload;
    const sId = seasonId || seasonIdFromPayload;
    const vId = voucherId || voucherIdFromPayload;

    try {
      setSubmitBusy(true);

      if (eId && sId && vId) {
        try {
          const resp = await scannerApi.useVoucher(eId, sId, vId, count);
          const updated = (resp.item ?? {}) as any;

          const newUsedRaw =
            updated.usedCount ??
            updated.used_count ??
            updated.used ??
            updated.uses;
          const newMaxRaw =
            updated.maxUses ??
            updated.max_uses ??
            updated.maxPax ??
            updated.max_pax;

          if (typeof newUsedRaw === "number") {
            setUsedCount(newUsedRaw);
          } else {
            setUsedCount((prev) => prev + count);
          }

          if (typeof newMaxRaw === "number" && newMaxRaw > 0) {
            setMaxUses(newMaxRaw);
          }

          const uValidRaw =
            updated.validUntil ?? updated.valid_until ?? validUntil;
          if (typeof uValidRaw === "string" && uValidRaw.trim()) {
            setValidUntil(uValidRaw.trim());
          }

          const uNotesRaw =
            updated.notes ??
            updated.remark ??
            updated.remarks ??
            notes;
          if (typeof uNotesRaw === "string" && uNotesRaw.trim()) {
            setNotes(uNotesRaw.trim());
          }
        } catch (err: any) {
          console.log("USE VOUCHER ERROR:", err);
          if (isMethodNotAllowedError(err)) {
            setUsedCount((prev) => prev + count);
          } else {
            Alert.alert(
              "Error",
              err?.message || "Failed to record voucher usage. Please try again."
            );
            setSubmitBusy(false);
            return;
          }
        }
      } else {
        setUsedCount((prev) => prev + count);
      }

      setIsRedeemed(true);
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // 🔁 Scan Next: just pop back to the existing scanner (no new screen)
  const handleScanNext = () => {
    router.back();
  };

  const remainingText =
    maxUses > 0
      ? `${remaining} remaining from ${maxUses} pax`
      : "Unlimited pax";

  const displayName = voucherName || issuer || "";
  const displayType =
    orgType || (payloadMaxUses ? "Group Voucher" : "Voucher");
  const displayTicketId = voucherId || voucherCode || "";
  const displaySectionSide = [sectionName, teamSide]
    .filter(Boolean)
    .join(" – ");

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
        <Text
          style={[
            styles.title,
            { color: isRedeemed ? "#071689" : "#2E7D32" },
          ]}
        >
          {isRedeemed ? "Redemption Complete" : "Voucher Valid!"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ticketBox}>
          {ticketUrl ? (
            <>
              <Pressable
                onPress={() => {
                  scale.value = 1;
                  translateX.value = 0;
                  translateY.value = 0;
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
          {displayName ? (
            <Text style={styles.voucherName}>{displayName}</Text>
          ) : null}

          <View style={styles.metaBlock}>
            {displayType ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Type: </Text>
                <Text style={styles.metaValue}>{displayType}</Text>
              </Text>
            ) : null}

            {displayTicketId ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Ticket ID: </Text>
                <Text style={[styles.metaValue, styles.mono]}>
                  {displayTicketId}
                </Text>
              </Text>
            ) : null}

            {displaySectionSide ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Section / Side: </Text>
                <Text style={styles.metaValue}>{displaySectionSide}</Text>
              </Text>
            ) : null}

            {validUntil ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Valid Until: </Text>
                <Text style={styles.metaValue}>{validUntil}</Text>
              </Text>
            ) : null}

            {issuer ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Issued By: </Text>
                <Text style={styles.metaValue}>{issuer}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        {!isRedeemed ? (
          <View style={styles.counterContainer}>
            <Text style={styles.label}>Select Pax Entry</Text>

            <View style={styles.counterRow}>
              <Pressable
                onPress={decrement}
                style={({ pressed }) => [
                  styles.counterBtn,
                  count <= 1 && styles.disabledBtn,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={count <= 1}
              >
                <Ionicons name="remove" size={28} color="#fff" />
              </Pressable>

              <View style={styles.countDisplay}>
                <Text style={styles.countText}>{count}</Text>
                <Text style={styles.countLabel}>People</Text>
              </View>

              <Pressable
                onPress={increment}
                style={({ pressed }) => [
                  styles.counterBtn,
                  (count >= maxSelectable || maxSelectable === 0) &&
                    styles.disabledBtn,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={count >= maxSelectable || maxSelectable === 0}
              >
                <Ionicons name="add" size={28} color="#fff" />
              </Pressable>
            </View>

            <Text style={styles.limitText}>{remainingText}</Text>
          </View>
        ) : (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={48} color="#2E7D32" />
            {/* When fully redeemed, show special message instead of "0 pax" */}
            <Text style={styles.successTitle}>
              {fullyRedeemed
                ? "This voucher has been fully redeemed."
                : `${count} Pax Admitted`}
            </Text>
            <Text style={styles.successSub}>
              {fullyRedeemed
                ? "No more entries can be admitted with this voucher."
                : "Recorded successfully"}
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {!isRedeemed ? (
          <Pressable
            onPress={handleConfirm}
            style={[
              styles.cta,
              (count <= 0 || maxSelectable === 0 || submitBusy) && {
                opacity: 0.6,
              },
            ]}
            disabled={count <= 0 || maxSelectable === 0 || submitBusy}
          >
            <Text style={styles.ctaText}>
              {submitBusy ? "Saving..." : `Confirm & Admit ${count}`}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleScanNext} style={styles.cta}>
            <Text style={styles.ctaText}>Scan Next</Text>
          </Pressable>
        )}
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
    backgroundColor: "#fff",
    zIndex: 10,
  },
  iconBtn: { padding: 6, borderRadius: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, alignItems: "center" },

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

  card: { alignItems: "flex-start", width: "100%" },
  voucherName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "left",
  },
  metaBlock: {
    marginTop: 8,
    width: "100%",
  },
  metaLine: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 2,
  },
  metaLabel: {
    fontWeight: "600",
  },
  metaValue: {
    fontWeight: "400",
  },
  mono: {
    fontFamily: "monospace",
  },

  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    width: "100%",
    marginVertical: 24,
  },

  notesBox: {
    marginTop: 16,
    width: "100%",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: "#4B5563",
  },

  counterContainer: { alignItems: "center", width: "100%" },
  label: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    fontWeight: "500",
  },

  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 280,
  },
  counterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#071689",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  disabledBtn: { backgroundColor: "#CCC", elevation: 0 },

  countDisplay: { alignItems: "center", width: 100 },
  countText: { fontSize: 48, fontWeight: "800", color: "#111" },
  countLabel: { fontSize: 14, color: "#666", fontWeight: "600" },

  limitText: { marginTop: 16, color: "#999", fontSize: 12 },

  successBox: { alignItems: "center", marginTop: 10 },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 12,
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#071689",
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
