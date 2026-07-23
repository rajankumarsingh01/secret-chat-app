// mobile/src/screens/GroupInfoScreen.js
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
  Modal,
} from "react-native";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme";

const GroupInfoScreen = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const socket = getSocket();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, []);

  const fetchGroup = async () => {
    try {
      const response = await api.get(`/groups/${conversationId}`);
      setGroup(response.data);
      setNewName(response.data.groupName);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = group?.groupAdmins?.some((id) => id === user._id || id?._id === user._id);
  const initials = (name) => name?.charAt(0).toUpperCase();

  const handleRename = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.patch(`/groups/${conversationId}/rename`, { groupName: newName.trim() });
      setGroup((prev) => ({ ...prev, groupName: newName.trim() }));
      setRenaming(false);
    } catch (error) {
      Alert.alert("Couldn't rename", error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  };

  const openAddMembers = async () => {
    try {
      const response = await api.get("/chat/contacts");
      const existingIds = new Set(group.participants.map((p) => p._id));
      setContacts(response.data.filter((c) => !existingIds.has(c._id)));
      setSelected([]);
      setAddModalVisible(true);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
    }
  };

  const toggleSelect = (userId) => {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleAddMembers = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const response = await api.post(`/groups/${conversationId}/members`, { memberIds: selected });
      setGroup(response.data);
      setAddModalVisible(false);
    } catch (error) {
      Alert.alert("Couldn't add members", error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert("Remove member", `Remove ${member.username} from the group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/groups/${conversationId}/members/${member._id}`);
            setGroup((prev) => ({
              ...prev,
              participants: prev.participants.filter((p) => p._id !== member._id),
            }));
          } catch (error) {
            Alert.alert("Couldn't remove", error.response?.data?.message || error.message);
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert("Leave group?", `You'll no longer receive messages from ${group.groupName}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post(`/groups/${conversationId}/leave`);
            navigation.navigate("ChatList");
          } catch (error) {
            Alert.alert("Couldn't leave", error.response?.data?.message || error.message);
          }
        },
      },
    ]);
  };

  if (loading || !group) {
    return (
      <View style={[styles.container, styles.centerLoading]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group info</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.groupHeaderSection}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>{initials(group.groupName)}</Text>
        </View>

        {renaming ? (
          <View style={styles.renameRow}>
            <TextInput
              style={styles.renameInput}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={50}
            />
            <TouchableOpacity onPress={handleRename} disabled={busy} style={styles.renameSaveBtn}>
              <Text style={styles.renameSaveText}>{busy ? "…" : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRenaming(false)} style={styles.renameCancelBtn}>
              <Text style={styles.renameCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => isAdmin && setRenaming(true)} activeOpacity={isAdmin ? 0.6 : 1}>
            <Text style={styles.groupName}>{group.groupName}</Text>
            {isAdmin && <Text style={styles.editHint}>Tap to rename</Text>}
          </TouchableOpacity>
        )}
        <Text style={styles.memberCount}>{group.participants.length} participants</Text>
      </View>

      {isAdmin && (
        <TouchableOpacity style={styles.addMemberRow} onPress={openAddMembers}>
          <View style={styles.addIconCircle}>
            <Text style={styles.addIconText}>+</Text>
          </View>
          <Text style={styles.addMemberText}>Add members</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={group.participants}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const memberIsAdmin = group.groupAdmins?.some((id) => id === item._id || id?._id === item._id);
          const isCreator = group.createdBy === item._id || group.createdBy?._id === item._id;
          return (
            <View style={styles.memberRow}>
              {item.profilePicUrl ? (
                <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initials(item.username)}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.memberName}>
                  {item._id === user._id ? "You" : item.username}
                </Text>
                {memberIsAdmin && <Text style={styles.adminTag}>Group admin</Text>}
              </View>
              {isAdmin && item._id !== user._id && !isCreator && (
                <TouchableOpacity onPress={() => handleRemoveMember(item)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
        <Text style={styles.leaveBtnText}>Leave group</Text>
      </TouchableOpacity>

      <Modal visible={addModalVisible} animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.backBtn}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add members</Text>
            <View style={{ width: 40 }} />
          </View>

          {contacts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Everyone is already in this group</Text>
            </View>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item._id);
                return (
                  <TouchableOpacity style={styles.memberRow} activeOpacity={0.7} onPress={() => toggleSelect(item._id)}>
                    {item.profilePicUrl ? (
                      <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{initials(item.username)}</Text>
                      </View>
                    )}
                    <Text style={[styles.memberName, { flex: 1, marginLeft: spacing.md }]}>{item.username}</Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.createBtn, (selected.length === 0 || busy) && styles.createBtnDisabled]}
            onPress={handleAddMembers}
            disabled={selected.length === 0 || busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Add selected</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
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

  groupHeaderSection: { alignItems: "center", paddingVertical: spacing.xl, backgroundColor: colors.surface },
  groupAvatar: {
    width: 90,
    height: 90,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  groupAvatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  groupName: { ...typography.h2, textAlign: "center" },
  editHint: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: 2 },
  memberCount: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },

  renameRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg },
  renameInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 18,
    flex: 1,
  },
  renameSaveBtn: { marginLeft: spacing.sm, paddingHorizontal: spacing.sm },
  renameSaveText: { color: colors.accent, fontWeight: "700" },
  renameCancelBtn: { paddingHorizontal: spacing.xs },
  renameCancelText: { color: colors.textMuted, fontSize: 16 },

  addMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  addIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  addIconText: { color: colors.accent, fontSize: 20, fontWeight: "700" },
  addMemberText: { color: colors.accent, fontSize: 15.5, fontWeight: "600", marginLeft: spacing.md },

  memberRow: {
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
  memberName: { ...typography.body, fontSize: 16 },
  adminTag: { color: colors.accent, fontSize: 12, marginTop: 2 },
  removeBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  removeBtnText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  leaveBtn: { padding: spacing.md, alignItems: "center" },
  leaveBtnText: { color: colors.danger, fontSize: 15.5, fontWeight: "600" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: "center" },

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

export default GroupInfoScreen;