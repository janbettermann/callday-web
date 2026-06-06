/**
 * EmailShell — gemeinsamer Wrapper für alle Callday-Transaktional-Emails.
 *
 * Verantwortlich für:
 * - Html + Head (inkl. mobile-responsive <style> für den Footer)
 * - Body-Background + Container-Card (white, abgerundet)
 * - "Callday"-Wordmark als Header
 * - Brand-Footer (Tagline links / Links rechts auf Desktop, gestackt auf Mobile)
 * - Hr-Divider vor dem Footer
 *
 * Die Templates schreiben nur den Body-Content (Greeting + Paragraphen +
 * Sign-off) als children und den Preview-Text als prop.
 *
 * Imprint-Link wird gesetzt sobald /imprint live ist (siehe Task #18);
 * bis dahin linkt "callday.io" auf die Homepage als Identitäts-Ankerpage.
 */

import type { ReactNode } from "react";
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
import { brand, fontStack, monoStack } from "./brand";

interface EmailShellProps {
  preview: string;
  children: ReactNode;
}

export function EmailShell({ preview, children }: EmailShellProps) {
  return (
    <Html>
      <Head>
        {/* Mobile-responsive footer: auf <480px wird das 2-Col-Table
            gestackt. Slogan in eigene Zeile, Links darunter mit 40px
            Abstand, beide left-aligned. Desktop bleibt side-by-side. */}
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
      <Preview>{preview}</Preview>
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
          {/* Wordmark Header. Text statt SVG-Logo — Outlook hat schlechten
              SVG-Support, und ein einfaches farbiges Wort liest sich
              brand-konsistent. */}
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

          {children}

          <Hr
            style={{
              borderColor: brand.border,
              borderWidth: "1px 0 0",
              margin: "32px 0 24px",
            }}
          />

          {/* Brand-Footer — Tagline links, Links rechts (Desktop) bzw.
              gestackt mit 40px Gap (Mobile, via Head <style>). */}
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
