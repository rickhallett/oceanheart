"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/theme";
import { system as publicSystem } from "@/theme-public";
import { usePathname } from "next/navigation";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <ChakraProvider value={path.startsWith("/app") ? system : publicSystem}>{children}</ChakraProvider>;
}
