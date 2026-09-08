import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M54.8 30.1A25 25 0 1 0 49.7 48.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M17 35c9 0 12-10 20-5s12 8 24 0"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function ButtonLink({
  children,
  className = "",
  ...props
}: ComponentProps<"a">) {
  return (
    <a className={`button ${className}`} {...props}>
      {children}
      <ArrowRight size={19} strokeWidth={1.2} />
    </a>
  );
}
export function TextLink({
  children,
  className = "",
  ...props
}: ComponentProps<"a">) {
  return (
    <a className={`text-link ${className}`} {...props}>
      {children}
      <ArrowRight size={16} strokeWidth={1.2} />
    </a>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
