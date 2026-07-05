import {
  buildContractCallTransaction,
  type PreparedDeploy,
} from "@proxykey/casper"

type CsprClickAccount = {
  publicKey?: string
  public_key?: string
}

type CsprClickSendResult = {
  cancelled: boolean
  deployHash: string | null
  transactionHash: string | null
  error: string | null
}

type CsprClickSdk = {
  getActiveAccount: () => CsprClickAccount | null
  send: (
    transaction: string | object,
    signingPublicKey: string,
    waitProcessing?: boolean,
  ) => Promise<CsprClickSendResult | undefined>
}

export function requireProxyKeyContractHash() {
  const contractHash = import.meta.env.VITE_PROXYKEY_CONTRACT_HASH as
    | string
    | undefined

  if (!contractHash) {
    throw new Error("VITE_PROXYKEY_CONTRACT_HASH is not configured")
  }

  return contractHash
}

function getCsprClickSdk() {
  return (window as Window & { csprclick?: CsprClickSdk }).csprclick
}

function getActivePublicKey(sdk: CsprClickSdk) {
  const account = sdk.getActiveAccount()
  const publicKey = account?.public_key ?? account?.publicKey

  if (!publicKey) {
    throw new Error("Connect a CSPR.click wallet before signing")
  }

  return publicKey
}

export async function sendPreparedDeploy(
  prepared: PreparedDeploy<Record<string, unknown>>,
) {
  const sdk = getCsprClickSdk()

  if (!sdk) {
    throw new Error("CSPR.click SDK is not loaded")
  }

  const signingPublicKey = getActivePublicKey(sdk)
  const payload = buildContractCallTransaction(prepared, signingPublicKey)
  const result = await sdk.send(payload.transaction as object, signingPublicKey, true)

  if (!result || result.cancelled) {
    throw new Error("Wallet signing was cancelled")
  }

  if (result.error) {
    throw new Error(result.error)
  }

  const deployHash = result.transactionHash ?? result.deployHash ?? payload.transactionHash

  if (!deployHash) {
    throw new Error("CSPR.click did not return a deploy hash")
  }

  return deployHash
}
