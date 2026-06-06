/**
 * LaunchListWelcome (Template 3) — wird vom Database-Webhook gefeuert,
 * sobald Jan eine Application im Supabase Studio auf status='launch_list'
 * setzt.
 *
 * Tonalität-Vorgabe (siehe BETA_WORKFLOW_PLAN.md Template 3 + Brand-Voice-
 * Memory): KEIN "beta is full"-Fiction (wäre heuchlerisch wenn Jan
 * parallel weiter Ads schaltet). Stattdessen ehrliche Cap-Erklärung +
 * Self-Selection-Reply-Mechanik (User kann mit Beweis Re-Review anfordern).
 *
 * Founder-Pricing-Versprechen ist identisch zur Beta-Variante — Launch-
 * List-User kriegen day-zero access mit Code, nur ohne den Beta-Vorlauf.
 */

import { Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface LaunchListWelcomeProps {
  name: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

const benefitTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 6px",
} as const;

export function LaunchListWelcome({ name }: LaunchListWelcomeProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="Quick update on your Callday application — you're on the launch list with founder pricing locked in.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        Quick update on your application: we matched you to the launch
        list rather than the closed beta. Read that as a positive — not a
        no.
      </Text>

      <Text style={bodyTextStyle}>
        The beta is capped at 50 active testers who are deep in daily
        cold-calling right now. We picked based on who&apos;d give us the
        sharpest feedback from real-world use. Everyone else gets first
        access at launch with founder pricing locked in.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 12px" }}>
        Here&apos;s what you get at launch:
      </Text>

      <Text style={benefitTextStyle}>
        •&nbsp;&nbsp;A personal founder code: 50% off Callday for life
      </Text>
      <Text style={benefitTextStyle}>•&nbsp;&nbsp;Your first month free</Text>
      <Text style={{ ...benefitTextStyle, margin: "0 0 16px" }}>
        •&nbsp;&nbsp;Day-zero access — no waitlist, no gate
      </Text>

      <Text style={bodyTextStyle}>
        If you&apos;re actively cold-calling regularly and want a second
        look at the beta, just reply to this email with something that
        proves it — a link to your business website, a recent call log, a
        CRM screenshot, whatever feels right. We re-review applications
        weekly. Either way, your founder spot is locked.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 24px" }}>
        Talk soon,
        <br />
        The Callday team
      </Text>
    </EmailShell>
  );
}

export default LaunchListWelcome;
