import type { MDXComponents } from "mdx/types";

/**
 * Style overrides for MDX content (Privacy Policy / Terms of Service).
 * The marketing landing page lives in tsx and styles itself; these
 * defaults give the legal pages a readable typography on top of the
 * light Callday theme so they don't render as plain unstyled markdown.
 *
 * Plain inline styles instead of Tailwind utility classes — Next 16's
 * MDX integration was inferring this file as a Client Component when
 * Tailwind v4 utility classes appeared in the JSX, which broke `metadata`
 * exports from the consuming .mdx pages. Inline styles avoid the
 * compiler boundary issue.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1
        style={{
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 600,
          letterSpacing: "-0.04em",
          marginBottom: "24px",
          marginTop: "8px",
          color: "#1a1d26",
          // Lange deutsche Composita wie "Nutzungsbedingungen" produzieren
          // auf schmalen Phones (<=375px) horizontalen Scroll. `hyphens`
          // greift wenn der article-Wrapper `lang="de"` setzt + der Browser
          // ein Deutsch-Wörterbuch hat (alle modernen Browser tun das);
          // `overflow-wrap: break-word` ist Fallback der notfalls beliebig
          // trennt — verhindert garantiert das horizontale Scrollen.
          hyphens: "auto",
          overflowWrap: "break-word",
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        style={{
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "clamp(20px, 3vw, 28px)",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          marginTop: "48px",
          marginBottom: "16px",
          color: "#1a1d26",
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        style={{
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "clamp(16px, 2vw, 20px)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          marginTop: "32px",
          marginBottom: "12px",
          color: "#1a1d26",
        }}
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p
        style={{
          fontSize: "15px",
          lineHeight: 1.7,
          color: "rgba(26, 29, 38, 0.72)",
          marginBottom: "16px",
        }}
      >
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        style={{
          listStyle: "disc",
          paddingLeft: "24px",
          marginBottom: "16px",
          fontSize: "15px",
          lineHeight: 1.7,
          color: "rgba(26, 29, 38, 0.72)",
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        style={{
          listStyle: "decimal",
          paddingLeft: "24px",
          marginBottom: "16px",
          fontSize: "15px",
          lineHeight: 1.7,
          color: "rgba(26, 29, 38, 0.72)",
        }}
      >
        {children}
      </ol>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        style={{
          color: "#3564e0",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong style={{ color: "#1a1d26", fontWeight: 600 }}>{children}</strong>
    ),
    hr: () => (
      <hr
        style={{
          border: "none",
          borderTop: "1px solid rgba(26, 29, 38, 0.08)",
          margin: "40px 0",
        }}
      />
    ),
    ...components,
  };
}
