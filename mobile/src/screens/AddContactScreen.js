import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import api from "../services/api";
import { colors, spacing, radius, typography } from "../theme";

const AddContactScreen = ({ navigation }) => {
  const [mode, setMode] = useState(null); // null | "generate" | "enter"
  const [code, setCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await api.post("/pairing/generate");
      setCode(response.data.code);
      setMode("generate");
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (enteredCode.length !== 6) {
      Alert.alert("Invalid code", "Enter the 6-digit code your contact shared");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/pairing/connect", { code: enteredCode });
      navigation.replace("Chat", {
        otherUser: response.data.partner,
        conversationId: response.data.conversationId,
        locked: false,
        readOnly: false,
      });
    } catch (error) {
      Alert.alert("Couldn't connect", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "generate") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Your code</Text>
          <Text style={styles.subtitle}>Share this with the person you want to add. Expires in 20 minutes.</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
          <TouchableOpacity style={styles.secondaryButtonFull} onPress={() => setMode(null)}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === "enter") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Enter their code</Text>
          <Text style={styles.subtitle}>Ask them for their 6-digit code</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={6}
            value={enteredCode}
            onChangeText={setEnteredCode}
          />
          <TouchableOpacity style={styles.button} onPress={handleConnect} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{loading ? "Connecting..." : "Add contact"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButtonFull} onPress={() => setMode(null)}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add a contact</Text>
        <Text style={styles.subtitle}>Generate a code or enter theirs to start chatting.</Text>
        <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate my code</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButtonFull} onPress={() => setMode("enter")} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Enter their code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  backLink: { position: "absolute", top: spacing.lg, left: spacing.lg },
  backLinkText: { color: colors.accentSoft, fontSize: 15, fontWeight: "600" },
  title: { ...typography.h1, fontSize: 26, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: spacing.lg,
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
  codeText: { color: colors.accent, fontSize: 40, fontWeight: "800", letterSpacing: 10 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButtonFull: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.accentSoft, fontSize: 15, fontWeight: "600" },
});

export default AddContactScreen;