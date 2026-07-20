import { io } from "socket.io-client";
import { API_URL } from "@env";

let socket = null;

export const connectSocket = (token) => {
  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};