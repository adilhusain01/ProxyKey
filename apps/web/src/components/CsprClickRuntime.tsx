import { createElement, type ComponentType, type ReactNode, useEffect, useState } from "react"

export function CsprClickRuntime({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<{
    ClickProvider: ComponentType<any>
    ClickUI: ComponentType<any>
    ThemeProvider: ComponentType<any>
    theme: unknown
    contentMode: unknown
  }>()

  useEffect(() => {
    let mounted = true

    async function loadRuntime() {
      console.log("[CsprClickRuntime] Loading CSPR.click runtime modules…")
      const [ui, types, styled] = await Promise.all([
        import("@make-software/csprclick-ui"),
        import("@make-software/csprclick-core-types"),
        import("styled-components"),
      ])

      if (!mounted) return

      console.log("[CsprClickRuntime] Modules loaded. Setting up ClickProvider.")
      setRuntime({
        ClickProvider: ui.ClickProvider,
        ClickUI: ui.ClickUI,
        ThemeProvider: styled.ThemeProvider,
        theme: ui.CsprClickThemes.light,
        contentMode: types.CONTENT_MODE.IFRAME,
      })
    }

    void loadRuntime()

    return () => {
      mounted = false
    }
  }, [])

  if (!runtime) {
    console.log("[CsprClickRuntime] Runtime not ready yet, rendering children without provider.")
    return children
  }

  const walletConnectProjectId = import.meta.env
    .VITE_WALLETCONNECT_PROJECT_ID as string | undefined
  const providers = [
    "casper-wallet",
    "ledger",
    "metamask-snap",
    "casperdash",
    ...(walletConnectProjectId ? ["walletconnect"] : []),
  ]

  const appId =
    (import.meta.env.VITE_CSPRCLICK_APP_ID as string | undefined) ??
    "csprclick-template"

  const options = {
    appName: "ProxyKey",
    appId,
    contentMode: runtime.contentMode,
    providers,
    chainName: "casper-test",
    ...(walletConnectProjectId
      ? { walletConnect: { projectId: walletConnectProjectId } }
      : {}),
  }

  console.log("[CsprClickRuntime] Rendering ClickProvider with options:", options)

  // IMPORTANT: rootAppElement must be a child of <body>, NOT <body> itself.
  // Setting it to "body" causes the browser to block aria-hidden on the body
  // element, which breaks the CSPR.click modal entirely (see console warning).
  const rootAppElement = "#app-root"

  return createElement(
    runtime.ThemeProvider,
    { theme: runtime.theme },
    createElement(
      runtime.ClickProvider,
      { options },
      createElement(runtime.ClickUI, { rootAppElement }) as ReactNode,
      children,
    ),
  )
}
