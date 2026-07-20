import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors, spacing, radius, typography } from "../theme";

const RecoveryCodeScreen = ({ route, navigation }) => {
  const { code, isNewCode } = route.params;
  const [confirmed, setConfirmed] = useState(false);

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", "Recovery code copied to clipboard");
  };

  const handleContinue = () => {
    if (!confirmed) {
      Alert.alert("Please confirm", "Tap the checkbox to confirm you've saved this code");
      return;
    }
    navigation.replace(isNewCode ? "Login" : "ChatList");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.title}>Save your recovery code</Text>
        <Text style={styles.subtitle}>
          This is the ONLY way to reset your password if you forget it. We cannot show this again
          or recover it for you. Write it down or save it somewhere safe.
        </Text>

        <TouchableOpacity style={styles.codeBox} onPress={copyCode} activeOpacity={0.8}>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.copyHint}>Tap to copy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setConfirmed(!confirmed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>I've saved this code somewhere safe</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !confirmed && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  warningIcon: { fontSize: 40, textAlign: "center", marginBottom: spacing.md },
  title: { ...typography.h1, fontSize: 24, textAlign: "center", marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 24,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  codeText: { color: colors.accent, fontSize: 26, fontWeight: "800", letterSpacing: 2 },
  copyHint: { ...typography.caption, marginTop: spacing.sm },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  checkboxLabel: { ...typography.body, flex: 1 },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default RecoveryCodeScreen;