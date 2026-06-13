/**
 * FounderCodeAtLaunch (Template 4) — wird vom Launch-Day-Script
 * (scripts/launch-send-codes.ts) verschickt sobald Callday im App Store
 * live ist. Geht an alle applications mit
 * status IN ('approved','launch_list','active_beta') AND founder_code IS NULL.
 *
 * Tonalitaet-Vorgabe (siehe BETA_WORKFLOW_PLAN.md Template 4 + Brand-Voice-
 * Memory): "we" durchgaengig, keine Hobby-Vokabel, kein persoenliches
 * Sign-off; faktisch + CTA-fokussiert.
 *
 * Props:
 *   - name         — fuer die Begruessung
 *   - founderCode  — der individuell generierte Stripe Promotion-Code
 *                    (Format: CALLDAY-XXXXXX). Erscheint prominent als
 *                    Monospace-Pillen-Box + im CTA-Link.
 */

import { Button, Section, Text } from "@react-email/components";
import { brand, monoStack } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface FounderCodeAtLaunchProps {
  name: string;
  founderCode: string;
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

export function FounderCodeAtLaunch({
  name,
  founderCode,
}: FounderCodeAtLaunchProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";
  const checkoutUrl = `https://callday.io/checkout?code=${encodeURIComponent(founderCode)}`;

  return (
    <EmailShell preview="Callday is live in the App Store. Your founder code is inside — lock in your founder price for life.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        Callday is now live in the App Store. As promised, here&apos;s your
        personal founder code:
      </Text>

      <Section
        style={{
          backgroundColor: brand.bgMuted,
          border: `1px solid ${brand.border}`,
          borderRadius: "10px",
          padding: "18px 16px",
          margin: "8px 0 24px",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            fontFamily: monoStack,
            fontSize: "20px",
            fontWeight: 700,
            color: brand.text,
            letterSpacing: "1.5px",
            margin: 0,
          }}
        >
          {founderCode}
        </Text>
      </Section>

      <Text style={{ ...bodyTextStyle, margin: "0 0 12px" }}>
        Your code locks in:
      </Text>

      <Text style={benefitTextStyle}>•&nbsp;&nbsp;First month free</Text>
      <Text style={benefitTextStyle}>
        •&nbsp;&nbsp;€7/mo for life (€14/mo is the standard price)
      </Text>
      <Text style={{ ...benefitTextStyle, margin: "0 0 28px" }}>
        •&nbsp;&nbsp;Active as long as your subscription stays active
      </Text>

      <Section style={{ margin: "0 0 28px" }}>
        <Button
          href={checkoutUrl}
          style={{
            backgroundColor: brand.blue,
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 600,
            textDecoration: "none",
            padding: "14px 28px",
            borderRadius: "10px",
            display: "inline-block",
          }}
        >
          Activate your founder pricing
        </Button>
      </Section>

      <Text style={bodyTextStyle}>
        If you&apos;ve already been using the beta, your account stays. The
        code applies to your first paid month.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 24px" }}>
        Talk soon,
        <br />
        The Callday team
      </Text>
    </EmailShell>
  );
}

export default FounderCodeAtLaunch;
