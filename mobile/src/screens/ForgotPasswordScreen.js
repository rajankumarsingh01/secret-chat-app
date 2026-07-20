import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import api from "../services/api";
import { colors, spacing, radius, typography } from "../theme";

const ForgotPasswordScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!username || !recoveryCode || !newPassword) {
      Alert.alert("Missing info", "Fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        username,
        recoveryCode,
        newPassword,
      });

      navigation.replace("RecoveryCode", {
        code: response.data.newRecoveryCode,
        isNewCode: true,
      });
    } catch (error) {
      Alert.alert("Couldn't reset password", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.brand}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter your username, your saved recovery code, and a new password
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="your username"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Text style={styles.label}>Recovery code</Text>
            <TextInput
              style={styles.input}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              value={recoveryCode}
              onChangeText={setRecoveryCode}
            />
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              placeholder="at least 6 characters"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset password"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkWrap}>
              <Text style={styles.link}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  brand: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  form: { width: "100%" },
  label: { ...typography.caption, marginBottom: spacing.xs, marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkWrap: { marginTop: spacing.lg, alignItems: "center" },
  link: { color: colors.accentSoft, fontSize: 14, fontWeight: "600" },
});

export default ForgotPasswordScreen;