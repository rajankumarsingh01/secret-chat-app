const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    next();
  } else {
    return res.status(403).json({ message: "Access denied: Superadmin only" });
  }
};

module.exports = isSuperAdmin;