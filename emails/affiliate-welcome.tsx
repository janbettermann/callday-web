/**
 * AffiliateWelcome — Mail die rausgeht wenn Jan im Admin-Dashboard auf
 * "Send invite" klickt.
 *
 * Bewusst OHNE Vertragsspezifika (Rate, Lifetime, AGB-Klauseln). Die
 * formelle Vereinbarung kommt separat per DocuSign sobald der Anwalt
 * fertig ist — Mail-Body wuerde sonst zur informellen Vertragsgrundlage
 * werden bevor der eigentliche Vertrag steht.
 *
 * Tonalitaet: warm + nuechtern. Affiliate-Link prominent + Copy-Hint,
 * zwei "what's next"-Bullets, "We'll follow up with the formal
 * agreement separately"-Hinweis am Ende.
 */

import { Button, Link, Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface AffiliateWelcomeProps {
  name: string;
  affiliateLink: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

const linkBlockStyle = {
  backgroundColor: brand.bgMuted,
  border: `1px solid ${brand.border}`,
  borderRadius: "10px",
  padding: "16px 18px",
  margin: "0 0 20px",
  fontFamily: "ui-monospace, 'SF Mono', Monaco, Consolas, monospace",
  fontSize: "15px",
  color: brand.text,
  wordBreak: "break-all" as const,
} as const;

const buttonStyle = {
  backgroundColor: brand.blue,
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "14px 28px",
  borderRadius: "10px",
  display: "inline-block",
} as const;

const bulletStyle = {
  ...bodyTextStyle,
  margin: "0 0 12px",
} as const;

const sectionLabelStyle = {
  color: brand.textMuted,
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.4px",
  textTransform: "uppercase" as const,
  margin: "32px 0 8px",
} as const;

const fineStyle = {
  color: brand.textMuted,
  fontSize: "14px",
  lineHeight: 1.5,
  margin: "24px 0 0",
} as const;

export function AffiliateWelcome({
  name,
  affiliateLink,
}: AffiliateWelcomeProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview={`Welcome to the Callday Founding Affiliates, ${firstName}.`}>
      <Text style={bodyTextStyle}>Hey {firstName},</Text>
      <Text style={bodyTextStyle}>
        Welcome to the Callday Founding Affiliates. We&apos;re glad to have
        you on board.
      </Text>

      <Text style={sectionLabelStyle}>Your affiliate link</Text>
      <Text style={linkBlockStyle}>{affiliateLink}</Text>
      <Text style={{ textAlign: "center" as const, margin: "0 0 28px" }}>
        <Button href={affiliateLink} style={buttonStyle}>
          Open your link
        </Button>
      </Text>

      <Text style={sectionLabelStyle}>How it works</Text>
      <Text style={bulletStyle}>
        Share your link anywhere you&apos;d normally talk about Callday —
        bio, captions, posts, DMs. Everyone who signs up through it gets
        attributed to you automatically.
      </Text>
      <Text style={bulletStyle}>
        We send the TestFlight invite to your referrals the moment they
        create their account. No extra step on your side.
      </Text>

      <Text style={fineStyle}>
        We&apos;ll follow up with the formal agreement separately — keep
        an eye on your inbox over the next few days. If you have any
        questions in the meantime, just reply to this email.
      </Text>

      <Text style={{ ...bodyTextStyle, marginTop: "32px" }}>
        Welcome aboard,
        <br />
        The Callday team
      </Text>

      <Text style={fineStyle}>
        Need help?{" "}
        <Link
          href="mailto:hello@callday.io"
          style={{ color: brand.blue, textDecoration: "none" }}
        >
          hello@callday.io
        </Link>
      </Text>
    </EmailShell>
  );
}
