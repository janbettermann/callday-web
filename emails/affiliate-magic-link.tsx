/**
 * AffiliateMagicLink — separates Template fuer reguläre Sign-in-Mails.
 *
 * Welcome-Mail (affiliate-welcome.tsx) enthaelt einen first-login-Token
 * mit 24h-TTL. Dieses Template hier ist fuer alle FOLGENDEN Logins:
 * Affiliate ist eingeloggt geweest, Cookie expired (30 Tage), geht
 * auf /affiliate/login, klickt "Send sign-in link", kriegt diese Mail
 * mit einem 15-Min-Token.
 *
 * Bewusst minimal — der User weiss schon was Callday ist, er will nur
 * den Link.
 */

import { Button, Link, Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface AffiliateMagicLinkProps {
  name: string;
  signInUrl: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: 16,
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

const buttonStyle = {
  backgroundColor: brand.blue,
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 600,
  textDecoration: "none",
  padding: "14px 28px",
  borderRadius: 10,
  display: "inline-block",
} as const;

const fineStyle = {
  color: brand.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
  margin: "24px 0 0",
} as const;

export function AffiliateMagicLink({
  name,
  signInUrl,
}: AffiliateMagicLinkProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="Your Callday affiliate sign-in link.">
      <Text style={bodyTextStyle}>Hey {firstName},</Text>
      <Text style={bodyTextStyle}>
        Click below to sign in to your affiliate dashboard. The link is good
        for the next 15 minutes.
      </Text>

      <Text style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Button href={signInUrl} style={buttonStyle}>
          Sign in to your dashboard
        </Button>
      </Text>

      <Text style={fineStyle}>
        Trouble with the button? Copy this URL into your browser:
        <br />
        <Link
          href={signInUrl}
          style={{ color: brand.blue, wordBreak: "break-all" }}
        >
          {signInUrl}
        </Link>
      </Text>

      <Text style={fineStyle}>
        Didn&apos;t request this? Ignore the email — no one can sign in
        without clicking the link.
      </Text>
    </EmailShell>
  );
}
