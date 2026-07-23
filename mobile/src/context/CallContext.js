// mobile/src/context/CallContext.js
// Handles WebRTC signaling + peer connection lifecycle for 1-to-1 audio/video
// calls. Media (audio/video) travels peer-to-peer — the backend only relays
// the SDP offer/answer + ICE candidates via the existing Socket.IO connection,
// so there's no extra server cost.
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { TURN_URL, TURN_USERNAME, TURN_CREDENTIAL } from "@env";
import { getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

// react-native-webrtc's native module doesn't exist inside Expo Go (it only
// exists in a real dev-client / production build). Importing it there throws
// synchronously and would crash the ENTIRE app before it even renders. So we
// require it defensively — if it's missing, calling is simply disabled and
// everything else in the app keeps working normally.
let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices;
let webrtcAvailable = true;
try {
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
} catch (error) {
  webrtcAvailable = false;
  console.log("react-native-webrtc not available (Expo Go?) — calling disabled:", error.message);
}

const CallContext = createContext();

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Only added if you've filled TURN_* in .env — without a TURN server, calls
  // still work most of the time (STUN is enough on open networks) but can fail
  // to connect on strict/carrier-grade NAT (some mobile data networks, some
  // office wifi). Free TURN options: metered.ca or expressturn.com.
  ...(TURN_URL && TURN_USERNAME && TURN_CREDENTIAL
    ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL }]
    : []),
];

export const CallProvider = ({ children }) => {
  const { user } = useAuth();

  // 'idle' | 'outgoing' | 'incoming' | 'connected'
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // 'audio' | 'video'
  const [otherUser, setOtherUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const durationTimerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setOtherUser(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
  }, [localStream]);

  const createPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit("ice_candidate", { to: targetUserId, candidate: event.candidate });
      }
    };

    // react-native-webrtc fires ontrack per remote track; we group them into
    // one MediaStream for the <RTCView>.
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.iceConnectionState)) {
        endCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const startDurationTimer = () => {
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  };

  // ── Outgoing call ─────────────────────────────────────────────────────
  const startCall = useCallback(async (targetUser, type = "audio") => {
    if (!webrtcAvailable) {
      Alert.alert(
        "Calling not available",
        "Voice/video call sirf dev-client ya installed build me kaam karta hai — Expo Go me nahi. Pehle 'eas build --profile development' se build banao."
      );
      return;
    }
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false,
      });
      setLocalStream(stream);
      setOtherUser(targetUser);
      setCallType(type);
      setCallState("outgoing");

      const pc = createPeerConnection(targetUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit("call_user", { to: targetUser._id, offer, callType: type });
    } catch (error) {
      console.log("startCall error:", error.message);
      cleanup();
    }
  }, [createPeerConnection, cleanup]);

  // ── Incoming call ────────────────────────────────────────────────────
  const handleIncomingCall = useCallback(({ from, offer, callType: type }) => {
    if (!webrtcAvailable) return; // Expo Go — silently ignore, can't render/answer anyway
    // Already on a call somewhere else (shouldn't normally happen — server
    // also guards this) — just ignore.
    if (callState !== "idle") return;
    pendingOfferRef.current = offer;
    setOtherUser(from);
    setCallType(type);
    setCallState("incoming");
  }, [callState]);

  const acceptCall = useCallback(async () => {
    try {
      const offer = pendingOfferRef.current;
      if (!offer || !otherUser) return;

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false,
      });
      setLocalStream(stream);

      const pc = createPeerConnection(otherUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Any ICE candidates that arrived before we finished setting up the pc.
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit("call_answer", { to: otherUser._id, answer });

      setCallState("connected");
      startDurationTimer();
    } catch (error) {
      console.log("acceptCall error:", error.message);
      cleanup();
    }
  }, [otherUser, callType, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    if (otherUser) {
      const socket = getSocket();
      socket?.emit("call_reject", { to: otherUser._id });
    }
    cleanup();
  }, [otherUser, cleanup]);

  const endCall = useCallback(() => {
    if (otherUser) {
      const socket = getSocket();
      socket?.emit("call_end", { to: otherUser._id });
    }
    cleanup();
  }, [otherUser, cleanup]);

  // ── Controls ─────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted((m) => !m);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = isCameraOff));
    setIsCameraOff((c) => !c);
  }, [localStream, isCameraOff]);

  const switchCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => t._switchCamera && t._switchCamera());
    setIsFrontCamera((f) => !f);
  }, [localStream]);

  // ── Socket listeners (registered once user is logged in) ───────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const onCallAnswered = async ({ answer }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setCallState("connected");
          startDurationTimer();
        }
      } catch (error) {
        console.log("call_answered error:", error.message);
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (error) {
        console.log("ice_candidate error:", error.message);
      }
    };

    const onCallRejected = () => cleanup();
    const onCallEnded = () => cleanup();
    const onCallFailed = ({ reason }) => {
      console.log("call_failed:", reason);
      cleanup();
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_answered", onCallAnswered);
    socket.on("ice_candidate", onIceCandidate);
    socket.on("call_rejected", onCallRejected);
    socket.on("call_ended", onCallEnded);
    socket.on("call_failed", onCallFailed);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_answered", onCallAnswered);
      socket.off("ice_candidate", onIceCandidate);
      socket.off("call_rejected", onCallRejected);
      socket.off("call_ended", onCallEnded);
      socket.off("call_failed", onCallFailed);
    };
  }, [user, handleIncomingCall, cleanup]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        otherUser,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        isFrontCamera,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);