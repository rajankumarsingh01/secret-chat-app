// mobile/src/screens/ChatScreen.js
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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ScreenCapture from "expo-screen-capture";
import { Audio } from "expo-av";
import api from "../services/api";
import VoiceMessagePlayer, { formatDuration } from "../components/VoiceMessagePlayer";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
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
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [viewOnceModal, setViewOnceModal] = useState(null);
  const [partnerOnline, setPartnerOnline] = useState(!!otherUser.isOnline);
  const [screenshotNotice, setScreenshotNotice] = useState(false);
  const recordingRef = useRef(null);
  const recordTimerRef = useRef(null);
  const socket = getSocket();
  const { startCall } = useCall();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    init();
    fetchLockStatus();
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // Detects when THIS device takes a screenshot of the chat and tells the other
  // participant it happened. We never see the screenshot's content — only the OS
  // event that it was taken — so nothing sensitive is transmitted, just the fact.
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      if (socket) socket.emit("screenshot_taken", { otherUserId: otherUser._id });
    });
    return () => subscription.remove();
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = ({ userId, isOnline }) => {
      if (userId === otherUser._id) setPartnerOnline(isOnline);
    };

    // Auto-dismissing local banner — shown only to the person whose screen was
    // captured, never any content, just the fact that it happened.
    const handleScreenshotNotice = () => {
      setScreenshotNotice(true);
      setTimeout(() => setScreenshotNotice(false), 4000);
    };

    // Fires on every (re)connection. On the very first connect this just re-does
    // what fetchInitialHistory already did (harmless); after a dropped connection
    // it catches up any messages the socket missed while offline — important on
    // free-tier hosting where the backend can fully restart, wiping in-memory state.
    const handleReconnect = () => {
      if (mySecretKey) fetchInitialHistory({ merge: true });
    };

    socket.on("receive_message", handleIncomingMessage);
    socket.on("message_delivered", handleDelivered);
    socket.on("message_reacted", handleReacted);
    socket.on("message_deleted_sync", handleDeletedSync);
    socket.on("view_once_opened_sync", handleViewOnceSync);
    socket.on("lock_state_sync", fetchLockStatus);
    socket.on("user_status_changed", handleStatusChange);
    socket.on("screenshot_notice", handleScreenshotNotice);
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("receive_message", handleIncomingMessage);
      socket.off("message_delivered", handleDelivered);
      socket.off("message_reacted", handleReacted);
      socket.off("message_deleted_sync", handleDeletedSync);
      socket.off("view_once_opened_sync", handleViewOnceSync);
      socket.off("lock_state_sync", fetchLockStatus);
      socket.off("user_status_changed", handleStatusChange);
      socket.off("screenshot_notice", handleScreenshotNotice);
      socket.off("connect", handleReconnect);
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
    if (message.imageUrl || message.audioUrl || message.deletedForEveryone || message.viewOnce) return message;
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
      prev.map((m) => (m._id === messageId ? { ...m, deletedForEveryone: true, text: "", imageUrl: "", audioUrl: "" } : m))
    );
  };

  // Fired when either side opens a view-once message — the media is gone from
  // the server now, so both bubbles must stop showing it immediately.
  const handleViewOnceSync = ({ messageId }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, viewOnceOpened: true, imageUrl: "", audioUrl: "" } : m))
    );
  };

  useEffect(() => {
    if (mySecretKey) fetchInitialHistory();
  }, [mySecretKey]);

  // merge:true is used on socket reconnect — it fetches just the latest page and
  // stitches it onto whatever's already loaded (instead of wiping older, already
  // paginated-in messages), deduping by _id.
  const fetchInitialHistory = async ({ merge = false } = {}) => {
    try {
      const response = await api.get(`/chat/${otherUser._id}`, { params: { limit: PAGE_SIZE } });
      const decrypted = response.data.messages.map((m) => decryptForDisplay(m, mySecretKey));

      if (merge) {
        setMessages((prev) => {
          const freshIds = new Set(decrypted.map((m) => m._id));
          const oldestFreshTime = decrypted.length
            ? new Date(decrypted[decrypted.length - 1].createdAt).getTime()
            : 0;
          // Keep older messages we already had (from pagination) that the fresh
          // page doesn't cover, drop anything the fresh page already re-fetched.
          const olderKept = prev.filter(
            (m) => !freshIds.has(m._id) && new Date(m.createdAt).getTime() < oldestFreshTime
          );
          return [...decrypted, ...olderKept];
        });
      } else {
        setMessages(decrypted);
        setHasMore(response.data.hasMore);
      }

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
          mediaPublicId: response.data.mediaPublicId,
          viewOnce: viewOnceMode,
          replyTo: replyingTo?._id || null,
        });
      }
      setReplyingTo(null);
      setViewOnceMode(false);
    } catch (error) {
      Alert.alert("Upload failed", error.response?.data?.message || error.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Voice messages ────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (initialReadOnly || isRecording) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow microphone access to record voice messages");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordSeconds(0);
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (error) {
      Alert.alert("Recording failed", error.message);
    }
  };

  const stopRecording = async ({ send }) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);

    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    const durationSec = recordSeconds;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (send && uri && durationSec >= 1) {
        await sendVoiceMessage(uri, durationSec);
      }
    } catch (error) {
      console.log("Stop recording error:", error.message);
    }
  };

  const sendVoiceMessage = async (uri, durationSec) => {
    if (initialReadOnly) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", { uri, type: "audio/m4a", name: "voice-message.m4a" });
      formData.append("duration", String(durationSec));
      const response = await api.post("/chat/upload-voice", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (socket) {
        socket.emit("send_message", {
          receiver: otherUser._id,
          audioUrl: response.data.audioUrl,
          audioDuration: response.data.audioDuration,
          mediaPublicId: response.data.mediaPublicId,
          viewOnce: viewOnceMode,
          replyTo: replyingTo?._id || null,
        });
      }
      setReplyingTo(null);
      setViewOnceMode(false);
    } catch (error) {
      Alert.alert("Upload failed", error.response?.data?.message || error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      stopRecording({ send: true });
    } else {
      startRecording();
    }
  };

  const cancelRecording = () => stopRecording({ send: false });

  // ── View-once media ───────────────────────────────────────────────────────

  const handleOpenViewOnce = async (message) => {
    if (message.viewOnceOpened) return;
    // Show it using the copy we already have client-side, then tell the server
    // to delete it — once this resolves (or the modal is closed) it's gone for good.
    setViewOnceModal({ ...message });
    setMessages((prev) =>
      prev.map((m) => (m._id === message._id ? { ...m, viewOnceOpened: true, imageUrl: "", audioUrl: "" } : m))
    );
    try {
      await api.post(`/chat/${message._id}/view-once`);
    } catch (error) {
      console.log("Error opening view-once message:", error.message);
    }
    if (socket) socket.emit("view_once_opened", { messageId: message._id, otherUserId: otherUser._id });
  };

  const closeViewOnceModal = () => setViewOnceModal(null);

  const toggleViewOnceMode = () => {
    if (initialReadOnly) return;
    setViewOnceMode((prev) => !prev);
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
          prev.map((m) => (m._id === message._id ? { ...m, deletedForEveryone: true, text: "", imageUrl: "", audioUrl: "" } : m))
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.replace("Calculator")} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate("Profile")} activeOpacity={0.7}>
          {otherUser.profilePicUrl ? (
            <Image source={{ uri: otherUser.profilePicUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials(otherUser.username)}</Text>
            </View>
          )}
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{otherUser.username}</Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {partnerOnline ? "online" : "offline"}{lockStatus?.locked ? " · 🔒 locked" : ""}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!initialReadOnly && (
            <>
              <TouchableOpacity onPress={() => startCall(otherUser, "video")} style={styles.headerIconBtn}>
                <Text style={styles.headerIconText}>📹</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startCall(otherUser, "audio")} style={styles.headerIconBtn}>
                <Text style={styles.headerIconText}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLockMenu} style={styles.headerIconBtn}>
                <Text style={styles.headerIconText}>{lockStatus?.locked ? "🔐" : "🔓"}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderBanner()}
      {screenshotNotice && (
        <View style={styles.screenshotBanner}>
          <Text style={styles.screenshotBannerText}>📸 {otherUser.username} took a screenshot</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {/* Chat wallpaper background */}
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
                  message={item}
                  isOwnMessage={item.sender === user._id}
                  onReply={handleReply}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onOpenViewOnce={handleOpenViewOnce}
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

        {replyingTo && !initialReadOnly ? (
          <View style={styles.replyPreviewBar}>
            <View style={styles.replyPreviewLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyPreviewLabel}>
                Replying to {replyingTo.sender === user._id ? "yourself" : otherUser.username}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyingTo.viewOnce ? "🔥 View once message" : replyingTo.audioUrl ? "🎤 Voice message" : replyingTo.imageUrl ? "📷 Photo" : replyingTo.text}
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
        ) : isRecording ? (
          <View style={[styles.recordingRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancelBtn}>
              <Text style={styles.recordingCancelText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.recordingPill}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording… {formatDuration(recordSeconds)}</Text>
            </View>
            <TouchableOpacity onPress={handleMicPress} style={styles.sendButton} activeOpacity={0.8}>
              <Text style={styles.sendButtonText}>⏹</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <TouchableOpacity
              onPress={toggleViewOnceMode}
              style={[styles.viewOnceToggle, viewOnceMode && styles.viewOnceToggleActive]}
            >
              <Text style={styles.viewOnceToggleText}>🔥</Text>
            </TouchableOpacity>
            <View style={styles.inputPill}>
              <TouchableOpacity onPress={pickAndSendImage} disabled={uploading} style={styles.attachBtn}>
                <Text style={styles.attachBtnText}>{uploading ? "…" : "📎"}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={viewOnceMode ? "View once photo/voice…" : "Message"}
                placeholderTextColor={colors.textFaint}
                value={text}
                onChangeText={setText}
                multiline
              />
              {!text.trim() && (
                <TouchableOpacity onPress={pickAndSendImage} disabled={uploading} style={styles.cameraBtn}>
                  <Text style={styles.attachBtnText}>📷</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={text.trim() ? sendTextMessage : handleMicPress}
              style={styles.sendButton}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>{text.trim() ? "➤" : "🎤"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={!!viewOnceModal} transparent animationType="fade" onRequestClose={closeViewOnceModal}>
        <View style={styles.viewOnceOverlay}>
          <TouchableOpacity onPress={closeViewOnceModal} style={styles.viewOnceCloseBtn}>
            <Text style={styles.viewOnceCloseText}>✕</Text>
          </TouchableOpacity>
          {viewOnceModal?.imageUrl ? (
            <Image source={{ uri: viewOnceModal.imageUrl }} style={styles.viewOnceImage} resizeMode="contain" />
          ) : viewOnceModal?.audioUrl ? (
            <View style={styles.viewOnceAudioCard}>
              <VoiceMessagePlayer
                uri={viewOnceModal.audioUrl}
                duration={viewOnceModal.audioDuration}
                isOwnMessage={false}
              />
            </View>
          ) : null}
          <Text style={styles.viewOnceHint}>This will disappear once you close it</Text>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.headerBg },
  wallpaper: { flex: 1, backgroundColor: colors.bg },

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
  headerAvatar: { width: 38, height: 38, borderRadius: radius.full },
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
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerIconBtn: { padding: spacing.sm },
  headerIconText: { fontSize: 19, color: colors.text },

  banner: { backgroundColor: colors.surfaceAlt, padding: spacing.sm, alignItems: "center" },
  screenshotBanner: { backgroundColor: colors.danger, padding: spacing.sm, alignItems: "center" },
  screenshotBannerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
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
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  attachBtn: { padding: spacing.xs, transform: [{ rotate: "-30deg" }] },
  cameraBtn: { padding: spacing.xs },
  attachBtnText: { fontSize: 20 },
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
    marginBottom: 0,
  },
  sendButtonText: { color: "#fff", fontSize: 18 },

  readOnlyBar: { padding: spacing.md, alignItems: "center", backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  readOnlyText: { color: colors.textFaint, fontSize: 13, fontStyle: "italic" },

  viewOnceToggle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.xs,
    opacity: 0.4,
  },
  viewOnceToggleActive: { opacity: 1, backgroundColor: colors.surfaceAlt },
  viewOnceToggleText: { fontSize: 18 },

  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  recordingCancelBtn: { padding: spacing.sm, marginRight: spacing.xs },
  recordingCancelText: { color: colors.textMuted, fontSize: 18 },
  recordingPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginRight: spacing.sm },
  recordingText: { color: colors.text, fontSize: 14.5 },

  viewOnceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  viewOnceCloseBtn: { position: "absolute", top: 50, right: spacing.lg, padding: spacing.sm, zIndex: 1 },
  viewOnceCloseText: { color: "#fff", fontSize: 22 },
  viewOnceImage: { width: "100%", height: "70%" },
  viewOnceAudioCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minWidth: 260,
  },
  viewOnceHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.lg, textAlign: "center" },
});

export default ChatScreen;