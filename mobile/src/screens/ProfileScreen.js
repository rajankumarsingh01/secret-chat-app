import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { registerPublicKey } from "../services/keys";
import { colors, spacing, radius, typography } from "../theme";

const ProfileScreen = ({ navigation }) => {
  const { user, setUser, logout } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickAndUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", { uri: asset.uri, type: "image/jpeg", name: "profile.jpg" });
      const response = await api.post("/users/profile-pic", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser({ ...user, profilePicUrl: response.data.profilePicUrl });
    } catch (error) {
      Alert.alert("Upload failed", error.response?.data?.message || error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRetryKeySetup = async () => {
    try {
      await registerPublicKey();
      Alert.alert("Success", "Encryption key registered successfully");
    } catch (error) {
      Alert.alert("Failed", error.response?.data?.message || error.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace("Calculator");
  };

  const initials = (name) => name?.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <TouchableOpacity onPress={pickAndUploadProfilePic} disabled={uploading} activeOpacity={0.85}>
          {uploading ? (
            <View style={styles.avatarLarge}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : user?.profilePicUrl ? (
            <Image source={{ uri: user.profilePicUrl }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarInitialLarge}>{initials(user?.username)}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.hint}>Tap photo to change</Text>

        <TouchableOpacity onPress={handleRetryKeySetup} style={styles.unpairButton} activeOpacity={0.85}>
          <Text style={styles.unpairText}>Fix encryption setup</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  backBtn: { paddingVertical: spacing.sm },
  backText: { color: colors.accentSoft, fontSize: 16, fontWeight: "600" },
  center: { alignItems: "center", marginTop: spacing.xl },
  avatarLarge: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialLarge: { color: colors.accentSoft, fontSize: 44, fontWeight: "700" },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.bg,
  },
  editBadgeText: { color: "#fff", fontSize: 14 },
  username: { ...typography.h2, marginTop: spacing.lg },
  hint: { ...typography.caption, marginTop: 4, marginBottom: spacing.xl },
  logoutButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  logoutText: { color: colors.danger, fontWeight: "700" },
  unpairButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  unpairText: { color: colors.textMuted, fontWeight: "600" },
});

export default ProfileScreen;