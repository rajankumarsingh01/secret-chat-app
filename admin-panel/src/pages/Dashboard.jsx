import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/stats"),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleBan = async (id) => {
    await api.put(`/admin/users/${id}/ban`);
    fetchData();
  };

  const handleUnban = async (id) => {
    await api.put(`/admin/users/${id}/unban`);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    await api.delete(`/admin/users/${id}`);
    fetchData();
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Superadmin Dashboard</h2>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>Total Users: {stats.totalUsers}</div>
          <div style={styles.statCard}>Banned Users: {stats.bannedUsers}</div>
          <div style={styles.statCard}>Total Messages: {stats.totalMessages}</div>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Username</th>
            <th>Status</th>
            <th>Online</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.username}</td>
              <td>{u.isBanned ? "Banned" : "Active"}</td>
              <td>{u.isOnline ? "Online" : "Offline"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                {u.isBanned ? (
                  <button onClick={() => handleUnban(u._id)} style={styles.actionBtn}>Unban</button>
                ) : (
                  <button onClick={() => handleBan(u._id)} style={styles.actionBtn}>Ban</button>
                )}
                <button onClick={() => handleDelete(u._id)} style={styles.deleteBtn}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  container: { padding: 30, fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoutBtn: { padding: "8px 16px", background: "#ff3b30", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
  statsRow: { display: "flex", gap: 16, margin: "20px 0" },
  statCard: { background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", flex: 1, textAlign: "center" },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff" },
  actionBtn: { marginRight: 8, padding: "6px 12px", background: "#007AFF", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
  deleteBtn: { padding: "6px 12px", background: "#ff3b30", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
};

export default Dashboard;