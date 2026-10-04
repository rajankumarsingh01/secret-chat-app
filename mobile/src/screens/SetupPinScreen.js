// mobile/src/screens/SetupPinScreen.js
//
// Shown ONLY on first-ever app open, before any unlock code exists on this
// device. Real vault apps never ship with a hardcoded default code — the
// user must choose their own before the app can be used at all.
//
// Once a code is saved here, AppNavigator will never route back to this
// screen again (hasCustomUnlockCode() becomes true), so this is a strictly
// one-time setup step.
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, radius, typography } from "../theme";
import { setUnlockCode } from "../services/secretCodes";

const CODE_PATTERN = /^[0-9]{4,10}$/; // digits only, 4–10 long — same keypad the calculator uses

const SetupPinScreen = ({ navigation }) => {
  const [stage, setStage] = useState("create"); // "create" -> "confirm"
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleContinue = () => {
    if (!CODE_PATTERN.test(pin)) {
      setError("PIN 4 se 10 digits ka hona chahiye.");
      return;
    }
    setError("");
    setStage("confirm");
  };

  const handleConfirm = async () => {
    if (confirmPin !== pin) {
      setError("PIN match nahi hua. Dobara try karein.");
      setConfirmPin("");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await setUnlockCode(pin);
      navigation.replace("Calculator");
    } catch (e) {
      setError("Kuch galat ho gaya. Dobara try karein.");
    } finally {
      setSaving(false);
    }
  };

  const handleBackToCreate = () => {
    setStage("create");
    setConfirmPin("");
    setError("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔒</Text>
          </View>

          {stage === "create" ? (
            <>
              <Text style={styles.title}>Apna Secret PIN banayein</Text>
              <Text style={styles.subtitle}>
                Yeh PIN calculator screen par type karke "=" dabane se aapka private chat khulega.
                Ise yaad rakhein — kisi ke saath share na karein.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Naya PIN (4–10 digits)"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={10}
                autoFocus
                value={pin}
                onChangeText={(t) => {
                  setPin(t);
                  setError("");
                }}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleContinue}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>PIN Confirm karein</Text>
              <Text style={styles.subtitle}>Wahi PIN dobara enter karein.</Text>

              <TextInput
                style={styles.input}
                placeholder="PIN dobara likhein"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={10}
                autoFocus
                value={confirmPin}
                onChangeText={(t) => {
                  setConfirmPin(t);
                  setError("");
                }}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleConfirm}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirm & Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkButton} activeOpacity={0.7} onPress={handleBackToCreate}>
                <Text style={styles.linkText}>PIN badalna hai? Wapas jayein</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: { fontSize: 36 },
  title: { ...typography.h1, textAlign: "center", marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, textAlign: "center", marginBottom: spacing.md, fontSize: 13 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkButton: { alignItems: "center", marginTop: spacing.lg },
  linkText: { color: colors.accentSoft, fontWeight: "600" },
});

export default SetupPinScreen;