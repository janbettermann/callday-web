/**
 * Inline render of the Callday iOS home-screen, used as the hero
 * mockup on the landing page. Source HTML lives in `designs/` — kept
 * in sync by re-converting that file when the screen changes.
 *
 * All styles are scoped under `.app-mockup` in globals.css to avoid
 * collisions with the marketing-page classes (`.section-label`,
 * `.status-dot`, `.cta`, `.header`).
 */

function PhoneIcon({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="phone-icon"
      style={color ? { color } : undefined}
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

type LeadRow = {
  time: string;
  ago: string;
  name: string;
  meta: string;
  dotColor: string;
};

const LEADS: LeadRow[] = [
  {
    time: "10:00",
    ago: "yesterday",
    name: "Bäckerhaus Wagner",
    meta: "Callback · Muenchen Baeckereien",
    dotColor: "#16a34a",
  },
  {
    time: "10:00",
    ago: "yesterday",
    name: "Bürgermeister & Söhne",
    meta: "Callback · Callday Test Leads",
    dotColor: "#16a34a",
  },
  {
    time: "10:00",
    ago: "8h ago",
    name: "Frischbrot Express",
    meta: "Offer follow-up · Muenchen Baeck...",
    dotColor: "#ea580c",
  },
  {
    time: "10:00",
    ago: "8h ago",
    name: "Süße Ecke",
    meta: "Offer follow-up · Muenchen Baeck...",
    dotColor: "#ea580c",
  },
];

export function CalldayAppMockup() {
  return (
    <div className="app-mockup" aria-label="Callday home screen">
      {/* Status bar */}
      <div className="status-bar">
        <span>14:22</span>
        <div className="status-icons">
          <div className="signal">
            <div className="signal-bar" style={{ height: 5 }} />
            <div className="signal-bar" style={{ height: 7 }} />
            <div className="signal-bar" style={{ height: 9 }} />
            <div className="signal-bar" style={{ height: 12 }} />
          </div>
          <svg width="16" height="12" viewBox="0 0 16 12">
            <path
              d="M8 3C10.7 3 13.1 4.1 14.8 5.9L16 4.7C14 2.6 11.2 1.3 8 1.3S2 2.6 0 4.7L1.2 5.9C2.9 4.1 5.3 3 8 3z"
              fill="#1a1d26"
            />
            <path
              d="M8 7C9.6 7 11 7.6 12 8.6L13.2 7.4C11.8 6.1 10 5.3 8 5.3S4.2 6.1 2.8 7.4L4 8.6C5 7.6 6.4 7 8 7z"
              fill="#1a1d26"
            />
            <circle cx="8" cy="11" r="1.5" fill="#1a1d26" />
          </svg>
          <div className="battery">
            <div className="battery-fill" />
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="am-header">
        <div className="header-date">Wednesday, May 14 · 14:22</div>
        <div className="header-greeting">Good afternoon, Jan ☀️</div>
      </div>

      {/* Primary CTA */}
      <div className="am-cta">
        <div className="cta-left">
          <div className="cta-icon">
            <PhoneIcon size={20} color="white" />
          </div>
          <div>
            <div className="cta-title">Start calling</div>
            <div className="cta-sub">Muenchen Baeckereien · from lead 1</div>
          </div>
        </div>
        <div className="cta-count">10</div>
      </div>

      {/* Due today */}
      <div className="leads">
        <div className="am-section-header">
          <span className="am-section-label">Due Today</span>
          <span className="section-badge">4</span>
        </div>
        <div className="lead-list">
          {LEADS.map((lead, i) => (
            <div className="lead-card" key={i}>
              <div className="lead-left">
                <div className="lead-time">
                  <div className="lead-time-val">{lead.time}</div>
                  <div className="lead-time-ago">{lead.ago}</div>
                </div>
                <div>
                  <div className="lead-name">{lead.name}</div>
                  <div className="lead-meta">
                    <span
                      className="am-status-dot"
                      style={{ background: lead.dotColor }}
                    />
                    {lead.meta}
                  </div>
                </div>
              </div>
              <div className="lead-call-btn">
                <PhoneIcon size={16} color="rgba(0,0,0,0.2)" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="upcoming">
        <div className="upcoming-left">
          <span className="am-section-label">Upcoming</span>
          <span className="upcoming-badge">2</span>
        </div>
        <span className="upcoming-plus">+</span>
      </div>

      {/* Sun arc */}
      <div className="sun-arc">
        <svg width="390" height="230" viewBox="0 0 390 230">
          <path
            d="M 45 220 A 150 150 0 0 1 345 220"
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <text
            x="38"
            y="218"
            fill="rgba(0,0,0,0.12)"
            fontSize="9"
            fontFamily="'SF Mono',monospace"
            textAnchor="middle"
          >
            8:00
          </text>
          <text
            x="195"
            y="58"
            fill="rgba(0,0,0,0.12)"
            fontSize="9"
            fontFamily="'SF Mono',monospace"
            textAnchor="middle"
          >
            13:00
          </text>
          <text
            x="352"
            y="218"
            fill="rgba(0,0,0,0.12)"
            fontSize="9"
            fontFamily="'SF Mono',monospace"
            textAnchor="middle"
          >
            18:00
          </text>

          <defs>
            <radialGradient id="mockupSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mockupSunCore" cx="40%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.15" />
            </radialGradient>
          </defs>

          <circle cx="260" cy="78" r="78" fill="url(#mockupSunGlow)" />
          <circle
            cx="260"
            cy="78"
            r="32"
            fill="none"
            stroke="rgba(251,191,36,0.06)"
            strokeWidth="1"
          />
          <circle
            cx="260"
            cy="78"
            r="26"
            fill="url(#mockupSunCore)"
            stroke="rgba(251,191,36,0.1)"
            strokeWidth="1"
          />
          <text
            x="260"
            y="79"
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(180,120,0,0.45)"
            fontSize="20"
            fontWeight="700"
            fontFamily="-apple-system,sans-serif"
          >
            7
          </text>
        </svg>
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
        <div className="nav-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="#4a7af7"
            stroke="#4a7af7"
            strokeWidth="1.8"
          >
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          </svg>
          <span className="nav-label nav-active">HOME</span>
        </div>
        <div className="nav-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
          <span className="nav-label nav-inactive">CALL</span>
        </div>
        <div className="nav-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
            <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
            <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
          </svg>
          <span className="nav-label nav-inactive">LISTS</span>
        </div>
        <div className="nav-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="nav-label nav-inactive">SETTINGS</span>
        </div>
      </div>

      <div className="home-indicator" />
    </div>
  );
}
