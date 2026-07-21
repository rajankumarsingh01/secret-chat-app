const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pairingRoutes = require("./routes/pairingRoutes");
const keysRoutes = require("./routes/keysRoutes");
const lockRoutes = require("./routes/lockRoutes");
const socketHandler = require("./socket/socketHandler");
const { generalLimiter } = require("./middleware/rateLimiter");

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", generalLimiter);

app.get("/", (req, res) => {
  res.send("Chat App Backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pairing", pairingRoutes);
app.use("/api/keys", keysRoutes);
app.use("/api/lock", lockRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  // Buffers events (receive_message, etc.) for a socket that drops and reconnects
  // within this window — e.g. phone going through a tunnel, WiFi<->mobile data
  // switch, app briefly backgrounded — so nothing is silently lost.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    // Must stay false: our auth middleware (io.use below) is what sets socket.user
    // on every connection. If middlewares were skipped on recovery, socket.user
    // would be undefined on the recovered socket and every handler would break.
    skipMiddlewares: false,
  },
});

socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});