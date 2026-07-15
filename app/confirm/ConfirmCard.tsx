"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  SIGNUP_CODE_LENGTH,
  clearSignupConfirmHandoff,
  readSignupConfirmHandoff,
  sendTestflightInviteMail,
  type SignupConfirmHandoff,
} from "@/lib/signup-confirm";

type Status = "idle" | "submitting" | "error";

/**
 * Code-Eingabe-Card auf /confirm. Kriegt die Email via sessionStorage-
 * Handoff aus der SignupForm (siehe lib/signup-confirm.ts). Ohne Handoff
 * (frischer Tab, Reload nach Verify, direkter Aufruf) rendert sie ein
 * Email-Feld dazu — verifyOtp braucht nur Email + Code, der Flow
 * funktioniert also auch ohne den Handoff-State.
 */
export function ConfirmCard() {
  const router = useRouter();

  // undefined = Handoff noch nicht gelesen. sessionStorage gibt's erst
  // nach Mount — ein Read im useState-Initializer wuerde beim
  // SSR-Hydrate mismatchen. null = kein Handoff → Email-Feld zeigen.
  const [handoff, setHandoff] = useState<
    SignupConfirmHandoff | null | undefined
  >(undefined);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = readSignupConfirmHandoff();
    setHandoff(stored);
    if (stored) setEmail(stored.email);
  }, []);

  const askForEmail = handoff === null;

  function resetMessages() {
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    resetMessages();

    const cleanEmail = email.trim();

    // Client-Validation statt disabled-Button (Pattern wie SignupForm).
    if (askForEmail && !cleanEmail) {
      setErrorMessage("Enter the email you signed up with.");
      return;
    }
    if (code.length !== SIGNUP_CODE_LENGTH) {
      setErrorMessage(
        `Enter the ${SIGNUP_CODE_LENGTH}-digit code from your email.`,
      );
      return;
    }

    setStatus("submitting");

    const supabase = createSupabaseBrowser();
    // type: "email" deckt sowohl den Confirm-Signup-Token als auch
    // normales OTP ab (gleicher Endpoint, siehe /login).
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    clearSignupConfirmHandoff();

    // Email ist jetzt verifiziert — TestFlight-Mail rausschicken.
    void sendTestflightInviteMail("ConfirmCard");

    // Funnel-Einstiege (z. B. /lists) geben ihr Ziel im Handoff mit;
    // Default ist das Dashboard (Post-Login-Startseite seit 2026-07-15).
    router.push(handoff?.next ?? "/dashboard");
  }

  /**
   * Triggert frischen Code via signInWithOtp. Bei Rate-Limit zeigen wir
   * Supabase's Message direkt — User kann es nach der angegebenen
   * Wartezeit erneut versuchen.
   */
  async function handleResendOtp() {
    if (status === "submitting" || !email.trim()) return;
    resetMessages();
    setStatus("submitting");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    setStatus("idle");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setInfoMessage(
      `A new ${SIGNUP_CODE_LENGTH}-digit code is on its way to ${email.trim()}.`,
    );
    setCode("");
  }

  // Ein Effect-Tick lang nichts rendern statt kurz das Email-Fallback-
  // Feld aufblitzen zu lassen, obwohl der Handoff gleich da ist.
  if (handoff === undefined) return null;

  return (
    <div className="login-card">
      <h1 className="login-headline">Check your inbox</h1>
      <p className="login-sub confirm-sub">
        {infoMessage ??
          (askForEmail ? (
            <>
              Enter the email you signed up with and the{" "}
              {SIGNUP_CODE_LENGTH}-digit code we sent you.
            </>
          ) : handoff.variant === "welcome-back" ? (
            <>
              Welcome back. Enter the confirmation code we sent to{" "}
              <strong>{handoff.email}</strong> and you&apos;re in — or
              request a new one if it expired.
            </>
          ) : (
            <>
              Enter the confirmation code we sent to{" "}
              <strong>{handoff.email}</strong>. Then you&apos;re in.
            </>
          ))}
      </p>

      <form className="beta-form" onSubmit={handleVerifyCode} noValidate>
        {askForEmail && (
          <label className="beta-field">
            <span className="beta-field-label">Email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={status === "submitting"}
            />
          </label>
        )}

        <div className="beta-field">
          <input
            type="text"
            required
            autoFocus={!askForEmail}
            aria-label="Confirmation code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value.replace(/\D/g, "").slice(0, SIGNUP_CODE_LENGTH),
              )
            }
            placeholder="12345678"
            disabled={status === "submitting"}
            style={{
              letterSpacing: "0.4em",
              textAlign: "center",
              fontSize: "22px",
              fontFamily:
                "ui-monospace, 'SF Mono', Monaco, Consolas, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>

        {/* maxLength bewusst NICHT auf dem Input — wenn der User einen
            formatierten Code paste'd (z.B. "1234 5678" mit Space), wuerde
            maxLength=8 die Eingabe VOR onChange truncaten und das Regex
            koennte die 8 Digits nicht mehr extrahieren. Stattdessen
            uebernimmt der replace+slice im onChange die Begrenzung. */}

        <button
          type="submit"
          className="beta-submit"
          aria-busy={status === "submitting"}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Verifying..." : "Confirm account"}
        </button>

        {errorMessage && (
          <p className="beta-submit-error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={handleResendOtp}
        disabled={status === "submitting" || !email.trim()}
        className="login-text-link"
        style={{ display: "block", margin: "16px auto 0" }}
      >
        Didn&apos;t get the code? Send a new one
      </button>

      <Link href="/#beta" className="login-back-link">
        ← Wrong email? Start over
      </Link>
    </div>
  );
}
