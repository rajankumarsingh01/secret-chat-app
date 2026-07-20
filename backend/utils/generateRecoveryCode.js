const crypto = require("crypto");

// Generates a readable code like "XKLM-9QRT-4NPZ" — excludes ambiguous characters (0, O, 1, I)
const generateRecoveryCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    const idx = crypto.randomInt(0, chars.length);
    code += chars[idx];
    if ((i + 1) % 4 === 0 && i !== 11) code += "-";
  }
  return code;
};

module.exports = generateRecoveryCode;