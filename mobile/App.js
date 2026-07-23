import "react-native-get-random-values";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppLockProvider } from "./src/context/AppLockContext";
import { CallProvider } from "./src/context/CallContext";
import AppNavigator from "./src/navigation/AppNavigator";
import CallOverlay from "./src/components/CallOverlay";
import ErrorBoundary from "./src/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppLockProvider>
            <CallProvider>
              <AppNavigator />
              <CallOverlay />
            </CallProvider>
          </AppLockProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}