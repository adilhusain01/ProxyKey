import { useEffect, useRef, useState } from "react";
import { WalletCards } from "lucide-react";
import { accountHashFromPublicKey } from "@proxykey/casper";
import { Button } from "#/components/ui/button";
import { useProxyKeyStore } from "#/stores/proxykey-store";

type CsprClickAccount = {
  publicKey?: string;
  public_key?: string;
  accountHash?: string;
};

type CsprClickSdk = {
  signIn: () => void;
  cancelSignIn?: () => void;
  signInWithAccount?: (account: unknown) => Promise<unknown>;
  signOut: () => void;
  getActiveAccount: () => CsprClickAccount | null;
  getActiveAccountAsync?: () => Promise<CsprClickAccount | null>;
  connect?: (
    provider: string,
    options?: unknown,
  ) => Promise<CsprClickAccount | undefined>;
  isConnected?: (provider: string) => Promise<boolean | undefined>;
  on: (
    event: string,
    listener: (...args: Array<unknown>) => void,
  ) => CsprClickSdk;
  off: (
    event: string,
    listener: (...args: Array<unknown>) => void,
  ) => CsprClickSdk;
};

const getCsprClickSdk = () =>
  (window as unknown as Window & { csprclick?: CsprClickSdk }).csprclick;

function shortenAccount(account: CsprClickAccount | null) {
  const key = account?.publicKey ?? account?.public_key ?? account?.accountHash;
  return key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null;
}

function accountKey(account: CsprClickAccount | null) {
  const publicKey = account?.publicKey ?? account?.public_key;
  if (account?.accountHash) return account.accountHash;
  if (!publicKey) return "";

  try {
    return accountHashFromPublicKey(publicKey);
  } catch {
    return publicKey;
  }
}

function payloadAccount(payloads: Array<unknown>) {
  const event = payloads.find(
    (payload): payload is { account?: CsprClickAccount } =>
      payload !== null && typeof payload === "object" && "account" in payload,
  );
  return event?.account ?? null;
}

export default function WalletConnectButton() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const setStoreAccount = useProxyKeyStore((state) => state.setAccount);
  const clearStoreAccount = useProxyKeyStore((state) => state.clearAccount);

  // Guard: ensure we only register SDK event listeners once even if the
  // effect runs multiple times (React StrictMode, HMR, etc.)
  const boundRef = useRef(false);

  useEffect(() => {
    function applyAccount(activeAccount: CsprClickAccount | null) {
      const activeKey = accountKey(activeAccount);
      setAccount(shortenAccount(activeAccount));
      if (activeKey) {
        setStoreAccount(activeKey);
      } else {
        clearStoreAccount();
      }
      return Boolean(activeKey);
    }

    async function readActiveAccount() {
      const sdk = getCsprClickSdk();
      if (!sdk) {
        return null;
      }
      try {
        const result =
          (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null;
        return result;
      } catch (err) {
        console.error("[WalletConnect] readActiveAccount failed:", err);
        return sdk.getActiveAccount() ?? null;
      }
    }

    async function syncAccount(...payloads: Array<unknown>) {
      const sdk = getCsprClickSdk();
      const activeAccount =
        payloadAccount(payloads) ?? (await readActiveAccount());
      const activeKey = accountKey(activeAccount);
      setReady(Boolean(sdk));
      applyAccount(activeKey ? activeAccount : null);
    }

    function bindSdkEvents() {
      if (boundRef.current) {
        return;
      }
      const sdk = getCsprClickSdk();
      if (!sdk) {
        return;
      }

      boundRef.current = true;

      sdk.on("csprclick:signed_in", syncAccount);
      sdk.on("csprclick:switched_account", syncAccount);
      sdk.on("csprclick:signed_out", syncAccount);
      sdk.on("csprclick:disconnected", syncAccount);

      void syncAccount();
    }

    const onLoaded = () => {
      bindSdkEvents();
    };

    window.addEventListener("csprclick:loaded", onLoaded);
    bindSdkEvents();

    return () => {
      window.removeEventListener("csprclick:loaded", onLoaded);
      boundRef.current = false;
      const sdk = getCsprClickSdk();
      sdk?.off("csprclick:signed_in", syncAccount);
      sdk?.off("csprclick:switched_account", syncAccount);
      sdk?.off("csprclick:signed_out", syncAccount);
      sdk?.off("csprclick:disconnected", syncAccount);
    };
  }, [clearStoreAccount, setStoreAccount]);

  async function waitForAccount() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const sdk = getCsprClickSdk();
      let activeAccount: CsprClickAccount | null = null;

      try {
        activeAccount =
          (await sdk?.getActiveAccountAsync?.()) ??
          sdk?.getActiveAccount() ??
          null;
      } catch (err) {
        console.warn("[WalletConnect] getActiveAccountAsync failed:", err);
        activeAccount = sdk?.getActiveAccount() ?? null;
      }

      const activeKey = accountKey(activeAccount);

      if (activeKey) {
        setAccount(shortenAccount(activeAccount));
        setStoreAccount(activeKey);
        sdk?.cancelSignIn?.();
        return true;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    return false;
  }

  async function handleClick() {
    const sdk = getCsprClickSdk();
    if (!sdk) {
      console.error("[WalletConnect] SDK unavailable.");
      return;
    }

    const activeAccount =
      (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null;
    if (activeAccount) {
      sdk.signOut();
      return;
    }

    sdk.signIn();

    const connected = await waitForAccount();

    if (connected) {
      return;
    }

    if (!sdk.connect) {
      console.warn("[WalletConnect] sdk.connect is not available.");
      return;
    }

    sdk.cancelSignIn?.();

    let connectedAccount: CsprClickAccount | undefined;
    try {
      connectedAccount = await sdk.connect("casper-wallet");
    } catch (err) {
      console.error("[WalletConnect] sdk.connect failed:", err);
      if (err && typeof err === "object") {
        console.error("[WalletConnect] sdk.connect error details:", JSON.stringify(err, null, 2));
      }
      return;
    }

    if (!connectedAccount) {
      console.warn("[WalletConnect] sdk.connect returned no account.");
      return;
    }

    try {
      await sdk.signInWithAccount?.(connectedAccount);
    } catch (err) {
      console.error("[WalletConnect] signInWithAccount failed:", err);
    }
    sdk.cancelSignIn?.();
    setAccount(shortenAccount(connectedAccount));
    setStoreAccount(accountKey(connectedAccount));
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-11 max-w-[12rem] justify-start truncate sm:max-w-none"
      onClick={handleClick}
      disabled={!ready}
    >
      <WalletCards className="size-4" />
      {account ?? "CSPR.click"}
    </Button>
  );
}
