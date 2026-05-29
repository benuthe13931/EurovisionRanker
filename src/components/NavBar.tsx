import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Flag,
  Heart,
  Home,
  ListMusic,
  LogIn,
  LogOut,
  Trophy,
  User,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  getPasswordRequirements,
  loadActiveProfile,
  loginProfile,
  logoutProfile,
  signUpProfile,
  validatePassword,
} from "../utils/storage";

type AuthMode = "login" | "signup";

export default function NavBar() {
  const [activeProfile, setActiveProfile] = useState(() => loadActiveProfile());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const passwordHint = validatePassword(password);
  const passwordRequirements = getPasswordRequirements(password);
  const passwordsMatch = password.length > 0 && confirmPassword === password;

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthStatus("");
    setAuthOpen(true);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus("");

    try {
      if (authMode === "signup" && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const nextProfile =
        authMode === "signup"
          ? await signUpProfile(displayName, username, password)
          : await loginProfile(username, password);

      setActiveProfile(nextProfile);
      setAuthOpen(false);
      setDisplayName("");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  function handleLogout() {
    logoutProfile();
    setActiveProfile(null);
    window.setTimeout(() => window.location.reload(), 100);
  }

  return (
    <header className="navShell">
      <nav className="navInner">
        <NavLink to="/" className="brand" aria-label="Eurovision Ranker home">
          <span className="brandMark">
            <Trophy size={18} />
          </span>
          <span>ESC Ranker</span>
        </NavLink>
        <div className="navLinks">
          <NavLink to="/" end>
            <Home size={16} /> Home
          </NavLink>
          <NavLink to="/years">
            <CalendarDays size={16} /> Years
          </NavLink>
          <NavLink to="/all-songs">
            <ListMusic size={16} /> All Songs
          </NavLink>
          <NavLink to="/countries">
            <Flag size={16} /> Countries
          </NavLink>
          <NavLink to="/favorites">
            <Heart size={16} /> Favorites
          </NavLink>
          {activeProfile ? (
            <>
              <span className="navBadge">
                <User size={14} /> {activeProfile.name}
              </span>
              <button className="navAction" type="button" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <button className="navAction" type="button" onClick={() => openAuth("login")}>
                <LogIn size={15} /> Login
              </button>
              <button className="navAction" type="button" onClick={() => openAuth("signup")}>
                <User size={15} /> Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
      {authOpen ? (
        <div className="authOverlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="authScrim" type="button" onClick={() => setAuthOpen(false)} aria-label="Close" />
          <form className="authDialog" onSubmit={(event) => void handleAuthSubmit(event)}>
            <div>
              <p className="eyebrow">{authMode === "signup" ? "Create profile" : "Welcome back"}</p>
              <h2 id="auth-title">{authMode === "signup" ? "Sign Up" : "Login"}</h2>
            </div>
            {authMode === "signup" ? (
              <label>
                Name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={32}
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={24}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={8}
                maxLength={20}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            {authMode === "signup" ? (
              <label>
                Re-enter Password
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  minLength={8}
                  maxLength={20}
                  autoComplete="new-password"
                />
              </label>
            ) : null}
            <p className={passwordHint && authMode === "signup" ? "authHint warning" : "authHint"}>
              8-20 characters, with lowercase, capital, number, and symbol.
            </p>
            {authMode === "signup" ? (
              <div className="passwordChecklist" aria-label="Password requirements">
                {passwordRequirements.map((requirement) => (
                  <span className={requirement.met ? "met" : "missing"} key={requirement.label}>
                    {requirement.met ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {requirement.label}
                  </span>
                ))}
                <span className={passwordsMatch ? "met" : "missing"}>
                  {passwordsMatch ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  passwords match
                </span>
              </div>
            ) : null}
            {authStatus ? <p className="authError">{authStatus}</p> : null}
            <div className="authActions">
              <button className="secondaryButton" type="button" onClick={() => setAuthOpen(false)}>
                Cancel
              </button>
              <button className="primaryButton" type="submit">
                {authMode === "signup" ? "Create Profile" : "Login"}
              </button>
            </div>
            <button
              className="authSwitch"
              type="button"
              onClick={() => {
                setAuthMode(authMode === "signup" ? "login" : "signup");
                setAuthStatus("");
                setConfirmPassword("");
              }}
            >
              {authMode === "signup" ? "Already have a profile? Login" : "Need a profile? Sign up"}
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
