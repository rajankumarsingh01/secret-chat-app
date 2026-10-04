// mobile/src/screens/SettingsScreen.js
//
// Dedicated settings section — this is where the user manages their
// calculator unlock PIN, the optional panic-wipe code, and the optional
// decoy code. Reached from Profile > Settings.
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  hasCustomUnlockCode,
  setUnlockCode,
  hasPanicCode,
  setPanicCode,
  clearPanicCode,
  hasDecoyCode,
  setDecoyCode,
  clearDecoyCode,
  collidesWithOtherCodes,
} from "../services/secretCodes";
import { colors, spacing, radius, typography } from "../theme";

const CODE_PATTERN = /^[0-9]{4,10}$/; // digits only, 4–10 long — matches what the calculator keypad can type

const SettingsScreen = ({ navigation }) => {
  const [customUnlockSet, setCustomUnlockSet] = useState(false);
  const [panicSet, setPanicSet] = useState(false);
  const [decoySet, setDecoySet] = useState(false);

  const [unlockCode, setUnlockCodeInput] = useState("");
  const [unlockConfirm, setUnlockConfirm] = useState("");
  const [savingUnlock, setSavingUnlock] = useState(false);

  const [panicCode, setPanicCodeInput] = useState("");
  const [panicConfirm, setPanicConfirm] = useState("");
  const [savingPanic, setSavingPanic] = useState(false);

  const [decoyCode, setDecoyCodeInput] = useState("");
  const [decoyConfirm, setDecoyConfirm] = useState("");
  const [savingDecoy, setSavingDecoy] = useState(false);

  useEffect(() => {
    (async () => {
      setCustomUnlockSet(await hasCustomUnlockCode());
      setPanicSet(await hasPanicCode());
      setDecoySet(await hasDecoyCode());
    })();
  }, []);

  const handleSaveUnlockCode = async () => {
    if (!CODE_PATTERN.test(unlockCode)) {
      Alert.alert("Invalid code", "Use 4–10 digits only.");
      return;
    }
    if (unlockCode !== unlockConfirm) {
      Alert.alert("Doesn't match", "Both entries must be the same.");
      return;
    }
    if (await collidesWithOtherCodes(unlockCode, "unlock")) {
      Alert.alert("Code already in use", "This matches your panic or decoy code. Pick a different one.");
      return;
    }
    setSavingUnlock(true);
    try {
      await setUnlockCode(unlockCode);
      setCustomUnlockSet(true);
      setUnlockCodeInput("");
      setUnlockConfirm("");
      Alert.alert("Saved", "Unlock PIN updated. It's stored only on this device.");
    } catch (error) {
      Alert.alert("Failed", error.message);
    } finally {
      setSavingUnlock(false);
    }
  };

  const handleSavePanicCode = async () => {
    if (!CODE_PATTERN.test(panicCode)) {
      Alert.alert("Invalid code", "Use 4–10 digits only.");
      return;
    }
    if (panicCode !== panicConfirm) {
      Alert.alert("Doesn't match", "Both entries must be the same.");
      return;
    }
    if (await collidesWithOtherCodes(panicCode, "panic")) {
      Alert.alert("Code already in use", "This matches your unlock or decoy code. Pick a different one.");
      return;
    }
    setSavingPanic(true);
    try {
      await setPanicCode(panicCode);
      setPanicSet(true);
      setPanicCodeInput("");
      setPanicConfirm("");
      Alert.alert(
        "Saved",
        "Panic wipe code set. Typing it on the calculator + \"=\" will instantly and silently delete this device's session, keys, and codes — with no warning shown. Make sure you'll remember it, and that it's different from your unlock code."
      );
    } catch (error) {
      Alert.alert("Failed", error.message);
    } finally {
      setSavingPanic(false);
    }
  };

  const handleClearPanicCode = () => {
    Alert.alert("Turn off panic wipe?", "The duress code will no longer wipe this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: async () => {
          await clearPanicCode();
          setPanicSet(false);
        },
      },
    ]);
  };

  const handleSaveDecoyCode = async () => {
    if (!CODE_PATTERN.test(decoyCode)) {
      Alert.alert("Invalid code", "Use 4–10 digits only.");
      return;
    }
    if (decoyCode !== decoyConfirm) {
      Alert.alert("Doesn't match", "Both entries must be the same.");
      return;
    }
    if (await collidesWithOtherCodes(decoyCode, "decoy")) {
      Alert.alert("Code already in use", "This matches your unlock or panic code. Pick a different one.");
      return;
    }
    setSavingDecoy(true);
    try {
      await setDecoyCode(decoyCode);
      setDecoySet(true);
      setDecoyCodeInput("");
      setDecoyConfirm("");
      Alert.alert(
        "Saved",
        "Decoy code set. Typing it on the calculator opens a fake, empty-looking chat list instead of your real chats — your real account stays completely hidden behind it."
      );
    } catch (error) {
      Alert.alert("Failed", error.message);
    } finally {
      setSavingDecoy(false);
    }
  };

  const handleClearDecoyCode = () => {
    Alert.alert("Turn off decoy mode?", "This code will no longer open the fake chat list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: async () => {
          await clearDecoyCode();
          setDecoySet(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculator unlock PIN</Text>
          <Text style={styles.sectionHint}>
            {customUnlockSet
              ? "A custom PIN is set on this device. You can change it anytime below."
              : "No PIN set yet."}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="New PIN (4–10 digits)"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={unlockCode}
            onChangeText={setUnlockCodeInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={unlockConfirm}
            onChangeText={setUnlockConfirm}
          />
          <TouchableOpacity
            onPress={handleSaveUnlockCode}
            style={styles.saveButton}
            activeOpacity={0.85}
            disabled={savingUnlock}
          >
            {savingUnlock ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{customUnlockSet ? "Change PIN" : "Set PIN"}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Panic wipe code</Text>
          <Text style={styles.sectionHint}>
            {panicSet
              ? "Enabled. Typing this code on the calculator instantly and silently wipes this device — no warning shown."
              : "Off by default. Optional — set a separate code that instantly wipes this device's chats, keys, and codes with no warning."}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="New panic code (4–10 digits)"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={panicCode}
            onChangeText={setPanicCodeInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm code"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={panicConfirm}
            onChangeText={setPanicConfirm}
          />
          <TouchableOpacity
            onPress={handleSavePanicCode}
            style={styles.saveButton}
            activeOpacity={0.85}
            disabled={savingPanic}
          >
            {savingPanic ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{panicSet ? "Change panic code" : "Set panic code"}</Text>
            )}
          </TouchableOpacity>

          {panicSet && (
            <TouchableOpacity onPress={handleClearPanicCode} style={styles.turnOffButton} activeOpacity={0.85}>
              <Text style={styles.turnOffText}>Turn off panic wipe</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decoy code</Text>
          <Text style={styles.sectionHint}>
            {decoySet
              ? "Enabled. Typing this code on the calculator opens a fake, empty-looking chat list — your real chats stay hidden."
              : "Off by default. Optional — set a separate code that opens a harmless fake chat list instead of your real one."}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="New decoy code (4–10 digits)"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={decoyCode}
            onChangeText={setDecoyCodeInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm code"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            value={decoyConfirm}
            onChangeText={setDecoyConfirm}
          />
          <TouchableOpacity
            onPress={handleSaveDecoyCode}
            style={styles.saveButton}
            activeOpacity={0.85}
            disabled={savingDecoy}
          >
            {savingDecoy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{decoySet ? "Change decoy code" : "Set decoy code"}</Text>
            )}
          </TouchableOpacity>

          {decoySet && (
            <TouchableOpacity onPress={handleClearDecoyCode} style={styles.turnOffButton} activeOpacity={0.85}>
              <Text style={styles.turnOffText}>Turn off decoy mode</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backBtn: { paddingVertical: spacing.sm, width: 50 },
  backText: { color: colors.accentSoft, fontSize: 16, fontWeight: "600" },
  headerTitle: { ...typography.h2 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...typography.bodyBold, marginBottom: 4 },
  sectionHint: { ...typography.caption, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  turnOffButton: { alignItems: "center", marginTop: spacing.sm, paddingVertical: 6 },
  turnOffText: { color: colors.danger, fontWeight: "600" },
});

export default SettingsScreen;