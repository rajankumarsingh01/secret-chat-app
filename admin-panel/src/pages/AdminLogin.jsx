import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data.role !== "superadmin") {
        setError("Access denied: not a superadmin account");
        return;
      }
      localStorage.setItem("adminToken", response.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.form}>
        <h2>Superadmin Login</h2>
        {error && <p style={styles.error}>{error}</p>}
        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button style={styles.button} type="submit">Login</button>
      </form>
    </div>
  );
};

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f2f5" },
  form: { background: "#fff", padding: 40, borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", width: 320 },
  input: { display: "block", width: "100%", padding: 10, marginBottom: 12, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" },
  button: { width: "100%", padding: 10, background: "#007AFF", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
  error: { color: "red", fontSize: 14 },
};

export default AdminLogin;