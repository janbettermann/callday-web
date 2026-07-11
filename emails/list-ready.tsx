/**
 * ListReady — Transaktions-Mail des Lead-Generators (callday.io/lists),
 * verschickt sobald ein Generierungs-Job auf 'ready' wechselt. Faengt
 * die User wieder ein, die waehrend der 1–3-Minuten-Wartezeit den Tab
 * geschlossen haben.
 *
 * Bewusst kurz + ohne Sign-off: reine Status-Notification, kein
 * persoenlicher Brief.
 */

import { Link, Text } from "@react-email/components";
import { brand } from "./_lib/brand";
import { EmailShell } from "./_lib/EmailShell";

export interface ListReadyProps {
  listName: string;
  leadCount: number;
}

const bodyTextStyle = {
  color: brand.text,
  fontSize: "16px",
  lineHeight: 1.6,
  margin: "0 0 16px",
} as const;

const ctaStyle = {
  display: "inline-block",
  backgroundColor: brand.blue,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "12px",
} as const;

export function ListReady({ listName, leadCount }: ListReadyProps) {
  return (
    <EmailShell
      preview={`"${listName}" is ready — ${leadCount} callable leads, synced to your Callday account.`}
    >
      <Text style={bodyTextStyle}>
        Good news — your lead list &quot;{listName}&quot; is ready:{" "}
        {leadCount} callable leads, each with a phone number, deduped and
        already synced to your Callday account.
      </Text>

      <Text style={bodyTextStyle}>
        Grab the CSV anytime, or start calling right away — the Callday app
        tracks every outcome automatically.
      </Text>

      <Text style={{ margin: "8px 0 24px" }}>
        <Link href="https://callday.io/lists" style={ctaStyle}>
          View your list
        </Link>
      </Text>
    </EmailShell>
  );
}

export default ListReady;
