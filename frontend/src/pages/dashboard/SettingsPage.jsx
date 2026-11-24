import { useState } from "react";
import { Check, Keyboard, Monitor, Moon, Shield, Sun, UserRound } from "lucide-react";
import { PageHeader } from "../../components/dashboard/DashboardPrimitives";
import { useAuth } from "../../context/AuthContextCore";
import { useTheme } from "../../context/useTheme";
import { apiRequest } from "../../services/apiClient";

const sections = [
  ["profile", "Profile", UserRound],
  ["appearance", "Appearance", Monitor],
  ["editor", "Editor preferences", Keyboard],
  ["security", "Security", Shield],
];

function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, setUser } = useAuth();
  const [section, setSection] = useState("profile");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [appearanceNote, setAppearanceNote] = useState("");

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    try {
      const data = await apiRequest("/api/v1/auth/profile", { method: "PATCH", body: { displayName } });
      setUser(data.user);
      setProfileMessage("Display name saved.");
    } catch (error) {
      setProfileError(error.message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    try {
      await apiRequest("/api/v1/auth/password", { method: "POST", body: { currentPassword, nextPassword } });
      setCurrentPassword("");
      setNextPassword("");
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordError(error.message);
    }
  };

  return (
    <section className="settings-page">
      <PageHeader eyebrow="Preferences" title="Settings" description="Profile and password changes are saved to your Schevo account." />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(([id, label, Icon]) => (
            <button key={id} className={section === id ? "is-selected" : ""} type="button" onClick={() => setSection(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {section === "profile" && (
            <form onSubmit={saveProfile}>
              <SettingsHeading title="Profile" description="This name is stored with your account and used in the workspace greeting." />
              <label className="field-label">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <label className="field-label">Email<input value={user?.email || ""} disabled /></label>
              {profileError && <p className="field-error" role="alert">{profileError}</p>}
              {profileMessage && <p className="field-success" role="status">{profileMessage}</p>}
              <div className="settings-actions"><button className="primary-button" type="submit"><Check size={15} /> Save profile</button></div>
            </form>
          )}
          {section === "appearance" && (
            <>
              <SettingsHeading title="Appearance" description="Theme is saved in this browser." />
              <div className="preference-options">
                <button className={theme === "light" ? "is-selected" : ""} type="button" onClick={() => theme !== "light" && toggleTheme()}><Sun size={17} /><strong>Light</strong><small>Bright surfaces and neutral contrast</small></button>
                <button className={theme === "dark" ? "is-selected" : ""} type="button" onClick={() => theme !== "dark" && toggleTheme()}><Moon size={17} /><strong>Dark</strong><small>Low-light developer workspace</small></button>
                <button type="button" onClick={() => setAppearanceNote("System theme is not available yet. Choose light or dark for this browser.")}><Monitor size={17} /><strong>System</strong><small>Not available yet</small></button>
              </div>
              {appearanceNote && <p className="field-error" role="status">{appearanceNote}</p>}
              <Toggle label="Reduce motion" description="The interface already follows the reduced-motion setting from your operating system." checked={window.matchMedia("(prefers-reduced-motion: reduce)").matches} disabled />
            </>
          )}
          {section === "editor" && (
            <>
              <SettingsHeading title="Editor preferences" description="These switches are visible, but they do not change the designer yet." />
              <Toggle label="Show canvas grid" description="The canvas grid is currently always on." checked disabled />
              <Toggle label="Snap tables to grid" description="Table snapping is not implemented." disabled />
              <Toggle label="Open SQL panel after validation" description="Open the SQL preview from the designer panel when you want it." disabled />
            </>
          )}
          {section === "security" && (
            <form onSubmit={changePassword}>
              <SettingsHeading title="Password" description="Changing your password requires your current password. Sessions stay on the server." />
              <label className="field-label">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
              <label className="field-label">New password<input type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} /></label>
              {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
              {passwordMessage && <p className="field-success" role="status">{passwordMessage}</p>}
              <div className="settings-actions"><button className="primary-button" type="submit">Update password</button></div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function SettingsHeading({ title, description }) {
  return <header className="settings-heading"><h2>{title}</h2><p>{description}</p></header>;
}

function Toggle({ label, description, checked = false, disabled = false }) {
  return (
    <label className="settings-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} disabled={disabled} readOnly />
      <i />
    </label>
  );
}

export default SettingsPage;
