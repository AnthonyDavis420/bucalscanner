import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scannerApi } from "../lib/api";

const STORAGE_KEYS = {
  eventId: "bucalscanner.activeEventId",
  seasonId: "bucalscanner.activeSeasonId",
  eventName: "bucalscanner.activeEventName",
  seasonName: "bucalscanner.activeSeasonName",
};

const BLUE = "#071689";

export default function Index() {
  const [eventId, setEventId] = useState("");
  const [savedSeasonName, setSavedSeasonName] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const isValid = useMemo(() => eventId.trim().length > 0, [eventId]);

  // Initialize State & Fetch Active Season Context
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Load local data first
        const [savedId, savedName] = await AsyncStorage.multiGet([
          STORAGE_KEYS.eventId,
          STORAGE_KEYS.seasonName,
        ]);

        if (!cancelled) {
          if (savedName?.[1]) setSavedSeasonName(savedName[1].trim());

          if (savedId?.[1]) {
            const val = savedId[1];
            try {
              const parsed = JSON.parse(val);
              if (parsed?.eventCode || parsed?.eventId) {
                setEventId((parsed.eventCode || parsed.eventId || "").trim());
              } else {
                setEventId(val.trim());
              }
            } catch {
              setEventId(val.trim());
            }
          }
        }

        // 2. Fetch Global Active Season from API (Fallback/Update)
        try {
          const res = await scannerApi.fetchActiveSeason();
          if (!cancelled && res.season?.title) {
            setSavedSeasonName(res.season.title);
            // Optional: update storage so it's there next time immediately
            await AsyncStorage.setItem(STORAGE_KEYS.seasonName, res.season.title);
          }
        } catch (err) {
          // Ignore API errors, keep using local or empty
        }

      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleContinue = useCallback(async () => {
    Keyboard.dismiss();
    if (!isValid || loading) return;

    try {
      setLoading(true);
      const trimmed = eventId.trim();

      const res = await scannerApi.resolveEvent(trimmed);
      const { seasonId, eventId: resolvedEventId, name, seasonName } = res.item;
      
      // Prefer the season name from the specific event resolution, otherwise fall back to global active
      const finalSeasonName = seasonName || savedSeasonName || "";

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.eventId, resolvedEventId],
        [STORAGE_KEYS.seasonId, seasonId],
        [STORAGE_KEYS.eventName, name ?? ""],
        [STORAGE_KEYS.seasonName, finalSeasonName],
      ]);

      router.push("/views/welcome");
    } catch (e: any) {
      Alert.alert("Invalid Event", e?.message || "Event not found");
    } finally {
      setLoading(false);
    }
  }, [eventId, isValid, loading, savedSeasonName]);

  if (restoring) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.headerBlock}>
              <Text style={styles.welcome}>Welcome to</Text>
              <Text style={styles.brand}>BucalScanner!</Text>
            </View>

            <Image
              source={require("../assets/bucal-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            {savedSeasonName ? (
              <Text style={styles.seasonName}>{savedSeasonName}</Text>
            ) : null}

            <View style={styles.formBlock}>
              <Text style={styles.label}>Please enter the Event ID:</Text>

              <TextInput
                value={eventId}
                onChangeText={setEventId}
                placeholder="e.g., YDPUEX"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                autoFocus={!eventId} 
              />

              <Pressable
                onPress={handleContinue}
                disabled={!isValid || loading}
                style={({ pressed }) => [
                  styles.button,
                  (!isValid || loading) && styles.buttonDisabled,
                  pressed && isValid && !loading && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Enter</Text>
                )}
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerBlock: {
    alignItems: "center",
  },
  seasonName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 22,
    fontWeight: "700",
    color: BLUE,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: BLUE,
    marginTop: 4,
  },
  logo: {
    width: 160,
    height: 160,
    marginVertical: 32,
  },
  formBlock: {
    width: "100%",
    marginTop: 8,
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    textAlign: "left",
  },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  button: {
    height: 46,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    backgroundColor: "#9AA5C4",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});