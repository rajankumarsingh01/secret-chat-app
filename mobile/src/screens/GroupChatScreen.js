// mobile/src/screens/GroupChatScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "../components/MessageBubble";
import { colors, spacing, radius } from "../theme";
import { getOrCreateKeyPair, encryptForGroup, decryptGroupMessage } from "../crypto/e2e";

const PAGE_SIZE = 30;
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
const TYPING_TIMEOUT = 4000;

const GroupChatScreen = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [mySecretKey, setMySecretKey] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState({}); // { userId: username }
  const socket = getSocket();
  const insets = useSafeAreaInsets();
  const typingTimeoutRef = useRef(null);
  const typingClearTimers = useRef({});

  useEffect(() => {
    init();
    return () => {
      Object.values(typingClearTimers.current).forEach(clearTimeout);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const init = async () => {
    const { secretKey } = await getOrCreateKeyPair();
    setMySecretKey(secretKey);
    await fetchGroupInfo();
  };

  const fetchGroupInfo = async () => {
    try {
      const response = await api.get(`/groups/${conversationId}`);
      setGroup(response.data);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
      navigation.goBack();
    }
  };

  const publicKeyOf = (senderId, groupData) => {
    const member = (groupData?.participants || []).find((p) => p._id === senderId || p._id?.toString?.() === senderId);
    return member?.publicKey;
  };

  const decryptForDisplay = (message, secretKey, groupData) => {
    if (message.deletedForEveryone) return message;
    const senderId = message.sender?._id || message.sender;
    const senderPublicKey = senderId === user._id ? undefined : publicKeyOf(senderId, groupData);
    // For our OWN messages we still need OUR own public key to decrypt our own
    // cipher entry (we encrypted to ourselves with our own key pair).
    const keyForDecrypt = senderId === user._id ? groupData?.participants?.find((p) => p._id === user._id)?.publicKey : senderPublicKey;
    const decryptedText = decryptGroupMessage(message, user._id, keyForDecrypt, secretKey);
    return { ...message, text: decryptedText };
  };

  useEffect(() => {
    if (group && mySecretKey) fetchInitialHistory();
  }, [group, mySecretKey]);

  const fetchInitialHistory = async ({ merge = false } = {}) => {
    try {
      const response = await api.get(`/chat/group/${conversationId}/messages`, { params: { limit: PAGE_SIZE } });
      const decrypted = response.data.messages.map((m) => decryptForDisplay(m, mySecretKey, group));

      if (merge) {
        setMessages((prev) => {
          const freshIds = new Set(decrypted.map((m) => m._id));
          const oldestFreshTime = decrypted.length
            ? new Date(decrypted[decrypted.length - 1].createdAt).getTime()
            : 0;
          const olderKept = prev.filter(
            (m) => !freshIds.has(m._id) && new Date(m.createdAt).getTime() < oldestFreshTime
          );
          return [...decrypted, ...olderKept];
        });
      } else {
        setMessages(decrypted);
        setHasMore(response.data.hasMore);
      }

      if (socket) socket.emit("mark_group_read", { conversationId });
    } catch (error) {
      console.log("Error fetching group history:", error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0 || !mySecretKey) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const response = await api.get(`/chat/group/${conversationId}/messages`, {
        params: { limit: PAGE_SIZE, before: oldest.createdAt },
      });
      const decrypted = response.data.messages.map((m) => decryptForDisplay(m, mySecretKey, group));
      setMessages((prev) => [...prev, ...decrypted]);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.log("Error loading more group messages:", error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleIncomingMessage = (message) => {
    const msgConvId = message.conversation?.toString?.() || message.conversation;
    if (msgConvId !== conversationId || !mySecretKey || !group) return;
    setMessages((prev) => [decryptForDisplay(message, mySecretKey, group), ...prev]);
    socket?.emit("mark_group_read", { conversationId });
  };

  const handleReacted = ({ messageId, reaction }) => {
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reaction } : m)));
  };

  const handleDeletedSync = ({ messageId }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, deletedForEveryone: true, text: "" } : m))
    );
  };

  const handleSeen = ({ by }) => {
    setMessages((prev) =>
      prev.map((m) => (m.readBy?.includes(by) ? m : { ...m, readBy: [...(m.readBy || []), by] }))
    );
  };

  const handleTyping = ({ userId, username }) => {
    if (userId === user._id) return;
    setTypingUsers((prev) => ({ ...prev, [userId]: username }));
    if (typingClearTimers.current[userId]) clearTimeout(typingClearTimers.current[userId]);
    typingClearTimers.current[userId] = setTimeout(() => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }, TYPING_TIMEOUT);
  };

  const handleStopTyping = ({ userId }) => {
    setTypingUsers((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  useEffect(() => {
    if (!socket) return;

    const onReceive = (message) => handleIncomingMessage(message);
    const onReconnect = () => {
      if (mySecretKey && group) fetchInitialHistory({ merge: true });
    };

    socket.on("receive_group_message", onReceive);
    socket.on("group_message_reacted", handleReacted);
    socket.on("group_message_deleted_sync", handleDeletedSync);
    socket.on("group_messages_seen", handleSeen);
    socket.on("group_user_typing", handleTyping);
    socket.on("group_user_stop_typing", handleStopTyping);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("receive_group_message", onReceive);
      socket.off("group_message_reacted", handleReacted);
      socket.off("group_message_deleted_sync", handleDeletedSync);
      socket.off("group_messages_seen", handleSeen);
      socket.off("group_user_typing", handleTyping);
      socket.off("group_user_stop_typing", handleStopTyping);
      socket.off("connect", onReconnect);
    };
  }, [socket, mySecretKey, group]);

  const sendTextMessage = () => {
    if (!text.trim() || !socket || !mySecretKey || !group) return;

    const recipientCiphers = encryptForGroup(text.trim(), group.participants, mySecretKey);
    if (recipientCiphers.length === 0) {
      Alert.alert("Can't encrypt", "No group member has encryption set up yet.");
      return;
    }

    socket.emit("send_group_message", {
      conversationId,
      recipientCiphers,
      replyTo: replyingTo?._id || null,
    });
    setText("");
    setReplyingTo(null);
    socket.emit("group_stop_typing", { conversationId });
  };

  const onChangeText = (value) => {
    setText(value);
    if (!socket) return;
    socket.emit("group_typing", { conversationId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("group_stop_typing", { conversationId });
    }, 2000);
  };

  const handleReply = (message) => setReplyingTo(message);

  const handleReact = (message) => {
    Alert.alert(
      "React",
      "",
      REACTION_EMOJIS.map((emoji) => ({
        text: emoji,
        onPress: () => socket.emit("react_group_message", { messageId: message._id, emoji, conversationId }),
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };

  const handleDelete = async (message, mode) => {
    try {
      await api.delete(`/chat/${message._id}`, { data: { mode } });
      if (mode === "everyone") {
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? { ...m, deletedForEveryone: true, text: "" } : m))
        );
        socket.emit("group_message_deleted", { messageId: message._id, conversationId });
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== message._id));
      }
    } catch (error) {
      Alert.alert("Couldn't delete", error.response?.data?.message || error.message);
    }
  };

  const initials = (name) => name?.charAt(0).toUpperCase();

  const senderName = (message) => {
    const senderId = message.sender?._id || message.sender;
    if (senderId === user._id) return null;
    return message.sender?.username || group?.participants?.find((p) => p._id === senderId)?.username || "";
  };

  const otherParticipantIds = (group?.participants || [])
    .filter((p) => p._id !== user._id)
    .map((p) => p._id);

  const withReadStatus = (message) => {
    const isOwn = (message.sender?._id || message.sender) === user._id;
    if (!isOwn) return message;
    const isReadByAll =
      otherParticipantIds.length > 0 && otherParticipantIds.every((id) => (message.readBy || []).includes(id));
    return { ...message, isDelivered: true, isRead: isReadByAll };
  };

  const typingText = () => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing…`;
    return `${names.join(", ")} are typing…`;
  };

  if (!group) {
    return (
      <View style={[styles.container, styles.centerLoading]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.replace("Calculator")} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate("GroupInfo", { conversationId })}
          activeOpacity={0.7}
        >
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initials(group.groupName)}</Text>
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{group.groupName}</Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {typingText() || `${group.participants.length} participants`}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <View style={styles.wallpaper}>
          {initialLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item._id}
              inverted
              contentContainerStyle={{ paddingVertical: spacing.md }}
              renderItem={({ item }) => (
                <MessageBubble
                  message={withReadStatus(item)}
                  isOwnMessage={(item.sender?._id || item.sender) === user._id}
                  senderLabel={senderName(item)}
                  onReply={handleReply}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onOpenViewOnce={() => {}}
                />
              )}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {replyingTo ? (
          <View style={styles.replyPreviewBar}>
            <View style={styles.replyPreviewLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyPreviewLabel}>
                Replying to {(replyingTo.sender?._id || replyingTo.sender) === user._id ? "yourself" : senderName(replyingTo) || "them"}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>{replyingTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCancelBtn}>
              <Text style={styles.replyCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={onChangeText}
              multiline
            />
          </View>
          <TouchableOpacity onPress={sendTextMessage} style={styles.sendButton} activeOpacity={0.8}>
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.headerBg },
  wallpaper: { flex: 1, backgroundColor: colors.bg },
  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingMore: { paddingVertical: spacing.md, alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.headerBg,
  },
  backBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  backText: { fontSize: 30, color: colors.text, fontWeight: "300" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700" },
  headerTitle: { color: colors.text, fontSize: 16.5, fontWeight: "600" },
  headerStatus: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },

  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyPreviewLine: { width: 3, height: 30, backgroundColor: colors.accent, borderRadius: 2, marginRight: spacing.sm },
  replyPreviewLabel: { color: colors.accentSoft, fontSize: 12, fontWeight: "700" },
  replyPreviewText: { color: colors.textMuted, fontSize: 13 },
  replyCancelBtn: { padding: spacing.xs },
  replyCancelText: { color: colors.textMuted, fontSize: 16 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "#fff", fontSize: 18 },
});

export default GroupChatScreen;