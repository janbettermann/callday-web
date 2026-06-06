/**
 * ApplicationConfirmation — wird inline aus /api/beta/apply abgefeuert,
 * sobald jemand das Beta-Application-Form submitted.
 *
 * Design-Entscheidungen:
 * - Text-Wordmark statt SVG-Logo (Outlook hat schlechten SVG-Support)
 * - Inline-Styles statt Stylesheets (Standard fuer Mail-Clients)
 * - Neutrale Light-Background, dark text — laeuft in Light + Dark Modes
 * - Brand-Blau (#2563E8) als einziger Color-Akzent
 * - Footer mit Impressum-Pflichtangaben (Adresse) + Reply-To-Hinweis
 */

import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export interface ApplicationConfirmationProps {
  name: string;
}

const brand = {
  blue: "#2563E8",
  text: "#1a1d23",
  textMuted: "#6b7280",
  // Matches landing page --ink-faint = rgba(26,29,38,0.42) on cream
  textFaint: "#9ea0a8",
  bg: "#ffffff",
  bgMuted: "#f8f9fb",
  border: "#e5e7eb",
};

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif';

const monoStack =
  'ui-monospace, "SF Mono", Monaco, Consolas, "Courier New", monospace';

export function ApplicationConfirmation({
  name,
}: ApplicationConfirmationProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <Html>
      <Head>
        {/* Mobile-responsive footer: auf <480px wird das 2-Col-Table
            der Row gestackt. Slogan rutscht in eigene Zeile, Links
            darunter mit 40px Abstand, beide left-aligned. Desktop bleibt
            wie gehabt (Slogan links, Links rechts). */}
        <style>{`
          @media only screen and (max-width: 480px) {
            .footer-col-left,
            .footer-col-right {
              display: block !important;
              width: 100% !important;
              text-align: left !important;
            }
            .footer-col-right {
              padding-top: 40px !important;
            }
          }
        `}</style>
      </Head>
      <Preview>
        We got your Callday beta application — we&apos;ll be in touch within
        48 hours.
      </Preview>
      <Body
        style={{
          backgroundColor: brand.bgMuted,
          fontFamily: fontStack,
          margin: 0,
          padding: "40px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: brand.bg,
            maxWidth: "560px",
            margin: "0 auto",
            padding: "40px 32px",
            borderRadius: "12px",
          }}
        >
          {/* Wordmark Header */}
          <Section style={{ marginBottom: "32px" }}>
            <Text
              style={{
                color: brand.blue,
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "-0.5px",
                margin: 0,
              }}
            >
              Callday
            </Text>
          </Section>

          {/* Greeting */}
          <Text
            style={{
              color: brand.text,
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            Hi {firstName},
          </Text>

          {/* Body */}
          <Text
            style={{
              color: brand.text,
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            We got your application — thanks for putting your time on the
            line.
          </Text>

          <Text
            style={{
              color: brand.text,
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            We&apos;ll review it and get back to you within 48 hours with
            next steps.
          </Text>

          <Text
            style={{
              color: brand.text,
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            Either way, your founder spot is locked in: a personal code at
            launch, 50% off Callday for life, plus your first month free.
          </Text>

          <Text
            style={{
              color: brand.text,
              fontSize: "16px",
              lineHeight: 1.6,
              margin: "0 0 24px",
            }}
          >
            Talk soon,
            <br />
            The Callday team
          </Text>

          {/* Divider */}
          <Hr
            style={{
              borderColor: brand.border,
              borderWidth: "1px 0 0",
              margin: "32px 0 24px",
            }}
          />

          {/* Brand tagline (left) + links (right) — mirrored vom Landing-
              Page-Footer: monospace tagline + clean text links ohne
              Separator-Dots, ohne Underline. Persönliche Adresse bewusst
              raus (siehe Brand-Voice-Memory feedback_brand_voice_callday.md).
              Imprint-Link wird gesetzt sobald /imprint live ist (Task #18).
              Auf Mobile (<480px) stacken die Columns vertikal — siehe
              <style> im <Head>. */}
          <Section>
            <Row>
              <Column
                className="footer-col-left"
                style={{ verticalAlign: "middle" }}
              >
                <Text
                  style={{
                    fontFamily: monoStack,
                    fontSize: "11px",
                    color: brand.textFaint,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  Make today a Callday.
                </Text>
              </Column>
              <Column
                className="footer-col-right"
                style={{ verticalAlign: "middle", textAlign: "right" }}
              >
                <Link
                  href="https://callday.io"
                  style={{
                    color: brand.textFaint,
                    textDecoration: "none",
                    fontSize: "13px",
                  }}
                >
                  callday.io
                </Link>
                <Link
                  href="https://callday.io/privacy"
                  style={{
                    color: brand.textFaint,
                    textDecoration: "none",
                    fontSize: "13px",
                    marginLeft: "32px",
                  }}
                >
                  Privacy
                </Link>
                <Link
                  href="https://callday.io/terms"
                  style={{
                    color: brand.textFaint,
                    textDecoration: "none",
                    fontSize: "13px",
                    marginLeft: "32px",
                  }}
                >
                  Terms
                </Link>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ApplicationConfirmation;
