// mobile/src/theme.js
// WhatsApp-inspired dark theme

export const colors = {
  // Backgrounds
  bg: "#0B141A",            // main app / chat background (WhatsApp dark bg)
  headerBg: "#202C33",       // top app bar background
  surface: "#202C33",        // cards, headers, incoming bubble base
  surfaceAlt: "#2A3942",     // input fields, icon buttons, search bar

  // Bubbles
  bubbleOwn: "#005C4B",      // outgoing message bubble (dark green)
  bubbleOther: "#202C33",    // incoming message bubble

  // Brand / accent
  accent: "#00A884",         // primary teal-green (FAB, buttons, badges, links)
  accentDim: "#008069",      // pressed / darker state
  accentSoft: "#53BDEB",     // read-tick blue, header icons

  // Text
  text: "#E9EDEF",
  textMuted: "#8696A0",
  textFaint: "#667781",

  // Status
  online: "#00A884",
  danger: "#F15C6D",
  border: "#222D34",
  unreadBadge: "#25D366",     // unread count badge (brighter WhatsApp green)
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "700", letterSpacing: 0, color: colors.text },
  h2: { fontSize: 20, fontWeight: "600", letterSpacing: 0, color: colors.text },
  body: { fontSize: 15, fontWeight: "400", color: colors.text },
  bodyBold: { fontSize: 16, fontWeight: "600", color: colors.text },
  caption: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
};