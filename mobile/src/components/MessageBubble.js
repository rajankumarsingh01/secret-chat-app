// mobile/src/components/MessageBubble.js
import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { colors, radius } from "../theme";

const Tick = ({ status }) => {
  // status: "sent" | "delivered" | "read"
  if (status === "read") return <Text style={styles.tickRead}>✓✓</Text>;
  if (status === "delivered") return <Text style={styles.tickGray}>✓✓</Text>;
  return <Text style={styles.tickGray}>✓</Text>;
};

const MessageBubble = ({ message, isOwnMessage, onReply, onDelete, onReact }) => {
  const status = message.isRead ? "read" : message.isDelivered ? "delivered" : "sent";

  const handleLongPress = () => {
    const options = [
      { text: "Reply", onPress: () => onReply(message) },
      { text: "React 😊", onPress: () => onReact(message) },
    ];
    if (isOwnMessage && !message.deletedForEveryone) {
      options.push({ text: "Delete for everyone", style: "destructive", onPress: () => onDelete(message, "everyone") });
    }
    options.push({ text: "Delete for me", style: "destructive", onPress: () => onDelete(message, "me") });
    options.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Message options", "", options);
  };

  if (message.deletedForEveryone) {
    return (
      <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}>
        <View style={[styles.bubble, styles.deletedBubble]}>
          <Text style={styles.deletedText}>🚫 This message was deleted</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={handleLongPress}
        style={[
          styles.bubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
          isOwnMessage ? styles.tailOwn : styles.tailOther,
        ]}
      >
        {message.replyTo ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyAuthor} numberOfLines={1}>
              {message.replyTo.sender === message.sender ? "You" : "Original message"}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {message.replyTo.deletedForEveryone
                ? "Original message deleted"
                : message.replyTo.imageUrl
                ? "📷 Photo"
                : message.replyTo.text || "..."}
            </Text>
          </View>
        ) : null}

        {message.imageUrl ? (
          <Image source={{ uri: message.imageUrl }} style={styles.image} />
        ) : null}
        {message.text ? (
          <Text style={isOwnMessage ? styles.ownText : styles.otherText}>{message.text}</Text>
        ) : null}

        <View style={styles.footerRow}>
          <Text style={[styles.time, isOwnMessage ? styles.timeOwn : styles.timeOther]}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {isOwnMessage && <Tick status={status} />}
        </View>

        {message.reaction ? (
          <View style={styles.reactionBadge}>
            <Text style={styles.reactionText}>{message.reaction}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { width: "100%", marginVertical: 2 },
  rowOwn: { alignItems: "flex-end" },
  rowOther: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "80%",
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 7,
  },
  ownBubble: { backgroundColor: colors.bubbleOwn },
  otherBubble: { backgroundColor: colors.bubbleOther },
  tailOwn: { borderTopRightRadius: 0 },
  tailOther: { borderTopLeftRadius: 0 },
  ownText: { color: colors.text, fontSize: 15.5, lineHeight: 20, paddingHorizontal: 4 },
  otherText: { color: colors.text, fontSize: 15.5, lineHeight: 20, paddingHorizontal: 4 },
  image: { width: 220, height: 220, borderRadius: radius.sm, marginBottom: 6 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 2,
    paddingLeft: 12,
  },
  time: { fontSize: 11 },
  timeOwn: { color: colors.textMuted },
  timeOther: { color: colors.textFaint },
  tickGray: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
  tickRead: { fontSize: 12, color: colors.accentSoft, marginLeft: 4 },
  replyBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3,
    borderLeftColor: colors.accentSoft,
    borderRadius: 6,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    marginBottom: 6,
  },
  replyAuthor: { fontSize: 12.5, color: colors.accentSoft, fontWeight: "700", marginBottom: 1 },
  replyText: { fontSize: 12.5, color: colors.textMuted },
  reactionBadge: {
    position: "absolute",
    bottom: -10,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionText: { fontSize: 12 },
  deletedBubble: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deletedText: { color: colors.textFaint, fontStyle: "italic", fontSize: 13 },
});

export default MessageBubble;