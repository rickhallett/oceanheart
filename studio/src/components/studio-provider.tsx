"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/theme";
import { system as publicSystem } from "@/theme-public";

export function StudioProvider({
  application = false,
  children,
}: {
  application?: boolean;
  children: React.ReactNode;
}) {
  const activeSystem = application ? system : publicSystem;
  return <ChakraProvider value={activeSystem}>{children}</ChakraProvider>;
}
