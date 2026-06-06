/**
 * ApplicationConfirmation (Template 1) — wird inline aus /api/beta/apply
 * gefeuert, sobald jemand das Beta-Application-Form submitted.
 *
 * Tonalität-Vorgabe (siehe BETA_WORKFLOW_PLAN.md Template 1):
 * Erste Mail preempted KEINE Selektions-Entscheidung. Brand-Voice
 * neutral mit konkretem Founder-Benefit der unabhängig vom Outcome gilt.
 */

import { Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface ApplicationConfirmationProps {
  name: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

export function ApplicationConfirmation({
  name,
}: ApplicationConfirmationProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="We got your Callday beta application — we'll be in touch within 48 hours.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        We got your application — thanks for putting your time on the line.
      </Text>

      <Text style={bodyTextStyle}>
        We&apos;ll review it and get back to you within 48 hours with next
        steps.
      </Text>

      <Text style={bodyTextStyle}>
        Either way, your founder spot is locked in: a personal code at
        launch, 50% off Callday for life, plus your first month free.
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
