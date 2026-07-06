import { useEffect, useState } from "react";
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
      if (!sdk) return null;
      return (
        (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null
      );
    }

    async function syncAccount(...payloads: Array<unknown>) {
      const sdk = getCsprClickSdk();
      const activeAccount =
        payloadAccount(payloads) ?? (await readActiveAccount());
      const activeKey = accountKey(activeAccount);
      setReady(Boolean(sdk));
      applyAccount(activeKey ? activeAccount : null);
      if (activeKey) sdk?.cancelSignIn?.();
    }

    function bindSdkEvents() {
      const sdk = getCsprClickSdk();
      if (!sdk) return;

      sdk.on("csprclick:signed_in", syncAccount);
      sdk.on("csprclick:switched_account", syncAccount);
      sdk.on("csprclick:signed_out", syncAccount);
      sdk.on("csprclick:disconnected", syncAccount);
      void syncAccount();
    }

    window.addEventListener("csprclick:loaded", bindSdkEvents);
    bindSdkEvents();

    return () => {
      window.removeEventListener("csprclick:loaded", bindSdkEvents);
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
      const activeAccount =
        (await sdk?.getActiveAccountAsync?.()) ??
        sdk?.getActiveAccount() ??
        null;
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
    if (!sdk) return;

    const activeAccount =
      (await sdk.getActiveAccountAsync?.()) ?? sdk.getActiveAccount() ?? null;
    if (activeAccount) {
      sdk.signOut();
      return;
    }

    sdk.signIn();
    const connected = await waitForAccount();
    if (connected || !sdk.connect) return;

    const account = await sdk.connect("casper-wallet");
    if (!account) return;

    await sdk.signInWithAccount?.(account);
    sdk.cancelSignIn?.();
    setAccount(shortenAccount(account));
    setStoreAccount(accountKey(account));
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
