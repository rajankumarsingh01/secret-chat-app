// mobile/src/screens/DecoyChatListScreen.js
//
// Shown ONLY when the decoy code is typed into the calculator. Everything here
// is fake and local — no API calls, no socket connection, no real user data is
// ever read. If someone flips through this under pressure, there is simply
// nothing real for them to find.
import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, typography } from "../theme";

// Deliberately bland, everyday content — nothing that looks staged or hidden.
const FAKE_CONTACTS = [
  { id: "d1", name: "Amit", last: "Ok bhai, kal college me milte hai", time: "Yesterday", initial: "A" },
  { id: "d2", name: "Mummy", last: "Khana kha liya?", time: "Yesterday", initial: "M" },
  { id: "d3", name: "Priya", last: "Notes bhej dena us subject ke", time: "Monday", initial: "P" },
  { id: "d4", name: "Cricket Group", last: "Rohan: match 7 baje start hoga", time: "Monday", initial: "C" },
];

const DecoyChatListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [contacts] = useState(FAKE_CONTACTS);

  const openThread = (contact) => {
    navigation.navigate("DecoyChat", { contact });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openThread(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.initial}</Text>
      </View>
      <View style={styles.middleCol}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.last} numberOfLines={1}>{item.last}</Text>
      </View>
      <Text style={styles.time}>{item.time}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity
          onPress={() => Alert.alert("No new contacts", "You're all caught up.")}
          style={styles.addBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.headerBg,
  },
  headerTitle: { ...typography.h1 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: colors.accentSoft, fontSize: 20, fontWeight: "600", marginTop: -2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.accentSoft, fontSize: 18, fontWeight: "700" },
  middleCol: { flex: 1 },
  name: { ...typography.bodyBold },
  last: { ...typography.caption, marginTop: 2 },
  time: { ...typography.caption },
});

export default DecoyChatListScreen;