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
  Menu,
  ChevronDown,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rankMenuOpen, setRankMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const passwordHint = validatePassword(password);
  const passwordRequirements = getPasswordRequirements(password);
  const passwordsMatch = password.length > 0 && confirmPassword === password;

  useEffect(() => {
    function syncProfile() {
      setActiveProfile(loadActiveProfile());
    }

    function openRequestedAuth(event: Event) {
      const mode =
        event instanceof CustomEvent && event.detail?.mode === "signup"
          ? "signup"
          : "login";
      openAuth(mode);
    }

    window.addEventListener("profile:changed", syncProfile);
    window.addEventListener("auth:open", openRequestedAuth);
    return () => {
      window.removeEventListener("profile:changed", syncProfile);
      window.removeEventListener("auth:open", openRequestedAuth);
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
      if (event.key === "Escape") setRankMenuOpen(false);
      if (event.key === "Escape") setProfileMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

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
      setAuthStatus(
        error instanceof Error ? error.message : "Could not sign in.",
      );
    }
  }

  function handleLogout() {
    logoutProfile();
    setActiveProfile(null);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    window.setTimeout(() => window.location.reload(), 100);
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setRankMenuOpen(false);
    setProfileMenuOpen(false);
  }

  function openAuthFromNav(mode: AuthMode) {
    closeMobileMenu();
    openAuth(mode);
  }

  function navItems(className: string) {
    return (
      <div className={className}>
        {activeProfile ? (
          <div className="navMenuGroup navProfileGroup">
            <button
              className="navAction navProfileButton"
              type="button"
              aria-expanded={profileMenuOpen}
              onClick={() => {
                setProfileMenuOpen((current) => !current);
                setRankMenuOpen(false);
              }}
            >
              <User size={14} /> {activeProfile.name}
              <ChevronDown size={14} />
            </button>
            {profileMenuOpen ? (
              <div className="navSubmenu">
                <NavLink to="/favorites" onClick={closeMobileMenu}>
                  <Heart size={16} /> Favorites
                </NavLink>
                <button className="navAction" type="button" onClick={handleLogout}>
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <NavLink to="/" end onClick={closeMobileMenu}>
          <Home size={16} /> Home
        </NavLink>
        <div className="navMenuGroup navRankGroup">
          <button
            className="navAction"
            type="button"
            aria-expanded={rankMenuOpen}
            onClick={() => {
              setRankMenuOpen((current) => !current);
              setProfileMenuOpen(false);
            }}
          >
            <ListMusic size={16} /> Rank By <ChevronDown size={14} />
          </button>
          {rankMenuOpen ? (
            <div className="navSubmenu">
              <NavLink to="/years" onClick={closeMobileMenu}>
                <CalendarDays size={16} /> Year
              </NavLink>
              <NavLink to="/countries" onClick={closeMobileMenu}>
                <Flag size={16} /> Country
              </NavLink>
              <NavLink to="/global-rankings" onClick={closeMobileMenu}>
                <ListMusic size={16} /> Global
              </NavLink>
            </div>
          ) : null}
        </div>
        <NavLink
          to="/trivia"
          onClick={() => {
            closeMobileMenu();
            window.dispatchEvent(new Event("trivia:setup"));
          }}
        >
          <Sparkles size={16} /> Trivia
        </NavLink>
        {!activeProfile ? (
          <>
            <button
              className="navAction"
              type="button"
              onClick={() => openAuthFromNav("login")}
            >
              <LogIn size={15} /> Login
            </button>
            <button
              className="navAction"
              type="button"
              onClick={() => openAuthFromNav("signup")}
            >
              <User size={15} /> Sign Up
            </button>
          </>
        ) : null}
      </div>
    );
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
        {navItems("navLinks")}
        <button
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="mobileMenuButton"
          type="button"
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>
      {mobileMenuOpen ? (
        <div className="mobileNavOverlay">
          <button
            className="mobileNavScrim"
            type="button"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
          {navItems("mobileNavMenu")}
        </div>
      ) : null}
      {authOpen ? (
        <div
          className="authOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
        >
          <button
            className="authScrim"
            type="button"
            onClick={() => setAuthOpen(false)}
            aria-label="Close"
          />
          <form
            className="authDialog"
            onSubmit={(event) => void handleAuthSubmit(event)}
          >
            <div>
              <p className="eyebrow">
                {authMode === "signup" ? "Create profile" : "Welcome back"}
              </p>
              <h2 id="auth-title">
                {authMode === "signup" ? "Sign Up" : "Login"}
              </h2>
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
                autoComplete={
                  authMode === "signup" ? "new-password" : "current-password"
                }
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
            <p
              className={
                passwordHint && authMode === "signup"
                  ? "authHint warning"
                  : "authHint"
              }
            >
              8-20 characters, with lowercase, capital, number, and symbol.
            </p>
            {authMode === "signup" ? (
              <div
                className="passwordChecklist"
                aria-label="Password requirements"
              >
                {passwordRequirements.map((requirement) => (
                  <span
                    className={requirement.met ? "met" : "missing"}
                    key={requirement.label}
                  >
                    {requirement.met ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {requirement.label}
                  </span>
                ))}
                <span className={passwordsMatch ? "met" : "missing"}>
                  {passwordsMatch ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  passwords match
                </span>
              </div>
            ) : null}
            {authStatus ? <p className="authError">{authStatus}</p> : null}
            <div className="authActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setAuthOpen(false)}
              >
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
              {authMode === "signup"
                ? "Already have a profile? Login"
                : "Need a profile? Sign up"}
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
