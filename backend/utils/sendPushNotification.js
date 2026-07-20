// Sends a push notification via Expo's push service (free, no extra account needed)
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      }),
    });
  } catch (error) {
    console.log("Push notification error:", error.message);
  }
};

module.exports = sendPushNotification;