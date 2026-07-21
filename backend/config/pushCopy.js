// backend/config/pushCopy.js
// Copy shown in the lock-screen push notification banner.
// Kept deliberately generic — no sender username, no message preview, no
// "message"/"chat" wording — so a locked phone never gives away that this
// app exists behind the calculator. Change these two strings if you want
// the notification to blend in with a specific disguise (e.g. mimic a
// notes app, a to-do app, etc.) — everything else keeps working as-is.
module.exports = {
  title: "Update available",
  body: "Tap to view.",
};