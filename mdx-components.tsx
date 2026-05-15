import type { MDXComponents } from "mdx/types";

/**
 * Style overrides for MDX content (Privacy Policy / Terms of Service).
 * The marketing landing page lives in tsx and styles itself; these
 * defaults give the legal pages a readable typography on top of the
 * light Callday theme so they don't render as plain unstyled markdown.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl md:text-5xl font-semibold tracking-[-0.04em] mb-6 mt-2 text-[#1a1d26]">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-[family-name:var(--font-geist-sans)] text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-12 mb-4 text-[#1a1d26]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-[family-name:var(--font-geist-sans)] text-lg md:text-xl font-semibold tracking-[-0.02em] mt-8 mb-3 text-[#1a1d26]">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-[15px] leading-[1.7] text-[rgba(26,29,38,0.72)] mb-4">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-2 text-[15px] leading-[1.7] text-[rgba(26,29,38,0.72)]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-2 text-[15px] leading-[1.7] text-[rgba(26,29,38,0.72)]">
        {children}
      </ol>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-[#3564e0] underline underline-offset-2 hover:text-[#1a1d26] transition-colors"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="text-[#1a1d26] font-semibold">{children}</strong>
    ),
    hr: () => (
      <hr className="border-t border-[rgba(26,29,38,0.08)] my-10" />
    ),
    ...components,
  };
}
