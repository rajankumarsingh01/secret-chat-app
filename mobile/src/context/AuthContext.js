import React, { createContext, useState, useEffect, useContext } from "react";
import * as SecureStore from "expo-secure-store";
import api from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { registerForPushNotifications } from "../services/notifications";
import { registerPublicKey } from "../services/keys";

const AuthContext = createContext();

const safeRegisterKey = async () => {
  try {
    const key = await registerPublicKey();
    console.log("Public key registered successfully:", key.substring(0, 12) + "...");
  } catch (error) {
    console.log("FAILED to register public key:", error.message);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const userData = await SecureStore.getItemAsync("user");
      if (token && userData) {
        setUser(JSON.parse(userData));
        connectSocket(token);
        registerForPushNotifications();
        safeRegisterKey();
      }
    } catch (error) {
      console.log("Error loading stored user:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await api.post("/auth/login", { username, password });
    const data = response.data;
    await SecureStore.setItemAsync("token", data.token);
    await SecureStore.setItemAsync("user", JSON.stringify(data));
    setUser(data);
    connectSocket(data.token);
    registerForPushNotifications();
    safeRegisterKey();
    return data;
  };

  const signup = async (username, password) => {
    const response = await api.post("/auth/signup", { username, password });
    const data = response.data;
    await SecureStore.setItemAsync("token", data.token);
    await SecureStore.setItemAsync("user", JSON.stringify(data));
    setUser(data);
    connectSocket(data.token);
    registerForPushNotifications();
    safeRegisterKey();
    return data;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    disconnectSocket();
    setUser(null);
  };

  // Called after a duress/panic wipe has already deleted everything from SecureStore.
  // Only resets in-memory state — does NOT touch storage itself (secretCodes.wipeAllLocalData
  // already did that), so it stays fast and silent.
  const clearSessionSilently = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout, clearSessionSilently }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);