/**
 * ApplicationConfirmation — die EINE Mail, die nach Beta-Form-Submit
 * rausgeht. Trägt die TestFlight-Public-Link-Einladung direkt mit, kein
 * manueller Approval-Schritt mehr.
 *
 * Tonalität: warm + funktional. Founder-Spot bestätigen, dann zwei klare
 * Install-Steps. Kein konkreter Preis (Dollar/EUR-Mix, noch nicht final).
 */

import { Button, Link, Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface ApplicationConfirmationProps {
  name: string;
  testflightLink: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

const stepStyle = {
  ...bodyTextStyle,
  margin: "0 0 12px",
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

export function ApplicationConfirmation({
  name,
  testflightLink,
}: ApplicationConfirmationProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="You're in. Install Callday from TestFlight.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        You&apos;re in. Your founder spot is locked in — 50% off Callday
        for life once we launch.
      </Text>

      <Text style={bodyTextStyle}>Two steps to start calling:</Text>

      <Text style={stepStyle}>
        <strong>1.</strong> Install <strong>TestFlight</strong> from the
        App Store. That&apos;s Apple&apos;s official tester app — we ship
        the beta builds through it.
      </Text>

      <Text style={{ ...stepStyle, margin: "0 0 24px" }}>
        <strong>2.</strong> Tap the button below on your iPhone. TestFlight
        opens and installs Callday.
      </Text>

      <Button href={testflightLink} style={buttonStyle}>
        Open in TestFlight
      </Button>

      <Text style={{ ...bodyTextStyle, margin: "24px 0 16px" }}>
        If the button doesn&apos;t work, paste this link into Safari on your
        iPhone:{" "}
        <Link
          href={testflightLink}
          style={{ color: brand.blue, wordBreak: "break-all" }}
        >
          {testflightLink}
        </Link>
      </Text>

      <Text style={bodyTextStyle}>
        Heads up: TestFlight needs iOS 17 or later. The beta is free for
        the full testing period — if anything breaks or you have a
        question, just reply to this email and we&apos;ll take a look.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 24px" }}>
        Talk soon,
        <br />
        The Callday team
      </Text>
    </EmailShell>
  );
}

export default ApplicationConfirmation;
