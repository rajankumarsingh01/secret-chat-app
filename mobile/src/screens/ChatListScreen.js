import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme";

const ChatListScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const socket = getSocket();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchConversations);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!socket) return;
    socket.on("receive_message", fetchConversations);
    socket.on("messages_seen", fetchConversations);
    socket.on("lock_state_sync", fetchConversations);
    return () => {
      socket.off("receive_message", fetchConversations);
      socket.off("messages_seen", fetchConversations);
      socket.off("lock_state_sync", fetchConversations);
    };
  }, [socket]);

  const fetchConversations = async () => {
    try {
      const response = await api.get("/chat/conversations");
      setConversations(response.data);
    } catch (error) {
      console.log("Error fetching conversations:", error.message);
    }
  };

  const initials = (name) => name?.charAt(0).toUpperCase();

  const previewText = (lastMessage, isOwn) => {
    if (!lastMessage) return "Say hi 👋";
    if (lastMessage.deletedForEveryone) return "🚫 Message deleted";
    const prefix = isOwn ? "You: " : "";
    if (lastMessage.imageUrl) return `${prefix}📷 Photo`;
    return `${prefix}${lastMessage.text || "🔒 Encrypted message"}`;
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerText}>Chats</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate("AddContact")} style={styles.addButton}>
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
            {user?.profilePicUrl ? (
              <Image source={{ uri: user.profilePicUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initials(user?.username)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No contacts yet</Text>
          <Text style={styles.emptySubtext}>Tap ＋ to add someone with a code</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={{ paddingTop: spacing.sm }}
          renderItem={({ item }) => {
            const isOwnLastMessage = item.lastMessage?.sender === user._id;
            return (
              <TouchableOpacity
                style={[styles.userRow, item.readOnly && styles.userRowDimmed]}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate("Chat", {
                    otherUser: item.partner,
                    conversationId: item.conversationId,
                    locked: item.locked,
                    readOnly: item.readOnly,
                  })
                }
              >
                <View>
                  {item.partner.profilePicUrl ? (
                    <Image source={{ uri: item.partner.profilePicUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>{initials(item.partner.username)}</Text>
                    </View>
                  )}
                  {item.partner.isOnline && !item.readOnly && <View style={styles.onlineDot} />}
                  {item.locked && (
                    <View style={styles.lockDot}>
                      <Text style={styles.lockDotText}>🔒</Text>
                    </View>
                  )}
                </View>

                <View style={styles.middleCol}>
                  <Text style={styles.username}>{item.partner.username}</Text>
                  <Text
                    style={[styles.preview, item.unreadCount > 0 && !item.readOnly && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {item.readOnly ? "Read-only — you're locked elsewhere" : previewText(item.lastMessage, isOwnLastMessage)}
                  </Text>
                </View>

                <View style={styles.rightCol}>
                  {item.lastMessage && <Text style={styles.time}>{formatTime(item.lastMessage.createdAt)}</Text>}
                  {item.unreadCount > 0 && !item.readOnly && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: { ...typography.h1, fontSize: 26 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  addButtonText: { color: colors.accentSoft, fontSize: 20, fontWeight: "700" },
  headerAvatar: { width: 40, height: 40, borderRadius: radius.full },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 16 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  userRowDimmed: { opacity: 0.5 },
  avatar: { width: 52, height: 52, borderRadius: radius.full },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  lockDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 2,
  },
  lockDotText: { fontSize: 10 },
  middleCol: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  username: { ...typography.bodyBold, fontSize: 16 },
  preview: { ...typography.caption, marginTop: 2, fontSize: 13 },
  previewUnread: { color: colors.text, fontWeight: "600" },
  rightCol: { alignItems: "flex-end" },
  time: { ...typography.caption, fontSize: 11 },
  badge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  emptyText: { ...typography.h2, marginBottom: spacing.xs },
  emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});

export default ChatListScreen;