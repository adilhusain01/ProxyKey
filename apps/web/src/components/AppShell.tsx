import type { ReactNode } from "react"
import Footer from "./Footer"
import Header from "./Header"
import { Toaster } from "#/components/ui/sonner"
import { CsprClickRuntime } from "./CsprClickRuntime"

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <CsprClickRuntime>
      <Header />
      {children}
      <Footer />
      <Toaster richColors position="top-center" />
    </CsprClickRuntime>
  )
}
