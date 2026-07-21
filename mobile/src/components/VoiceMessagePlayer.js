// mobile/src/components/VoiceMessagePlayer.js
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { colors } from "../theme";

export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Plays a single voice note. Keeps its own <Audio.Sound> instance and cleans
// it up on unmount so we don't leak players as the message list scrolls.
const VoiceMessagePlayer = ({ uri, duration, isOwnMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [totalSec, setTotalSec] = useState(duration || 0);
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    setPositionSec(status.positionMillis / 1000);
    if (status.durationMillis) setTotalSec(status.durationMillis / 1000);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionSec(0);
      soundRef.current?.setPositionAsync(0);
    }
  };

  const togglePlay = async () => {
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
        setIsPlaying(true);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Voice playback error:", error.message);
    }
  };

  const progress = totalSec > 0 ? Math.min(1, positionSec / totalSec) : 0;
  const trackColor = isOwnMessage ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)";
  const fillColor = isOwnMessage ? colors.accentSoft : colors.accent;

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: fillColor }]}>
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>
      <View style={styles.middle}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fillColor }]} />
        </View>
        <Text style={styles.duration}>{formatDuration(isPlaying || positionSec > 0 ? positionSec : totalSec)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minWidth: 170, paddingVertical: 4 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  playIcon: { color: "#fff", fontSize: 13 },
  middle: { flex: 1 },
  track: { height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
  duration: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});

export default VoiceMessagePlayer;