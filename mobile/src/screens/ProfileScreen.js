// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   Image,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   SafeAreaView,
//   ScrollView,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import * as ImagePicker from "expo-image-picker";
// import api from "../services/api";
// import { useAuth } from "../context/AuthContext";
// import { registerPublicKey } from "../services/keys";
// import {
//   hasCustomUnlockCode,
//   setUnlockCode,
//   hasPanicCode,
//   setPanicCode,
//   clearPanicCode,
//   hasDecoyCode,
//   setDecoyCode,
//   clearDecoyCode,
//   collidesWithOtherCodes,
// } from "../services/secretCodes";
// import { colors, spacing, radius, typography } from "../theme";

// const CODE_PATTERN = /^[0-9]{3,10}$/; // digits only, 3–10 long — matches what the calculator keypad can type

// const ProfileScreen = ({ navigation }) => {
//   const { user, setUser, logout } = useAuth();
//   const [uploading, setUploading] = useState(false);

//   const [customUnlockSet, setCustomUnlockSet] = useState(false);
//   const [panicSet, setPanicSet] = useState(false);
//   const [decoySet, setDecoySet] = useState(false);

//   const [unlockCode, setUnlockCodeInput] = useState("");
//   const [unlockConfirm, setUnlockConfirm] = useState("");
//   const [savingUnlock, setSavingUnlock] = useState(false);

//   const [panicCode, setPanicCodeInput] = useState("");
//   const [panicConfirm, setPanicConfirm] = useState("");
//   const [savingPanic, setSavingPanic] = useState(false);

//   const [decoyCode, setDecoyCodeInput] = useState("");
//   const [decoyConfirm, setDecoyConfirm] = useState("");
//   const [savingDecoy, setSavingDecoy] = useState(false);

//   useEffect(() => {
//     (async () => {
//       setCustomUnlockSet(await hasCustomUnlockCode());
//       setPanicSet(await hasPanicCode());
//       setDecoySet(await hasDecoyCode());
//     })();
//   }, []);

//   const handleSaveUnlockCode = async () => {
//     if (!CODE_PATTERN.test(unlockCode)) {
//       Alert.alert("Invalid code", "Use 3–10 digits only.");
//       return;
//     }
//     if (unlockCode !== unlockConfirm) {
//       Alert.alert("Doesn't match", "Both entries must be the same.");
//       return;
//     }
//     if (await collidesWithOtherCodes(unlockCode, "unlock")) {
//       Alert.alert("Code already in use", "This matches your panic or decoy code. Pick a different one.");
//       return;
//     }
//     setSavingUnlock(true);
//     try {
//       await setUnlockCode(unlockCode);
//       setCustomUnlockSet(true);
//       setUnlockCodeInput("");
//       setUnlockConfirm("");
//       Alert.alert("Saved", "Unlock code updated. It's stored only on this device.");
//     } catch (error) {
//       Alert.alert("Failed", error.message);
//     } finally {
//       setSavingUnlock(false);
//     }
//   };

//   const handleSavePanicCode = async () => {
//     if (!CODE_PATTERN.test(panicCode)) {
//       Alert.alert("Invalid code", "Use 3–10 digits only.");
//       return;
//     }
//     if (panicCode !== panicConfirm) {
//       Alert.alert("Doesn't match", "Both entries must be the same.");
//       return;
//     }
//     if (await collidesWithOtherCodes(panicCode, "panic")) {
//       Alert.alert("Code already in use", "This matches your unlock or decoy code. Pick a different one.");
//       return;
//     }
//     setSavingPanic(true);
//     try {
//       await setPanicCode(panicCode);
//       setPanicSet(true);
//       setPanicCodeInput("");
//       setPanicConfirm("");
//       Alert.alert(
//         "Saved",
//         "Panic wipe code set. Typing it on the calculator + \"=\" will instantly and silently delete this device's session, keys, and codes — with no warning shown. Make sure you'll remember it, and that it's different from your unlock code."
//       );
//     } catch (error) {
//       Alert.alert("Failed", error.message);
//     } finally {
//       setSavingPanic(false);
//     }
//   };

//   const handleClearPanicCode = () => {
//     Alert.alert("Turn off panic wipe?", "The duress code will no longer wipe this device.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Turn off",
//         style: "destructive",
//         onPress: async () => {
//           await clearPanicCode();
//           setPanicSet(false);
//         },
//       },
//     ]);
//   };

//   const handleSaveDecoyCode = async () => {
//     if (!CODE_PATTERN.test(decoyCode)) {
//       Alert.alert("Invalid code", "Use 3–10 digits only.");
//       return;
//     }
//     if (decoyCode !== decoyConfirm) {
//       Alert.alert("Doesn't match", "Both entries must be the same.");
//       return;
//     }
//     if (await collidesWithOtherCodes(decoyCode, "decoy")) {
//       Alert.alert("Code already in use", "This matches your unlock or panic code. Pick a different one.");
//       return;
//     }
//     setSavingDecoy(true);
//     try {
//       await setDecoyCode(decoyCode);
//       setDecoySet(true);
//       setDecoyCodeInput("");
//       setDecoyConfirm("");
//       Alert.alert(
//         "Saved",
//         "Decoy code set. Typing it on the calculator opens a fake, empty-looking chat list instead of your real chats — your real account stays completely hidden behind it."
//       );
//     } catch (error) {
//       Alert.alert("Failed", error.message);
//     } finally {
//       setSavingDecoy(false);
//     }
//   };

