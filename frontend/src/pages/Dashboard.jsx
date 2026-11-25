import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: "3rem 2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1>Welcome to your dashboard</h1>
      <p>Signed in as {user?.name || "Developer"}.</p>
      <p>Email: {user?.email}</p>
      <button type="button" onClick={handleLogout} style={{ marginTop: "1rem" }}>
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
