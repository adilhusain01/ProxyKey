import { useEffect, useState } from "react"
import { WalletCards } from "lucide-react"
import { Button } from "#/components/ui/button"
import { useProxyKeyStore } from "#/stores/proxykey-store"

type CsprClickAccount = {
  publicKey?: string
  public_key?: string
  accountHash?: string
}

type CsprClickSdk = {
  signIn: () => void
  signOut: () => void
  getActiveAccount: () => CsprClickAccount | null
  on: (event: string, listener: (...args: Array<unknown>) => void) => CsprClickSdk
  off: (event: string, listener: (...args: Array<unknown>) => void) => CsprClickSdk
}

const getCsprClickSdk = () =>
  (window as Window & { csprclick?: CsprClickSdk }).csprclick

function shortenAccount(account: CsprClickAccount | null) {
  const key = account?.publicKey ?? account?.public_key ?? account?.accountHash
  return key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null
}

function accountKey(account: CsprClickAccount | null) {
  return account?.accountHash ?? account?.publicKey ?? account?.public_key ?? ""
}

export default function WalletConnectButton() {
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const setStoreAccount = useProxyKeyStore((state) => state.setAccount)
  const clearStoreAccount = useProxyKeyStore((state) => state.clearAccount)

  useEffect(() => {
    function syncAccount() {
      const sdk = getCsprClickSdk()
      const activeAccount = sdk?.getActiveAccount() ?? null
      const activeKey = accountKey(activeAccount)
      setReady(Boolean(sdk))
      setAccount(shortenAccount(activeAccount))
      if (activeKey) {
        setStoreAccount(activeKey)
      } else {
        clearStoreAccount()
      }
    }

    function bindSdkEvents() {
      const sdk = getCsprClickSdk()
      if (!sdk) return

      sdk.on("csprclick:signed_in", syncAccount)
      sdk.on("csprclick:switched_account", syncAccount)
      sdk.on("csprclick:signed_out", syncAccount)
      sdk.on("csprclick:disconnected", syncAccount)
      syncAccount()
    }

    window.addEventListener("csprclick:loaded", bindSdkEvents)
    bindSdkEvents()

    return () => {
      window.removeEventListener("csprclick:loaded", bindSdkEvents)
      const sdk = getCsprClickSdk()
      sdk?.off("csprclick:signed_in", syncAccount)
      sdk?.off("csprclick:switched_account", syncAccount)
      sdk?.off("csprclick:signed_out", syncAccount)
      sdk?.off("csprclick:disconnected", syncAccount)
    }
  }, [clearStoreAccount, setStoreAccount])

  function handleClick() {
    const sdk = getCsprClickSdk()
    if (!sdk) return

    if (sdk.getActiveAccount()) {
      sdk.signOut()
      return
    }

    sdk.signIn()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden sm:inline-flex"
      onClick={handleClick}
      disabled={!ready}
    >
      <WalletCards className="size-4" />
      {account ?? "CSPR.click"}
    </Button>
  )
}
