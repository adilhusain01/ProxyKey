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
      console.log("[WalletConnect] applyAccount →", { activeAccount, activeKey });
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
        console.log("[WalletConnect] readActiveAccount: SDK not available");
        return null;
      }
      try {
        const result =
          (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null;
        console.log("[WalletConnect] readActiveAccount →", result);
        return result;
      } catch (err) {
        console.error("[WalletConnect] readActiveAccount threw:", err);
        return sdk.getActiveAccount() ?? null;
      }
    }

    async function syncAccount(...payloads: Array<unknown>) {
      console.log("[WalletConnect] syncAccount fired. Payloads:", payloads);
      const sdk = getCsprClickSdk();
      const activeAccount =
        payloadAccount(payloads) ?? (await readActiveAccount());
      const activeKey = accountKey(activeAccount);
      console.log("[WalletConnect] syncAccount resolved:", {
        activeAccount,
        activeKey: activeKey || "(none)",
        sdkAvailable: Boolean(sdk),
      });
      setReady(Boolean(sdk));
      // Only update state — do NOT call cancelSignIn() here. Calling it from
      // this background event handler races with the wallet popup and closes
      // the "Connect / Next" dialog before the user can confirm.
      applyAccount(activeKey ? activeAccount : null);
    }

    function bindSdkEvents() {
      // Prevent duplicate listener registration (React StrictMode, HMR,
      // multiple csprclick:loaded firings all re-enter this function).
      if (boundRef.current) {
        console.log("[WalletConnect] bindSdkEvents: already bound, skipping.");
        return;
      }
      const sdk = getCsprClickSdk();
      if (!sdk) {
        console.log("[WalletConnect] bindSdkEvents: SDK not found, skipping.");
        return;
      }

      console.log("[WalletConnect] bindSdkEvents: SDK found — binding events NOW.");
      boundRef.current = true;

      sdk.on("csprclick:signed_in", syncAccount);
      sdk.on("csprclick:switched_account", syncAccount);
      sdk.on("csprclick:signed_out", syncAccount);
      sdk.on("csprclick:disconnected", syncAccount);

      // Also log every other SDK event so we can see what fires during
      // the Casper Wallet connection attempt.
      const debugEvents = [
        "csprclick:sign_in",
        "csprclick:unsolicited_account_change",
        "csprclick:request-user-action",
        "csprclick:provider-status-update",
        "csprclick:provider-transaction-review",
        "csprclick:switch_account",
      ] as const;
      for (const evt of debugEvents) {
        sdk.on(evt, (...args: Array<unknown>) => {
          console.log(`[WalletConnect] SDK event "${evt}":`, args);
        });
      }

      void syncAccount();
    }

    // Store a stable reference so we can remove it in cleanup.
    const onLoaded = () => {
      console.log("[WalletConnect] csprclick:loaded window event fired.");
      bindSdkEvents();
    };

    window.addEventListener("csprclick:loaded", onLoaded);
    bindSdkEvents();

    return () => {
      window.removeEventListener("csprclick:loaded", onLoaded);
      boundRef.current = false; // allow re-bind if component remounts
      const sdk = getCsprClickSdk();
      sdk?.off("csprclick:signed_in", syncAccount);
      sdk?.off("csprclick:switched_account", syncAccount);
      sdk?.off("csprclick:signed_out", syncAccount);
      sdk?.off("csprclick:disconnected", syncAccount);
    };
  }, [clearStoreAccount, setStoreAccount]);

  async function waitForAccount() {
    console.log("[WalletConnect] waitForAccount: polling (max 30 × 500 ms)…");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const sdk = getCsprClickSdk();
      let activeAccount: CsprClickAccount | null = null;

      try {
        activeAccount =
          (await sdk?.getActiveAccountAsync?.()) ??
          sdk?.getActiveAccount() ??
          null;
      } catch (err) {
        console.warn(`[WalletConnect] waitForAccount attempt ${attempt + 1}: getActiveAccountAsync threw:`, err);
        activeAccount = sdk?.getActiveAccount() ?? null;
      }

      const activeKey = accountKey(activeAccount);
      console.log(`[WalletConnect] waitForAccount attempt ${attempt + 1}/30:`, {
        activeAccount,
        activeKey: activeKey || "(none)",
      });

      if (activeKey) {
        console.log("[WalletConnect] waitForAccount: account found! Calling cancelSignIn.");
        setAccount(shortenAccount(activeAccount));
        setStoreAccount(activeKey);
        sdk?.cancelSignIn?.();
        return true;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    console.warn("[WalletConnect] waitForAccount: timed out — no account detected.");
    return false;
  }

  async function handleClick() {
    console.log("[WalletConnect] handleClick triggered.");
    const sdk = getCsprClickSdk();
    if (!sdk) {
      console.error("[WalletConnect] handleClick: SDK unavailable — window.csprclick is undefined.");
      return;
    }

    const activeAccount =
      (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null;
    console.log("[WalletConnect] handleClick: current active account:", activeAccount);

    if (activeAccount) {
      console.log("[WalletConnect] handleClick: already signed in — signing out.");
      sdk.signOut();
      return;
    }

    console.log("[WalletConnect] handleClick: calling sdk.signIn()…");
    sdk.signIn();

    console.log("[WalletConnect] handleClick: waiting for account via polling…");
    const connected = await waitForAccount();
    console.log("[WalletConnect] handleClick: waitForAccount result:", connected);

    if (connected) {
      console.log("[WalletConnect] handleClick: connected via polling. Done.");
      return;
    }

    if (!sdk.connect) {
      console.warn("[WalletConnect] handleClick: sdk.connect not available. Giving up.");
      return;
    }

    // ⚠️ IMPORTANT: cancel the sign-in modal BEFORE calling sdk.connect().
    // sdk.connect() is a programmatic fallback — it cannot run while the
    // sign-in modal is still open or it will throw internally.
    console.log("[WalletConnect] handleClick: cancelling sign-in modal before direct connect…");
    sdk.cancelSignIn?.();

    console.log("[WalletConnect] handleClick: falling back to sdk.connect('casper-wallet')…");
    let connectedAccount: CsprClickAccount | undefined;
    try {
      connectedAccount = await sdk.connect("casper-wallet");
      console.log("[WalletConnect] handleClick: sdk.connect resolved:", connectedAccount);
    } catch (err) {
      console.error("[WalletConnect] handleClick: sdk.connect threw an error:", err);
      // Log extra details if it's an object (CSPR.click often throws plain objects)
      if (err && typeof err === "object") {
        console.error("[WalletConnect] sdk.connect error details:", JSON.stringify(err, null, 2));
      }
      return;
    }

    if (!connectedAccount) {
      console.warn("[WalletConnect] handleClick: sdk.connect returned no account.");
      return;
    }

    console.log("[WalletConnect] handleClick: calling signInWithAccount…");
    try {
      await sdk.signInWithAccount?.(connectedAccount);
    } catch (err) {
      console.error("[WalletConnect] handleClick: signInWithAccount threw:", err);
    }
    sdk.cancelSignIn?.();
    setAccount(shortenAccount(connectedAccount));
    setStoreAccount(accountKey(connectedAccount));
    console.log("[WalletConnect] handleClick: connection complete via sdk.connect fallback.");
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
  );
}
