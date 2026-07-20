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
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "../components/MessageBubble";
import { colors, spacing, radius } from "../theme";
import { getOrCreateKeyPair, encryptMessage, decryptMessage } from "../crypto/e2e";
import {
  getLockStatus,
  requestLock,
  confirmLock,
  rejectLock,
  requestUnlock,
  confirmUnlock,
  rejectUnlock,
} from "../services/lock";

const PAGE_SIZE = 30;
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

const ChatScreen = ({ route, navigation }) => {
  const { otherUser, conversationId, readOnly: initialReadOnly } = route.params;
  const { user } = useAuth();

  if (!user || !otherUser) return null;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mySecretKey, setMySecretKey] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [lockStatus, setLockStatus] = useState(null);
  const socket = getSocket();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    init();
    fetchLockStatus();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("receive_message", handleIncomingMessage);
    socket.on("message_delivered", handleDelivered);
    socket.on("message_reacted", handleReacted);
    socket.on("message_deleted_sync", handleDeletedSync);
    socket.on("lock_state_sync", fetchLockStatus);
    return () => {
      socket.off("receive_message", handleIncomingMessage);
      socket.off("message_delivered", handleDelivered);
      socket.off("message_reacted", handleReacted);
      socket.off("message_deleted_sync", handleDeletedSync);
      socket.off("lock_state_sync", fetchLockStatus);
    };
  }, [mySecretKey]);

  const init = async () => {
    const { secretKey } = await getOrCreateKeyPair();
    setMySecretKey(secretKey);
  };

  const fetchLockStatus = async () => {
    try {
      const response = await getLockStatus(conversationId);
      setLockStatus(response.data);
    } catch (error) {
      console.log("Error fetching lock status:", error.message);
    }
  };

  const decryptForDisplay = (message, secretKey) => {
    if (message.imageUrl || message.deletedForEveryone) return message;
    const decryptedText = decryptMessage(message.cipherText, message.nonce, otherUser.publicKey, secretKey);
    return { ...message, text: decryptedText };
  };

  const handleIncomingMessage = (message) => {
    if (!mySecretKey) return;
    const isRelevant =
      (message.sender === otherUser._id && message.receiver === user._id) ||
      (message.sender === user._id && message.receiver === otherUser._id);
    if (isRelevant) {
      setMessages((prev) => [decryptForDisplay(message, mySecretKey), ...prev]);
    }
  };

  const handleDelivered = ({ messageId }) => {
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, isDelivered: true } : m)));
  };

  const handleReacted = ({ messageId, reaction }) => {
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reaction } : m)));
  };

  const handleDeletedSync = ({ messageId }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, deletedForEveryone: true, text: "", imageUrl: "" } : m))
    );
  };

  useEffect(() => {
    if (mySecretKey) fetchInitialHistory();
  }, [mySecretKey]);

  const fetchInitialHistory = async () => {
    try {
      const response = await api.get(`/chat/${otherUser._id}`, { params: { limit: PAGE_SIZE } });
      const decrypted = response.data.messages.map((m) => decryptForDisplay(m, mySecretKey));
      setMessages(decrypted);
      setHasMore(response.data.hasMore);
      if (socket) socket.emit("mark_read", { otherUserId: otherUser._id });
    } catch (error) {
      console.log("Error fetching chat history:", error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0 || !mySecretKey) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const response = await api.get(`/chat/${otherUser._id}`, {
        params: { limit: PAGE_SIZE, before: oldest.createdAt },
      });
      const decrypted = response.data.messages.map((m) => decryptForDisplay(m, mySecretKey));
      setMessages((prev) => [...prev, ...decrypted]);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.log("Error loading more messages:", error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const sendTextMessage = () => {
    if (!text.trim() || !socket || !mySecretKey || initialReadOnly) return;
    if (!otherUser.publicKey) {
      Alert.alert("Can't encrypt", "This contact hasn't set up encryption yet. Ask them to reopen the app.");
      return;
    }

    const { cipherText, nonce } = encryptMessage(text.trim(), otherUser.publicKey, mySecretKey);
    socket.emit("send_message", { receiver: otherUser._id, cipherText, nonce, replyTo: replyingTo?._id || null });
    setText("");
    setReplyingTo(null);
  };

  const pickAndSendImage = async () => {
    if (initialReadOnly) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to send images");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", { uri: asset.uri, type: "image/jpeg", name: "chat-image.jpg" });
      const response = await api.post("/chat/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (socket) {
        socket.emit("send_message", {
          receiver: otherUser._id,
          imageUrl: response.data.imageUrl,
          replyTo: replyingTo?._id || null,
        });
      }
      setReplyingTo(null);
    } catch (error) {
      Alert.alert("Upload failed", error.response?.data?.message || error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReply = (message) => setReplyingTo(message);

  const handleReact = (message) => {
    Alert.alert(
      "React",
      "",
      REACTION_EMOJIS.map((emoji) => ({
        text: emoji,
        onPress: () => socket.emit("react_message", { messageId: message._id, emoji, otherUserId: otherUser._id }),
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };

  const handleDelete = async (message, mode) => {
    try {
      await api.delete(`/chat/${message._id}`, { data: { mode } });
      if (mode === "everyone") {
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? { ...m, deletedForEveryone: true, text: "", imageUrl: "" } : m))
        );
        socket.emit("message_deleted", { messageId: message._id, otherUserId: otherUser._id });
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== message._id));
      }
    } catch (error) {
      Alert.alert("Couldn't delete", error.response?.data?.message || error.message);
    }
  };

  const notifyLockChange = () => {
    if (socket) socket.emit("lock_state_changed", { otherUserId: otherUser._id });
  };

  const handleLockMenu = () => {
    if (!lockStatus) return;

    if (lockStatus.locked) {
      Alert.alert("Locked chat", `You're exclusively locked with ${otherUser.username}.`, [
        {
          text: "Request unlock",
          onPress: async () => {
            try {
              await requestUnlock(conversationId);
              notifyLockChange();
              fetchLockStatus();
            } catch (error) {
              Alert.alert("Error", error.response?.data?.message || error.message);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }

    if (lockStatus.lockRequestedBy) {
      const isMine = lockStatus.lockRequestedBy === user._id;
      if (isMine) {
        Alert.alert("Lock pending", "Waiting for them to confirm. You can cancel this request.", [
          {
            text: "Cancel request",
            style: "destructive",
            onPress: async () => {
              await rejectLock(conversationId);
              notifyLockChange();
              fetchLockStatus();
            },
          },
          { text: "Close", style: "cancel" },
        ]);
      } else {
        Alert.alert(
          "Lock request",
          `${otherUser.username} wants to lock this chat exclusively. While locked, you can only message each other.`,
          [
            {
              text: "Confirm",
              onPress: async () => {
                await confirmLock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              },
            },
            {
              text: "Decline",
              style: "destructive",
              onPress: async () => {
                await rejectLock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              },
            },
          ]
        );
      }
      return;
    }

    Alert.alert(
      "Lock this chat?",
      `You and ${otherUser.username} will only be able to message each other until you both agree to unlock.`,
      [
        {
          text: "Request lock",
          onPress: async () => {
            try {
              await requestLock(conversationId);
              notifyLockChange();
              fetchLockStatus();
            } catch (error) {
              Alert.alert("Error", error.response?.data?.message || error.message);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const renderBanner = () => {
    if (initialReadOnly) {
      return (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>🔒 You're locked with another contact. This chat is read-only.</Text>
        </View>
      );
    }

    if (!lockStatus) return null;

    if (lockStatus.unlockRequestedBy) {
      const isMine = lockStatus.unlockRequestedBy === user._id;
      if (isMine) {
        return (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Waiting for {otherUser.username} to confirm unlock…</Text>
          </View>
        );
      }
      return (
        <View style={styles.bannerAction}>
          <Text style={styles.bannerText}>{otherUser.username} wants to unlock this chat</Text>
          <View style={styles.bannerButtons}>
            <TouchableOpacity
              onPress={async () => {
                await confirmUnlock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              }}
              style={styles.bannerBtnConfirm}
            >
              <Text style={styles.bannerBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await rejectUnlock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              }}
              style={styles.bannerBtnDecline}
            >
              <Text style={styles.bannerBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (lockStatus.lockRequestedBy) {
      const isMine = lockStatus.lockRequestedBy === user._id;
      if (isMine) {
        return (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Waiting for {otherUser.username} to confirm lock…</Text>
          </View>
        );
      }
      return (
        <View style={styles.bannerAction}>
          <Text style={styles.bannerText}>{otherUser.username} wants to lock this chat exclusively</Text>
          <View style={styles.bannerButtons}>
            <TouchableOpacity
              onPress={async () => {
                await confirmLock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              }}
              style={styles.bannerBtnConfirm}
            >
              <Text style={styles.bannerBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await rejectLock(conversationId);
                notifyLockChange();
                fetchLockStatus();
              }}
              style={styles.bannerBtnDecline}
            >
              <Text style={styles.bannerBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  const initials = (name) => name?.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.replace("Calculator")} style={styles.backBtn}>
          <Text style={styles.backText}>🔒</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate("Profile")} activeOpacity={0.7}>
          {otherUser.profilePicUrl ? (
            <Image source={{ uri: otherUser.profilePicUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials(otherUser.username)}</Text>
            </View>
          )}
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>{otherUser.username}</Text>
            <Text style={styles.headerStatus}>
              {otherUser.isOnline ? "Online" : "Offline"} · 🔒 Encrypted{lockStatus?.locked ? " · Locked" : ""}
            </Text>
          </View>
        </TouchableOpacity>

        {!initialReadOnly && (
          <TouchableOpacity onPress={handleLockMenu} style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>{lockStatus?.locked ? "🔐" : "🔓"}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.profileBtn}>
          <Text style={styles.profileBtnText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {renderBanner()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
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
                message={item}
                isOwnMessage={item.sender === user._id}
                onReply={handleReply}
                onReact={handleReact}
                onDelete={handleDelete}
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

        {replyingTo && !initialReadOnly ? (
          <View style={styles.replyPreviewBar}>
            <View style={styles.replyPreviewLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyPreviewLabel}>
                Replying to {replyingTo.sender === user._id ? "yourself" : otherUser.username}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyingTo.imageUrl ? "📷 Photo" : replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCancelBtn}>
              <Text style={styles.replyCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {initialReadOnly ? (
          <View style={[styles.readOnlyBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <Text style={styles.readOnlyText}>This chat is read-only right now</Text>
          </View>
        ) : (
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <TouchableOpacity onPress={pickAndSendImage} style={styles.imageButton} disabled={uploading}>
              <Text style={styles.imageButtonText}>{uploading ? "…" : "＋"}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity onPress={sendTextMessage} style={styles.sendButton} activeOpacity={0.8}>
              <Text style={styles.sendButtonText}>↑</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  backText: { fontSize: 20 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerAvatar: { width: 36, height: 36, borderRadius: radius.full },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700" },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  headerStatus: { color: colors.textMuted, fontSize: 12 },
  profileBtn: { padding: spacing.xs },
  profileBtnText: { fontSize: 20 },
  banner: { backgroundColor: colors.surfaceAlt, padding: spacing.sm, alignItems: "center" },
  bannerAction: { backgroundColor: colors.surfaceAlt, padding: spacing.sm },
  bannerText: { color: colors.text, fontSize: 12, textAlign: "center" },
  bannerButtons: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  bannerBtnConfirm: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm },
  bannerBtnDecline: { backgroundColor: colors.danger, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm },
  bannerBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingMore: { paddingVertical: spacing.md, alignItems: "center" },
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
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imageButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  imageButtonText: { color: colors.accentSoft, fontSize: 20, fontWeight: "600" },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  readOnlyBar: { padding: spacing.md, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border },
  readOnlyText: { color: colors.textFaint, fontSize: 13, fontStyle: "italic" },
});

export default ChatScreen;