import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useAppLock } from "../context/AppLockContext";
import { colors } from "../theme";

import CalculatorScreen from "../screens/CalculatorScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import RecoveryCodeScreen from "../screens/RecoveryCodeScreen";
import ChatListScreen from "../screens/ChatListScreen";
import AddContactScreen from "../screens/AddContactScreen";
import ChatScreen from "../screens/ChatScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { loading } = useAuth();
  const { shouldRelock, clearRelock } = useAppLock();
  const navigationRef = useRef(null);

  useEffect(() => {
    if (shouldRelock && navigationRef.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: "Calculator" }],
      });
      clearRelock();
    }
  }, [shouldRelock]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Calculator" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Calculator" component={CalculatorScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="RecoveryCode" component={RecoveryCodeScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="AddContact" component={AddContactScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;