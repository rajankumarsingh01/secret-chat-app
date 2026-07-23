// mobile/src/components/CallOverlay.js
// Renders on top of the whole app (see App.js) whenever a call is ringing or
// active — this way a call UI shows up no matter which screen you're on,
// exactly like a native phone call.
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCall } from "../context/CallContext";
import { colors, spacing, radius } from "../theme";

// Same defensive require as CallContext — RTCView's native module doesn't
// exist in Expo Go. callState never leaves "idle" there (CallContext blocks
// it), so this overlay never actually needs to render RTCView in that case,
// but we still guard the import itself so it can't crash app boot.
let RTCView = View;
try {
  RTCView = require("react-native-webrtc").RTCView;
} catch (error) {
  // stays as plain View fallback
}

const formatDuration = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const initials = (name) => name?.charAt(0).toUpperCase() || "?";

const CallOverlay = () => {
  const {
    callState,
    callType,
    otherUser,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  } = useCall();
  const insets = useSafeAreaInsets();

  if (callState === "idle" || !otherUser) return null;

  const isVideo = callType === "video";
  const isIncoming = callState === "incoming";
  const isConnected = callState === "connected";

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {isVideo && isConnected && remoteStream ? (
          <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.darkBg]} />
        )}

        {isVideo && isConnected && localStream && !isCameraOff && (
          <RTCView
            streamURL={localStream.toURL()}
            style={[styles.selfPreview, { top: insets.top + spacing.lg }]}
            objectFit="cover"
            mirror
          />
        )}

        <View style={[styles.topInfo, { paddingTop: insets.top + spacing.xl }]}>
          {otherUser.profilePicUrl ? (
            <Image source={{ uri: otherUser.profilePicUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials(otherUser.username)}</Text>
            </View>
          )}
          <Text style={styles.username}>{otherUser.username}</Text>
          <Text style={styles.status}>
            {isIncoming
              ? `Incoming ${isVideo ? "video" : "voice"} call…`
              : callState === "outgoing"
              ? "Ringing…"
              : isConnected
              ? formatDuration(callDuration)
              : ""}
          </Text>
        </View>

        <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
          {isIncoming ? (
            <View style={styles.incomingRow}>
              <TouchableOpacity onPress={rejectCall} style={[styles.circleBtn, styles.rejectBtn]}>
                <Text style={styles.circleBtnIcon}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptCall} style={[styles.circleBtn, styles.acceptBtn]}>
                <Text style={styles.circleBtnIcon}>✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.activeRow}>
              <TouchableOpacity onPress={toggleMute} style={[styles.smallBtn, isMuted && styles.smallBtnActive]}>
                <Text style={styles.smallBtnIcon}>{isMuted ? "🔇" : "🎙️"}</Text>
              </TouchableOpacity>
              {isVideo && (
                <TouchableOpacity onPress={toggleCamera} style={[styles.smallBtn, isCameraOff && styles.smallBtnActive]}>
                  <Text style={styles.smallBtnIcon}>{isCameraOff ? "📷" : "📹"}</Text>
                </TouchableOpacity>
              )}
              {isVideo && (
                <TouchableOpacity onPress={switchCamera} style={styles.smallBtn}>
                  <Text style={styles.smallBtnIcon}>🔄</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={endCall} style={[styles.circleBtn, styles.rejectBtn]}>
                <Text style={styles.circleBtnIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  darkBg: { backgroundColor: colors.bg },
  selfPreview: {
    position: "absolute",
    right: spacing.lg,
    width: 100,
    height: 140,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  topInfo: { alignItems: "center" },
  avatar: { width: 96, height: 96, borderRadius: radius.full, marginBottom: spacing.md },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "700" },
  username: { color: colors.text, fontSize: 22, fontWeight: "600" },
  status: { color: colors.textMuted, fontSize: 15, marginTop: spacing.xs },

  controls: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  incomingRow: { flexDirection: "row", justifyContent: "space-between", width: "70%" },
  activeRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },

  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: { backgroundColor: colors.online },
  rejectBtn: { backgroundColor: colors.danger },
  circleBtnIcon: { fontSize: 26, color: "#fff", fontWeight: "700" },

  smallBtn: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  smallBtnActive: { backgroundColor: colors.accent },
  smallBtnIcon: { fontSize: 22 },
});

export default CallOverlay;