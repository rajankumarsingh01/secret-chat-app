// mobile/src/screens/DecoyChatScreen.js
//
// A fake thread opened from DecoyChatListScreen. Everything is in local state
// only — nothing is sent anywhere, nothing is persisted to disk, and it resets
// the moment this screen unmounts. That's intentional: this must never become
// a second place where real data could leak.
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../theme";

const SEED_MESSAGES = {
  d1: [
    { id: "1", mine: false, text: "Bhai kal college aa raha hai na?" },
    { id: "2", mine: true, text: "Haan aa raha hu, 9 baje milte hai" },
    { id: "3", mine: false, text: "Ok bhai, kal college me milte hai" },
  ],
  d2: [
    { id: "1", mine: false, text: "Khana kha liya?" },
    { id: "2", mine: true, text: "Haan mumma kha liya" },
  ],
  d3: [
    { id: "1", mine: false, text: "Wo maths wale notes hai kya tere paas?" },
    { id: "2", mine: true, text: "Haan hai, kal de dunga" },
    { id: "3", mine: false, text: "Notes bhej dena us subject ke" },
  ],
  d4: [
    { id: "1", mine: false, text: "Rohan: match 7 baje start hoga" },
    { id: "2", mine: false, text: "Rohan: aaj India batting pehle karegi" },
  ],
};

const DecoyChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState(SEED_MESSAGES[contact.id] || []);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), mine: true, text: trimmed }]);
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{contact.initial}</Text>
        </View>
        <Text style={styles.name}>{contact.name}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity onPress={send} style={styles.sendBtn} activeOpacity={0.8}>
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.headerBg,
  },
  backBtn: { paddingRight: spacing.sm },
  backText: { color: colors.accentSoft, fontSize: 28 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  avatarText: { color: colors.accentSoft, fontWeight: "700" },
  name: { color: colors.text, fontSize: 17, fontWeight: "600" },
  bubble: { maxWidth: "80%", borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  bubbleMine: { backgroundColor: colors.bubbleOwn, alignSelf: "flex-end" },
  bubbleOther: { backgroundColor: colors.bubbleOther, alignSelf: "flex-start" },
  bubbleText: { color: colors.text, fontSize: 15 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.headerBg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 18 },
});

export default DecoyChatScreen;