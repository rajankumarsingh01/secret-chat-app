// mobile/src/screens/CreateGroupScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors, spacing, radius, typography } from "../theme";

const CreateGroupScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await api.get("/chat/contacts");
      setContacts(response.data);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (userId) => {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const initials = (name) => name?.charAt(0).toUpperCase();

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert("Group name required", "Give your group a name");
      return;
    }
    if (selected.length < 2) {
      Alert.alert("Pick more people", "Select at least 2 contacts to start a group");
      return;
    }

    setCreating(true);
    try {
      const response = await api.post("/groups", { groupName: groupName.trim(), memberIds: selected });
      const group = response.data;

      if (socket) socket.emit("join_group_room", { conversationId: group._id });

      navigation.replace("GroupChat", { conversationId: group._id });
    } catch (error) {
      Alert.alert("Couldn't create group", error.response?.data?.message || error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New group</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          placeholder="Group name"
          placeholderTextColor={colors.textFaint}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
      </View>

      <Text style={styles.sectionLabel}>
        {selected.length > 0 ? `${selected.length} selected` : "Select at least 2 contacts"}
      </Text>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No contacts yet</Text>
          <Text style={styles.emptySubtext}>Add some 1-1 contacts first, then come back to start a group.</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item._id);
            return (
              <TouchableOpacity style={styles.contactRow} activeOpacity={0.7} onPress={() => toggleSelect(item._id)}>
                {item.profilePicUrl ? (
                  <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{initials(item.username)}</Text>
                  </View>
                )}
                <Text style={styles.contactName}>{item.username}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.createBtn, (creating || selected.length < 2 || !groupName.trim()) && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={creating || selected.length < 2 || !groupName.trim()}
        activeOpacity={0.85}
      >
        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create group</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.headerBg,
  },
  backBtn: { width: 40, paddingVertical: spacing.xs },
  backText: { fontSize: 30, color: colors.text, fontWeight: "300" },
  headerTitle: { ...typography.bodyBold, fontSize: 17 },

  nameRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  nameInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  sectionLabel: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },

  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  emptyText: { ...typography.h2, marginBottom: spacing.xs },
  emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: "center" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  avatar: { width: 46, height: 46, borderRadius: radius.full },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 15 },
  contactName: { ...typography.body, flex: 1, marginLeft: spacing.md, fontSize: 16 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.textFaint,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxTick: { color: "#fff", fontSize: 13, fontWeight: "700" },

  createBtn: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default CreateGroupScreen;