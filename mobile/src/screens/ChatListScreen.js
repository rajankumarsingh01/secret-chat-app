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
    const refresh = () => fetchConversations({ silent: true });
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
    if (lastMessage.imageUrl) return "📷 Photo";
    return lastMessage.text || "🔒 Encrypted message";
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Top App Bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.appBarRow}>
          <Text style={styles.appBarTitle}>Chats</Text>
          <View style={styles.appBarActions}>
            <TouchableOpacity onPress={toggleSearch} style={styles.appBarIconBtn}>
              <Text style={styles.appBarIconText}>{searchOpen ? "✕" : "🔍"}</Text>
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
      </View>

      {/* List */}
      {initialLoading ? (
        <View style={{ paddingTop: spacing.sm }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>{searchQuery ? "No matches" : "No chats yet"}</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? "Try a different name" : "Tap the button below to add someone"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => {
            const isOwnLastMessage = item.lastMessage?.sender === user._id;
            const status = isOwnLastMessage ? lastMessageStatus(item.lastMessage) : null;
            return (
              <TouchableOpacity
                style={[styles.userRow, item.readOnly && styles.userRowDimmed]}
                activeOpacity={0.6}
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
                  <View style={styles.rowTop}>
                    <Text style={styles.username} numberOfLines={1}>
                      {item.partner.username}
                    </Text>
                    {item.lastMessage && (
                      <Text
                        style={[styles.time, item.unreadCount > 0 && !item.readOnly && styles.timeUnread]}
                      >
                        {formatTime(item.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>
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
                      {item.readOnly ? "Read-only — locked elsewhere" : previewText(item.lastMessage, isOwnLastMessage)}
                    </Text>
                    {item.unreadCount > 0 && !item.readOnly && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Action Button — new chat */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, spacing.md) + spacing.lg }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("AddContact")}
      >
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  appBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appBarTitle: { ...typography.h1, fontSize: 24, color: colors.text },
  appBarActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  appBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  appBarIconText: { color: colors.text, fontSize: 18 },

  headerAvatar: { width: 34, height: 34, borderRadius: radius.full },
  headerAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 15 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
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
    width: 13,
    height: 13,
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

  middleCol: { flex: 1, marginLeft: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.sm + 4, marginBottom: -(spacing.sm + 4) },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  username: { ...typography.bodyBold, fontSize: 16.5, flexShrink: 1 },
  time: { ...typography.caption, fontSize: 12 },
  timeUnread: { color: colors.unreadBadge, fontWeight: "700" },

  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  preview: { ...typography.caption, fontSize: 13.5, flexShrink: 1, flex: 1 },
  previewUnread: { color: colors.text, fontWeight: "500" },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.unreadBadge,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  badgeText: { color: "#0B141A", fontSize: 11, fontWeight: "800" },

  tickGray: { fontSize: 12, color: colors.textMuted },
  tickRead: { fontSize: 12, color: colors.accentSoft },

  skeletonBlock: { backgroundColor: colors.surfaceAlt },
  skeletonLine: { backgroundColor: colors.surfaceAlt, borderRadius: 4 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { ...typography.h2, marginBottom: spacing.xs },
  emptySubtext: { ...typography.body, color: colors.textMuted, textAlign: "center" },

  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: { fontSize: 24 },
});

export default ChatListScreen;