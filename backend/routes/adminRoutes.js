const express = require("express");
const router = express.Router();
const {
  getAllUsersAdmin,
  banUser,
  unbanUser,
  deleteUser,
  getStats,
} = require("../controllers/adminController");
const protect = require("../middleware/auth");
const isSuperAdmin = require("../middleware/isSuperAdmin");

router.get("/users", protect, isSuperAdmin, getAllUsersAdmin);
router.get("/stats", protect, isSuperAdmin, getStats);
router.put("/users/:id/ban", protect, isSuperAdmin, banUser);
router.put("/users/:id/unban", protect, isSuperAdmin, unbanUser);
router.delete("/users/:id", protect, isSuperAdmin, deleteUser);

module.exports = router;