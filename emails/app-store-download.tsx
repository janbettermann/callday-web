/**
 * AppStoreDownload — die Post-Signup-Mail ab dem App-Store-Launch
 * (APP_STORE_LIVE=true in lib/app-download.ts). Ersetzt die
 * TestFlight-2-Step-Anleitung (application-confirmation.tsx) durch den
 * direkten Store-Download: ein Button, kein Zwischenschritt.
 *
 * Tonalitaet wie die TestFlight-Variante: warm + funktional, kein
 * Pricing in der Mail (der Trial wird in App/Store kommuniziert).
 */

import { Button, Link, Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface AppStoreDownloadProps {
  name: string;
  appStoreLink: string;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
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

export function AppStoreDownload({ name, appStoreLink }: AppStoreDownloadProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  return (
    <EmailShell preview="You're in. Download Callday and start calling.">
      <Text style={bodyTextStyle}>Hi {firstName},</Text>

      <Text style={bodyTextStyle}>
        You&apos;re in. Download Callday on your iPhone and sign in with
        the account you just created:
      </Text>

      <Button href={appStoreLink} style={buttonStyle}>
        Download Callday
      </Button>

      <Text style={{ ...bodyTextStyle, margin: "24px 0 16px" }}>
        If the button doesn&apos;t work, paste this link into Safari on
        your iPhone:{" "}
        <Link
          href={appStoreLink}
          style={{ color: brand.blue, wordBreak: "break-all" }}
        >
          {appStoreLink}
        </Link>
      </Text>

      <Text style={bodyTextStyle}>
        If anything breaks or you have a question, just reply to this
        email and we&apos;ll take a look.
      </Text>

      <Text style={{ ...bodyTextStyle, margin: "0 0 24px" }}>
        Talk soon,
        <br />
        The Callday team
      </Text>
    </EmailShell>
  );
}

export default AppStoreDownload;
