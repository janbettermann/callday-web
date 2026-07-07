import type { PayoutMethod } from "@/lib/affiliate-payout";

/**
 * Visuelle Marke einer Payout-Methode. Kein Client-Hook → in Server- UND
 * Client-Components nutzbar (Payout-Seite + Settings + Admin).
 *
 * PayPal nutzt das offizielle Asset (public/paypal.svg) als background-image
 * (gleiche Technik wie zuvor im Payout-Header). Fuer Wise liegt bewusst KEIN
 * Logo im Repo — statt eine Marke zu faelschen rendern wir einen sauberen
 * Text-Wordmark im Wise-Forest-Green.
 */
export function MethodMark({
  method,
  height = 16,
}: {
  method: PayoutMethod;
  height?: number;
}) {
  if (method === "paypal") {
    return (
      <span
        role="img"
        aria-label="PayPal"
        style={{
          display: "inline-block",
          height,
          width: height * 3.75, // paypal.svg viewBox 124×33 ≈ 3.75
          backgroundImage: "url(/paypal.svg)",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize: height,
        lineHeight: 1,
        letterSpacing: "-0.4px",
        color: "#163300",
      }}
    >
      Wise
    </span>
  );
}
