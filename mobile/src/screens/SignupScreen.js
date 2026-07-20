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
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../context/AuthContext";
import { connectSocket } from "../services/socket";
import { registerForPushNotifications } from "../services/notifications";
import { colors, spacing, radius, typography } from "../theme";

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleSignup = async () => {
    if (!username || !password) {
      Alert.alert("Missing info", "Enter both username and password");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/auth/signup", { username, password });
      const data = response.data;

      await SecureStore.setItemAsync("token", data.token);
      await SecureStore.setItemAsync("user", JSON.stringify(data));
      setUser(data);
      connectSocket(data.token);
      registerForPushNotifications();

      navigation.replace("RecoveryCode", { code: data.recoveryCode, isNewCode: false });
    } catch (error) {
      Alert.alert("Couldn't sign up", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.brand}>Create account</Text>
          <Text style={styles.subtitle}>Just a username and password — nothing else</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="pick a username"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="at least 6 characters"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? "Creating..." : "Create account"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.linkWrap}>
              <Text style={styles.link}>
                Already have an account? <Text style={styles.linkAccent}>Log in</Text>
              </Text>
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
  link: { color: colors.textMuted, fontSize: 14 },
  linkAccent: { color: colors.accentSoft, fontWeight: "700" },
});

export default SignupScreen;