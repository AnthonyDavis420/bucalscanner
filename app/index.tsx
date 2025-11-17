// app/index.tsx
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

const BLUE = "#071689";
const STORAGE_KEY = "bucalscanner.activeEventId";

export default function Index() {
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const isValid = useMemo(() => eventId.trim().length > 0, [eventId]);

  // Load remembered event ID (if any) but stay on this screen
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved.trim()) {
          setEventId(saved.trim()); // Pre-fill the input instead of redirecting
        }
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const handleContinue = useCallback(async () => {
    Keyboard.dismiss();
    if (!isValid || loading) return;
    try {
      setLoading(true);
      const trimmed = eventId.trim();

      // Front-end only: "validate" means non-empty; real validation comes later
      await AsyncStorage.setItem(STORAGE_KEY, trimmed);

      // Navigate into the event scope
      router.push("/views/welcome");
    } catch (e) {
      Alert.alert("Oops", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [eventId, isValid, loading]);

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

            <View style={styles.formBlock}>
              <Text style={styles.label}>Please enter the Event ID:</Text>

              <TextInput
                value={eventId}
                onChangeText={setEventId}
                placeholder="e.g., EVT-2025-OPENING"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
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