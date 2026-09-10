import { Button, Link, Text } from "@chakra-ui/react";
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
    <Button asChild colorPalette="copper" color="copper.contrast" _hover={{ color: "copper.contrast" }} _focusVisible={{ color: "copper.contrast" }} _active={{ color: "copper.contrast" }} size="lg" rounded="full" className={`button ${className}`}><a {...props}>
      {children}
      <ArrowRight size={19} strokeWidth={1.2} />
    </a></Button>
  );
}
export function TextLink({
  children,
  className = "",
  ...props
}: ComponentProps<"a">) {
  return (
    <Link className={`text-link ${className}`} {...props} color="copper.300" gap={3}>
      {children}
      <ArrowRight size={16} strokeWidth={1.2} />
    </Link>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text className="eyebrow" textTransform="uppercase" letterSpacing="0.18em" fontSize="xs" fontWeight="600" color="copper.300">{children}</Text>;
}