//   const handleClearDecoyCode = () => {
//     Alert.alert("Turn off decoy mode?", "This code will no longer open the fake chat list.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Turn off",
//         style: "destructive",
//         onPress: async () => {
//           await clearDecoyCode();
//           setDecoySet(false);
//         },
//       },
//     ]);
//   };

//   const pickAndUploadProfilePic = async () => {
//     const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
//     if (!permission.granted) {
//       Alert.alert("Permission needed", "Allow photo access");
//       return;
//     }
//     const result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ImagePicker.MediaTypeOptions.Images,
//       quality: 0.7,
//       allowsEditing: true,
//       aspect: [1, 1],
//     });
//     if (result.canceled) return;

//     const asset = result.assets[0];
//     setUploading(true);
//     try {
//       const formData = new FormData();
//       formData.append("image", { uri: asset.uri, type: "image/jpeg", name: "profile.jpg" });
//       const response = await api.post("/users/profile-pic", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       setUser({ ...user, profilePicUrl: response.data.profilePicUrl });
//     } catch (error) {
//       Alert.alert("Upload failed", error.response?.data?.message || error.message);
//     } finally {
//       setUploading(false);
//     }
//   };

//   const handleRetryKeySetup = async () => {
//     try {
//       await registerPublicKey();
//       Alert.alert("Success", "Encryption key registered successfully");
//     } catch (error) {
//       Alert.alert("Failed", error.response?.data?.message || error.message);
//     }
//   };

//   const handleLogout = async () => {
//     await logout();
//     navigation.replace("Calculator");
//   };

//   const initials = (name) => name?.charAt(0).toUpperCase();

//   return (
//     <SafeAreaView style={styles.container}>
//       <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
//         <Text style={styles.backText}>‹ Back</Text>
//       </TouchableOpacity>

//       <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
//         <View style={styles.center}>
//           <TouchableOpacity onPress={pickAndUploadProfilePic} disabled={uploading} activeOpacity={0.85}>
//             {uploading ? (
//               <View style={styles.avatarLarge}>
//                 <ActivityIndicator color={colors.accent} />
//               </View>
//             ) : user?.profilePicUrl ? (
//               <Image source={{ uri: user.profilePicUrl }} style={styles.avatarLarge} />
//             ) : (
//               <View style={styles.avatarLarge}>
//                 <Text style={styles.avatarInitialLarge}>{initials(user?.username)}</Text>
//               </View>
//             )}
//             <View style={styles.editBadge}>
//               <Text style={styles.editBadgeText}>✎</Text>
//             </View>
//           </TouchableOpacity>

//           <Text style={styles.username}>{user?.username}</Text>
//           <Text style={styles.hint}>Tap photo to change</Text>

//           <TouchableOpacity onPress={handleRetryKeySetup} style={styles.unpairButton} activeOpacity={0.85}>
//             <Text style={styles.unpairText}>Fix encryption setup</Text>
//           </TouchableOpacity>
//         </View>

//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Calculator unlock code</Text>
//           <Text style={styles.sectionHint}>
//             {customUnlockSet
//               ? "A custom code is set on this device."
//               : 'Using the default "123" — set your own below.'}
//           </Text>
//           <TextInput
//             style={styles.input}
//             placeholder="New unlock code (3–10 digits)"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={unlockCode}
//             onChangeText={setUnlockCodeInput}
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="Confirm code"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={unlockConfirm}
//             onChangeText={setUnlockConfirm}
//           />
//           <TouchableOpacity
//             onPress={handleSaveUnlockCode}
//             style={styles.saveButton}
//             activeOpacity={0.85}
//             disabled={savingUnlock}
//           >
//             {savingUnlock ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.saveButtonText}>Save unlock code</Text>
//             )}
//           </TouchableOpacity>
//         </View>

//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Panic wipe code</Text>
//           <Text style={styles.sectionHint}>
//             {panicSet
//               ? "Enabled. Typing this code on the calculator instantly and silently wipes this device — no warning shown."
//               : "Off by default. Optional — set a separate code that instantly wipes this device's chats, keys, and codes with no warning."}
//           </Text>
//           <TextInput
//             style={styles.input}
//             placeholder="New panic code (3–10 digits)"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={panicCode}
//             onChangeText={setPanicCodeInput}
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="Confirm code"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={panicConfirm}
//             onChangeText={setPanicConfirm}
//           />
//           <TouchableOpacity
//             onPress={handleSavePanicCode}
//             style={styles.saveButton}
//             activeOpacity={0.85}
//             disabled={savingPanic}
//           >
//             {savingPanic ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.saveButtonText}>{panicSet ? "Change panic code" : "Set panic code"}</Text>
//             )}
//           </TouchableOpacity>

