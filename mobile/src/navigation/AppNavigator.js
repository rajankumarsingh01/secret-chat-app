import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useAppLock } from "../context/AppLockContext";
import { hasCustomUnlockCode } from "../services/secretCodes";
import { colors } from "../theme";

import CalculatorScreen from "../screens/CalculatorScreen";
import SetupPinScreen from "../screens/SetupPinScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import RecoveryCodeScreen from "../screens/RecoveryCodeScreen";
import ChatListScreen from "../screens/ChatListScreen";
import AddContactScreen from "../screens/AddContactScreen";
import ChatScreen from "../screens/ChatScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import DecoyChatListScreen from "../screens/DecoyChatListScreen";
import DecoyChatScreen from "../screens/DecoyChatScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import GroupInfoScreen from "../screens/GroupInfoScreen";

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { loading } = useAuth();
  const { shouldRelock, clearRelock } = useAppLock();
  const navigationRef = useRef(null);

  // First-ever app open: no unlock PIN exists yet on this device, so we must
  // send the user to SetupPin instead of straight to the calculator disguise.
  // Checked once, before the navigator ever mounts.
  const [checkingPin, setCheckingPin] = useState(true);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);

  useEffect(() => {
    (async () => {
      const hasCode = await hasCustomUnlockCode();
      setNeedsPinSetup(!hasCode);
      setCheckingPin(false);
    })();
  }, []);

  useEffect(() => {
    if (shouldRelock && navigationRef.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: "Calculator" }],
      });
      clearRelock();
    }
  }, [shouldRelock]);

  if (loading || checkingPin) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={needsPinSetup ? "SetupPin" : "Calculator"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="SetupPin" component={SetupPinScreen} />
        <Stack.Screen name="Calculator" component={CalculatorScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="RecoveryCode" component={RecoveryCodeScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="AddContact" component={AddContactScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="DecoyChatList" component={DecoyChatListScreen} />
        <Stack.Screen name="DecoyChat" component={DecoyChatScreen} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
        <Stack.Screen name="GroupChat" component={GroupChatScreen} />
        <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;