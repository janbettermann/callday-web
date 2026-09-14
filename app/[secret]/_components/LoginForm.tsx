import { loginAction } from "../actions";

export function LoginForm({ error }: { error: boolean }) {
  return (
    <div className="wb-login">
      <form action={loginAction} className="wb-login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#3564e0" />
            <path d="M15.5 9.2a4 4 0 1 0 0 5.6" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span className="wb-brand-name">Callday</span>
          <span className="wb-brand-tag">Admin</span>
        </div>
        <h1 className="wb-login-title">Anmelden</h1>

        <label className="wb-label" htmlFor="admin-password">
          Passwort
        </label>
        <input
          id="admin-password"
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="off"
          className="wb-input"
        />

        {error ? <p className="wb-error-text">Falsches Passwort.</p> : null}

        <button type="submit" className="wb-btn-primary" style={{ width: "100%", marginTop: 18 }}>
          Weiter
        </button>
      </form>
    </div>
  );
}
