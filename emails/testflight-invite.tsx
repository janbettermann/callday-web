/**
 * TestFlightInvite (Template 2) — wird vom Database-Webhook gefeuert,
 * sobald Jan eine Application im Supabase Studio auf status='approved'
 * setzt. Empfänger ist einer der 50 Closed-Beta-Tester.
 *
 * Brand-Voice durchgehend "we". Apple's TestFlight-Mail kommt SEPARAT
 * direkt von Apple — diese Mail erklärt nur den Kontext + Onboarding +
 * Founder-Pricing-Versprechen.
 */

import { Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface TestFlightInviteProps {
  name: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

export function TestFlightInvite({ name }: TestFlightInviteProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="You're in. Welcome to the Callday closed beta.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        You&apos;re in — confirmed as one of 50 testers for the closed
        Callday beta.
      </Text>

      <Text style={bodyTextStyle}>
        Apple will send a separate TestFlight invite email with the install
        link. It usually arrives within minutes, sometimes up to an hour.
        If you don&apos;t see it, check spam and confirm your Apple ID uses
        the same email address you applied with.
      </Text>

      <Text style={bodyTextStyle}>
        The beta is free for the full period. At launch you will receive
        your founder price (€7/mo instead of €14/mo) locked in for life
        plus your first month free.
      </Text>

      <Text style={bodyTextStyle}>
        We&apos;ll check in with you in about a week to hear how it&apos;s
        going. If something breaks before then or you have any questions,
        just reply to this email and we&apos;ll take a look.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 24px" }}>
        Talk soon,
        <br />
        The Callday team
      </Text>
    </EmailShell>
  );
}

export default TestFlightInvite;
