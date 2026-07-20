// mobile/src/screens/ChatListScreen.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme";

const Tick = ({ status }) => {
  // status: "sent" | "delivered" | "read"
  if (status === "read") return <Text style={styles.tickRead}>✓✓</Text>;
  if (status === "delivered") return <Text style={styles.tickGray}>✓✓</Text>;
  return <Text style={styles.tickGray}>✓</Text>;
};

const SkeletonRow = () => (
  <View style={styles.userRow}>
    <View style={[styles.avatarPlaceholder, styles.skeletonBlock]} />
    <View style={styles.middleCol}>
      <View style={[styles.skeletonLine, { width: "45%", height: 14 }]} />
      <View style={[styles.skeletonLine, { width: "70%", height: 11, marginTop: 8 }]} />
    </View>
  </View>
);

const ChatListScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const socket = getSocket();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => fetchConversations());
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchConversations();
    socket.on("receive_message", refresh);
    socket.on("messages_seen", refresh);
    socket.on("lock_state_sync", refresh);
    return () => {
      socket.off("receive_message", refresh);
      socket.off("messages_seen", refresh);
      socket.off("lock_state_sync", refresh);
    };
  }, [socket]);

  const fetchConversations = async ({ silent = false } = {}) => {
    try {
      const response = await api.get("/chat/conversations");
      setConversations(response.data);
    } catch (error) {
      console.log("Error fetching conversations:", error.message);
    } finally {
      if (!silent) setInitialLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations({ silent: true });
    setRefreshing(false);
  }, []);

  const initials = (name) => name?.charAt(0).toUpperCase();

  const previewText = (lastMessage, isOwn) => {
    if (!lastMessage) return "Say hi 👋";
    if (lastMessage.deletedForEveryone) return "🚫 Message deleted";
    const prefix = isOwn ? "" : "";
    if (lastMessage.imageUrl) return `${prefix}📷 Photo`;
    return `${prefix}${lastMessage.text || "🔒 Encrypted message"}`;
  };

  const lastMessageStatus = (lastMessage) => {
    if (!lastMessage) return null;
    if (lastMessage.isRead) return "read";
    if (lastMessage.isDelivered) return "delivered";
    return "sent";
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((item) => item.partner.username?.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const toggleSearch = () => {
    if (searchOpen) setSearchQuery("");
    setSearchOpen((prev) => !prev);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerText}>Chats</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleSearch} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>{searchOpen ? "✕" : "🔍"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("AddContact")} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>＋</Text>
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

      {searchOpen && (
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor={colors.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {initialLoading ? (
        <View style={{ paddingTop: spacing.sm }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{searchQuery ? "No matches" : "No contacts yet"}</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? "Try a different name" : "Tap ＋ to add someone with a code"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={{ paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => {
            const isOwnLastMessage = item.lastMessage?.sender === user._id;
            const status = isOwnLastMessage ? lastMessageStatus(item.lastMessage) : null;
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
                  <View style={styles.previewRow}>
                    {status && (
                      <View style={{ marginRight: 3 }}>
                        <Tick status={status} />
                      </View>
                    )}
                    <Text
                      style={[styles.preview, item.unreadCount > 0 && !item.readOnly && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {item.readOnly
                        ? "Read-only — you're locked elsewhere"
                        : previewText(item.lastMessage, isOwnLastMessage)}
                    </Text>
                  </View>
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  iconButtonText: { color: colors.accentSoft, fontSize: 18, fontWeight: "700" },
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, padding: 0 },
  searchClear: { color: colors.textMuted, fontSize: 16, paddingLeft: spacing.sm },
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
  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  preview: { ...typography.caption, fontSize: 13, flexShrink: 1 },
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
  tickGray: { fontSize: 11, color: colors.textMuted },
  tickRead: { fontSize: 11, color: "#4FC3F7" },
  skeletonBlock: { backgroundColor: colors.surfaceAlt },
  skeletonLine: { backgroundColor: colors.surfaceAlt, borderRadius: 4 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  emptyText: { ...typography.h2, marginBottom: spacing.xs },
  emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});

export default ChatListScreen;