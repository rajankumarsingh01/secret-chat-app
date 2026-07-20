import "react-native-get-random-values";
import React from "react";
import { AuthProvider } from "./src/context/AuthContext";
import { AppLockProvider } from "./src/context/AppLockContext";
import AppNavigator from "./src/navigation/AppNavigator";
import ErrorBoundary from "./src/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppLockProvider>
          <AppNavigator />
        </AppLockProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}