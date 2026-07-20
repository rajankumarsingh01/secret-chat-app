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
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme";

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing info", "Enter both username and password");
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
     navigation.replace("ChatList");
    } catch (error) {
      Alert.alert("Couldn't log in", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.brand}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to keep chatting</Text>

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
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? "Logging in..." : "Log in"}</Text>
            </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Signup")} style={styles.linkWrap}>
              <Text style={styles.link}>
                New here? <Text style={styles.linkAccent}>Create an account</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.linkWrap}>
              <Text style={styles.link}>
                Forgot password? <Text style={styles.linkAccent}>Reset it</Text>
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

export default LoginScreen;