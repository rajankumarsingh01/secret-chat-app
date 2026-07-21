import { io } from "socket.io-client";
import { AppState } from "react-native";
import { API_URL } from "@env";

let socket = null;
let appStateSubscription = null;

export const connectSocket = (token) => {
  // Guard against leaking a previous socket + AppState listener if connectSocket
  // is somehow called twice (e.g. login called back to back).
  if (socket) disconnectSocket();

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"],
    // Free-tier hosts (Render/Fly) can drop idle sockets or briefly hiccup — keep
    // retrying forever with capped backoff instead of giving up after a few tries.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    // "io server disconnect" = server forcefully closed it (banned user, bad auth) —
    // socket.io intentionally does NOT auto-reconnect in that case, so we don't
    // force it either. Every other reason (transport close, ping timeout, etc.)
    // reconnects automatically thanks to the options above.
    console.log("Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.log("Socket connect error:", error.message);
  });

  // Render/Fly can fully spin the backend down while the app is backgrounded, and
  // phones aggressively freeze background network activity anyway. Instead of
  // waiting for the exponential backoff timer, force a reconnect attempt the
  // instant the app comes back to the foreground.
  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active" && socket && !socket.connected) {
      socket.connect();
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};