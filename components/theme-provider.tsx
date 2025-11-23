"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// We use React.ComponentProps to automatically get the correct types
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}