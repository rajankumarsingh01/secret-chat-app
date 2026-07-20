import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const AppLockContext = createContext();

const GRACE_PERIOD_MS = 3 * 1000; // 3 seconds — how long the app can be backgrounded before relocking

export const AppLockProvider = ({ children }) => {
  const [shouldRelock, setShouldRelock] = useState(false);
  const backgroundedAtRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (nextState) => {
    const prevState = appStateRef.current;

    if (prevState === "active" && (nextState === "background" || nextState === "inactive")) {
      backgroundedAtRef.current = Date.now();
    }

    if (prevState !== "active" && nextState === "active") {
      const backgroundedAt = backgroundedAtRef.current;
      if (backgroundedAt && Date.now() - backgroundedAt > GRACE_PERIOD_MS) {
        setShouldRelock(true);
      }
      backgroundedAtRef.current = null;
    }

    appStateRef.current = nextState;
  };

  const clearRelock = () => setShouldRelock(false);

  return (
    <AppLockContext.Provider value={{ shouldRelock, clearRelock }}>
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => useContext(AppLockContext);