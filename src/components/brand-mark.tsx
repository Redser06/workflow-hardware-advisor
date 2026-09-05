import { cn } from "@/lib/utils";

/**
 * Hardware Fit mark: a caliper closing on a chip. Drawn, not photographed —
 * the product is a measurement, so the identity is a measuring tool.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 text-primary", className)}
    >
      <rect x="11" y="11" width="10" height="10" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <path
        d="M13.5 11V8.5M16 11V8.5M18.5 11V8.5M13.5 21v2.5M16 21v2.5M18.5 21v2.5M11 13.5H8.5M11 16H8.5M11 18.5H8.5M21 13.5h2.5M21 16h2.5M21 18.5h2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M3 4v24M29 4v24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 16h4M25 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
