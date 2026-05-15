import { useState } from "react";

function LogoEnclosing({ size = 60 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <linearGradient id="lo_bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7af7" />
          <stop offset="100%" stopColor="#3564e0" />
        </linearGradient>
        <radialGradient id="lo_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lo_sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#lo_bg)" />
      <path d="M 84.6 42.8 A 30 30 0 1 0 84.6 77.2" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" />
      <circle cx="60" cy="60" r="36" fill="url(#lo_glow)" />
      <circle cx="60" cy="60" r="12" fill="url(#lo_sun)" />
      <circle cx="60" cy="60" r="18" fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="1.5" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(null);

  return (
    <div style={{
      width: 390, height: 844, margin: "0 auto",
      background: "linear-gradient(180deg, #f8f9fb 0%, #f0f2f7 50%, #eaecf3 100%)",
      borderRadius: 40, overflow: "hidden", position: "relative",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#1a1d26", border: "1px solid rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Background sun glow */}
      <div style={{
        position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 35%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px 0", fontSize: 15, fontWeight: 600,
      }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
            {[5, 7, 9, 12].map((h, i) => <div key={i} style={{ width: 3, height: h, background: "#1a1d26", borderRadius: 1 }} />)}
          </div>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 3C10.7 3 13.1 4.1 14.8 5.9L16 4.7C14 2.6 11.2 1.3 8 1.3S2 2.6 0 4.7L1.2 5.9C2.9 4.1 5.3 3 8 3z" fill="#1a1d26" /><path d="M8 7C9.6 7 11 7.6 12 8.6L13.2 7.4C11.8 6.1 10 5.3 8 5.3S4.2 6.1 2.8 7.4L4 8.6C5 7.6 6.4 7 8 7z" fill="#1a1d26" /><circle cx="8" cy="11" r="1.5" fill="#1a1d26" /></svg>
          <div style={{ width: 25, height: 12, border: "1.5px solid rgba(0,0,0,0.25)", borderRadius: 3, padding: 1 }}>
            <div style={{ width: "60%", height: "100%", background: "#1a1d26", borderRadius: 1.5 }} />
          </div>
        </div>
      </div>

      {/* Logo + Welcome */}
      <div style={{ padding: "60px 32px 0", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <LogoEnclosing size={72} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, marginBottom: 8 }}>
          Welcome back
        </div>
        <div style={{ fontSize: 15, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
          Sign in to continue your Callday
        </div>
      </div>

      {/* Form */}
      <div style={{ padding: "40px 28px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Email */}
        <div style={{
          background: "white",
          border: `1px solid ${focused === "email" ? "#4a7af7" : "rgba(0,0,0,0.08)"}`,
          borderRadius: 14, padding: "14px 16px",
          boxShadow: focused === "email" ? "0 0 0 4px rgba(74,122,247,0.1)" : "0 1px 2px rgba(0,0,0,0.03)",
          transition: "all 0.2s",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
            Email
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            placeholder="you@example.com"
            style={{
              width: "100%", border: "none", outline: "none", background: "transparent",
              fontSize: 16, fontWeight: 500, color: "#1a1d26",
              fontFamily: "inherit", padding: 0,
            }}
          />
        </div>

        {/* Password */}
        <div style={{
          background: "white",
          border: `1px solid ${focused === "password" ? "#4a7af7" : "rgba(0,0,0,0.08)"}`,
          borderRadius: 14, padding: "14px 16px",
          boxShadow: focused === "password" ? "0 0 0 4px rgba(74,122,247,0.1)" : "0 1px 2px rgba(0,0,0,0.03)",
          transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
              Password
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              style={{
                width: "100%", border: "none", outline: "none", background: "transparent",
                fontSize: 16, fontWeight: 500, color: "#1a1d26",
                fontFamily: "inherit", padding: 0,
              }}
            />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4a7af7", cursor: "pointer", whiteSpace: "nowrap", marginLeft: 12 }}>
            Forgot?
          </div>
        </div>

        {/* Sign in button */}
        <div style={{
          marginTop: 8,
          padding: "16px 0",
          borderRadius: 14, textAlign: "center",
          background: "linear-gradient(135deg, #4a7af7 0%, #5b8af5 50%, #6b94f8 100%)",
          color: "white", fontSize: 16, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(74,122,247,0.3), 0 1px 3px rgba(74,122,247,0.2)",
          cursor: "pointer",
          letterSpacing: -0.2,
        }}>
          Sign in
        </div>
      </div>

      {/* Divider */}
      <div style={{ padding: "28px 28px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>or continue with</div>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
      </div>

      {/* Social logins */}
      <div style={{ padding: "20px 28px 0", display: "flex", gap: 10 }}>
        <div style={{
          flex: 1, padding: "13px 0", borderRadius: 12,
          background: "white", border: "1px solid rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 14, fontWeight: 600, color: "#1a1d26",
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}>
          <AppleIcon />
          Apple
        </div>
        <div style={{
          flex: 1, padding: "13px 0", borderRadius: 12,
          background: "white", border: "1px solid rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 14, fontWeight: 600, color: "#1a1d26",
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}>
          <GoogleIcon />
          Google
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sign up link */}
      <div style={{
        textAlign: "center", padding: "0 28px 32px",
        fontSize: 14, color: "rgba(0,0,0,0.5)",
      }}>
        Don't have an account?{" "}
        <span style={{ color: "#4a7af7", fontWeight: 600, cursor: "pointer" }}>
          Sign up
        </span>
      </div>

      {/* Home indicator */}
      <div style={{
        width: 134, height: 5, background: "rgba(0,0,0,0.15)",
        borderRadius: 3, margin: "0 auto 8px",
      }} />
    </div>
  );
}