//           {panicSet && (
//             <TouchableOpacity onPress={handleClearPanicCode} style={styles.turnOffButton} activeOpacity={0.85}>
//               <Text style={styles.turnOffText}>Turn off panic wipe</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Decoy code</Text>
//           <Text style={styles.sectionHint}>
//             {decoySet
//               ? "Enabled. Typing this code on the calculator opens a fake, empty-looking chat list — your real chats stay hidden."
//               : "Off by default. Optional — set a separate code that opens a harmless fake chat list instead of your real one."}
//           </Text>
//           <TextInput
//             style={styles.input}
//             placeholder="New decoy code (3–10 digits)"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={decoyCode}
//             onChangeText={setDecoyCodeInput}
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="Confirm code"
//             placeholderTextColor={colors.textFaint}
//             keyboardType="number-pad"
//             secureTextEntry
//             maxLength={10}
//             value={decoyConfirm}
//             onChangeText={setDecoyConfirm}
//           />
//           <TouchableOpacity
//             onPress={handleSaveDecoyCode}
//             style={styles.saveButton}
//             activeOpacity={0.85}
//             disabled={savingDecoy}
//           >
//             {savingDecoy ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.saveButtonText}>{decoySet ? "Change decoy code" : "Set decoy code"}</Text>
//             )}
//           </TouchableOpacity>

//           {decoySet && (
//             <TouchableOpacity onPress={handleClearDecoyCode} style={styles.turnOffButton} activeOpacity={0.85}>
//               <Text style={styles.turnOffText}>Turn off decoy mode</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.85}>
//           <Text style={styles.logoutText}>Log out</Text>
//         </TouchableOpacity>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
//   scrollContent: { paddingBottom: spacing.xl },
//   backBtn: { paddingVertical: spacing.sm },
//   backText: { color: colors.accentSoft, fontSize: 16, fontWeight: "600" },
//   center: { alignItems: "center", marginTop: spacing.xl },
//   section: {
//     marginTop: spacing.xl,
//     backgroundColor: colors.surface,
//     borderRadius: radius.md,
//     padding: spacing.md,
//     borderWidth: 1,
//     borderColor: colors.border,
//   },
//   sectionTitle: { ...typography.bodyBold, marginBottom: 4 },
//   sectionHint: { ...typography.caption, marginBottom: spacing.md },
//   input: {
//     backgroundColor: colors.surfaceAlt,
//     borderRadius: radius.sm,
//     paddingHorizontal: spacing.md,
//     paddingVertical: 12,
//     color: colors.text,
//     fontSize: 15,
//     marginBottom: spacing.sm,
//   },
//   saveButton: {
//     backgroundColor: colors.accent,
//     borderRadius: radius.sm,
//     paddingVertical: 12,
//     alignItems: "center",
//     marginTop: 4,
//   },
//   saveButtonText: { color: "#fff", fontWeight: "700" },
//   turnOffButton: { alignItems: "center", marginTop: spacing.sm, paddingVertical: 6 },
//   turnOffText: { color: colors.danger, fontWeight: "600" },
//   avatarLarge: {
//     width: 128,
//     height: 128,
//     borderRadius: radius.full,
//     backgroundColor: colors.surfaceAlt,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   avatarInitialLarge: { color: colors.accentSoft, fontSize: 44, fontWeight: "700" },
//   editBadge: {
//     position: "absolute",
//     bottom: 4,
//     right: 4,
//     width: 32,
//     height: 32,
//     borderRadius: radius.full,
//     backgroundColor: colors.accent,
//     justifyContent: "center",
//     alignItems: "center",
//     borderWidth: 3,
//     borderColor: colors.bg,
//   },
//   editBadgeText: { color: "#fff", fontSize: 14 },
//   username: { ...typography.h2, marginTop: spacing.lg },
//   hint: { ...typography.caption, marginTop: 4, marginBottom: spacing.xl },
//   logoutButton: {
//     backgroundColor: colors.surface,
//     borderWidth: 1,
//     borderColor: colors.danger,
//     paddingHorizontal: 32,
//     paddingVertical: 14,
//     borderRadius: radius.md,
//     marginTop: spacing.xl,
//   },
//   logoutText: { color: colors.danger, fontWeight: "700" },
//   unpairButton: {
//     backgroundColor: colors.surface,
//     borderWidth: 1,
//     borderColor: colors.border,
//     paddingHorizontal: 32,
//     paddingVertical: 14,
//     borderRadius: radius.md,
//     marginTop: spacing.xl,
//   },
//   unpairText: { color: colors.textMuted, fontWeight: "600" },
// });

// export default ProfileScreen;









import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsButton}
          activeOpacity={0.85}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <Text style={styles.settingsHint}>Unlock PIN, panic code, decoy code</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  scrollContent: { paddingBottom: spacing.xl },
  backBtn: { paddingVertical: spacing.sm },
  backText: { color: colors.accentSoft, fontSize: 16, fontWeight: "600" },
  center: { alignItems: "center", marginTop: spacing.xl },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIcon: { fontSize: 22, marginRight: spacing.md },
  settingsTitle: { ...typography.bodyBold },
  settingsHint: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.sm },
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