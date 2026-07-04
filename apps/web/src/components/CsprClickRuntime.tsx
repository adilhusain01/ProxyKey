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
      const [ui, types, styled] = await Promise.all([
        import("@make-software/csprclick-ui"),
        import("@make-software/csprclick-core-types"),
        import("styled-components"),
      ])

      if (!mounted) return

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

  const options = {
    appName: "ProxyKey",
    appId:
      (import.meta.env.VITE_CSPRCLICK_APP_ID as string | undefined) ??
      "csprclick-template",
    contentMode: runtime.contentMode,
    providers,
    chainName: "casper-test",
    ...(walletConnectProjectId
      ? { walletConnect: { projectId: walletConnectProjectId } }
      : {}),
  }

  return createElement(
    runtime.ThemeProvider,
    { theme: runtime.theme },
    createElement(
      runtime.ClickProvider,
      { options },
      createElement(runtime.ClickUI, { rootAppElement: "body" }) as ReactNode,
      children,
    ),
  )
}
