import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const require = createRequire(path.join(repoRoot, "packages/casper/package.json"));
const sdk = require("casper-js-sdk");

function readEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = { ...readEnv(), ...process.env };
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function boolArg(name) {
  return args.includes(name);
}

const rpcUrl =
  argValue("--rpc", env.CASPER_NODE_RPC_URL) ??
  "https://node.testnet.casper.network/rpc";
const apiBase =
  argValue("--api", env.PROXYKEY_API_BASE_URL) ?? "http://localhost:4000";
const packageHash = (argValue("--contract", env.PROXYKEY_CONTRACT_HASH) ?? "")
  .replace(/^hash-/, "")
  .replace(/^0x/, "");
const chainName = argValue("--chain", "casper-test");
const keyPath = path.resolve(
  repoRoot,
  argValue(
    "--key",
    env.PROXYKEY_AGENT_SECRET_KEY_PATH ??
      env.ODRA_CASPER_LIVENET_SECRET_KEY_PATH ??
      "./casper_temp_private_key.pem",
  ),
);
const depositWasmPath = path.resolve(
  repoRoot,
  argValue(
    "--deposit-wasm",
    "apps/web/public/wasm/proxykey_deposit_session.wasm",
  ),
);
const depositAmount = BigInt(argValue("--deposit-motes", "50000000"));
const paymentAmount = BigInt(argValue("--payment-motes", "20000000"));
const deployPayment = Number(argValue("--deploy-payment-motes", "10000000000"));
const skipDeposit = boolArg("--skip-deposit");

if (!/^[\da-fA-F]{64}$/.test(packageHash)) {
  throw new Error("Set PROXYKEY_CONTRACT_HASH or pass --contract hash-...");
}

if (!fs.existsSync(keyPath)) {
  throw new Error(`Casper private key not found: ${keyPath}`);
}

const privateKey = sdk.PrivateKey.fromPem(
  fs.readFileSync(keyPath, "utf8"),
  sdk.KeyAlgorithm.SECP256K1,
);
const publicKey = privateKey.publicKey.toHex();
const account = privateKey.publicKey.accountHash().toPrefixedString();
const settlementAccount = argValue("--settlement-account", env.RWA_SERVICE_ACCOUNT ?? account);
const rpc = new sdk.RpcClient(new sdk.HttpHandler(rpcUrl));

function packageHashBytes(hash) {
  return Array.from(Buffer.from(hash.replace(/^hash-/, "").replace(/^0x/, ""), "hex"));
}

function accountKey(value) {
  return sdk.CLValue.newCLKey(sdk.Key.newKey(value));
}

function runtimeArg(name, value) {
  if (["user", "agent", "settlement_account"].includes(name)) return accountKey(value);
  if (typeof value === "bigint") {
    return name.endsWith("_block")
      ? sdk.CLValue.newCLUint64(value.toString())
      : sdk.CLValue.newCLUInt512(value.toString());
  }
  if (typeof value === "number") return sdk.CLValue.newCLUint64(String(value));
  return sdk.CLValue.newCLString(String(value));
}

function createId(prefix, payload) {
  return `${prefix}-${crypto
    .createHash("sha256")
    .update(
      JSON.stringify(payload, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    )
    .digest("hex")
    .slice(0, 12)}`;
}

function createHash(payload) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function execution(raw) {
  return raw?.execution_info?.execution_result?.Version2;
}

async function submitBuiltTransaction(transaction, label) {
  transaction.sign(privateKey);
  await rpc.putTransaction(transaction);
  const wait = await rpc.waitForTransaction(transaction, 240_000);
  const exec = execution(wait.rawJSON);
  const hash = transaction.hash.toJSON();

  if (exec?.error_message) {
    throw new Error(`${label} failed: ${exec.error_message} (${hash})`);
  }

  return {
    hash,
    consumed: exec?.consumed,
    blockHeight: wait.rawJSON?.execution_info?.block_height,
  };
}

async function submitContract(entrypoint, runtimeArgs) {
  const transaction = new sdk.ContractCallBuilder()
    .from(privateKey.publicKey)
    .byPackageHash(packageHash)
    .entryPoint(entrypoint)
    .runtimeArgs(
      sdk.Args.fromMap(
        Object.fromEntries(
          Object.entries(runtimeArgs).map(([name, value]) => [
            name,
            runtimeArg(name, value),
          ]),
        ),
      ),
    )
    .chainName(chainName)
    .payment(deployPayment)
    .build();

  return submitBuiltTransaction(transaction, entrypoint);
}

async function submitDeposit() {
  if (!fs.existsSync(depositWasmPath)) {
    throw new Error(`Deposit session Wasm not found: ${depositWasmPath}`);
  }

  const transaction = new sdk.SessionBuilder()
    .from(privateKey.publicKey)
    .wasm(fs.readFileSync(depositWasmPath))
    .runtimeArgs(
      sdk.Args.fromMap({
        package_hash: sdk.CLValue.newCLByteArray(packageHashBytes(packageHash)),
        user: accountKey(account),
        amount: sdk.CLValue.newCLUInt512(depositAmount.toString()),
      }),
    )
    .chainName(chainName)
    .payment(deployPayment)
    .build();

  return submitBuiltTransaction(transaction, "vault.deposit");
}

async function api(pathname, init) {
  const response = await fetch(`${apiBase}${pathname}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`API ${response.status} ${pathname}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

function jsonInit(method, body) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  };
}

async function main() {
  console.log("ProxyKey Testnet lifecycle");
  console.log({ account, publicKey, apiBase, rpcUrl, contract: `hash-${packageHash}` });
  console.log("health", await api("/health"));

  if (!skipDeposit) {
    const deposit = await submitDeposit();
    console.log("vault.deposit", deposit);
    await api(
      `/users/${account}/vault/deposit`,
      jsonInit("POST", { amount: depositAmount, deployHash: deposit.hash }),
    );
  }

  const suffix = Date.now().toString(36);
  const target = "rwa-risk-api";
  const asset = "tokenized-tbill";
  const resourceHash = createHash(`proxykey-rwa-resource-${suffix}`);
  const payloadHash = createHash(`proxykey-rwa-payload-${suffix}`);
  const resultHash = createHash(`proxykey-rwa-result-${suffix}`);
  const capabilitiesHash = createHash("rwa-risk-data,x402-payment,receipt-ledger");

  const agent = {
    accountHash: account,
    publicKey,
    name: `ProxyKey RWA Sentinel ${suffix}`,
    metadataUri: "https://proxykey.local/agents/rwa-sentinel.json",
    capabilities: ["rwa-risk-data", "x402-payment", "receipt-ledger"],
    capabilitiesHash,
    status: "active",
  };
  const register = await submitContract("register_agent", {
    agent: account,
    public_key: publicKey,
    name: agent.name,
    metadata_uri: agent.metadataUri,
    capabilities_hash: capabilitiesHash,
    status: "active",
  });
  console.log("register_agent", register);
  await api("/agents", jsonInit("POST", { ...agent, deployHash: register.hash }));

  const stagedInput = {
    user: account,
    agent: account,
    target,
    action: "fetch-rwa-risk-report",
    reason: "Agent needs paid RWA risk data before recommending treasury allocation.",
    amount: paymentAmount,
    resourceHash,
    payloadHash,
    nonce: `nonce-${suffix}`,
  };
  const intentId = createId("intent", stagedInput);
  const stage = await submitContract("stage_intent", {
    intent_id: intentId,
    user: stagedInput.user,
    agent: stagedInput.agent,
    target: stagedInput.target,
    action: stagedInput.action,
    amount: stagedInput.amount,
    resource_hash: stagedInput.resourceHash,
    payload_hash: stagedInput.payloadHash,
    nonce: stagedInput.nonce,
  });
  console.log("stage_intent", { ...stage, intentId });
  await api(`/users/${account}/intents`, jsonInit("POST", { ...stagedInput, deployHash: stage.hash }));

  const mandateId = `mandate-${suffix}`;
  const createMandate = await submitContract("create_mandate", {
    mandate_id: mandateId,
    user: account,
    agent: account,
    scope: "single-intent",
    cap: paymentAmount,
    target,
    resource_pattern_hash: resourceHash,
    expiry_block: 9_000_000n,
  });
  console.log("create_mandate", { ...createMandate, mandateId });
  await api(
    `/users/${account}/intents/${intentId}`,
    jsonInit("PATCH", {
      status: "approved",
      mandateId,
      scope: "single-intent",
      cap: paymentAmount,
      resourcePatternHash: resourceHash,
      expiryBlock: 9_000_000n,
      deployHash: createMandate.hash,
    }),
  );

  const execute = await submitContract("execute_payment", {
    mandate_id: mandateId,
    agent: account,
    settlement_account: settlementAccount,
    amount: paymentAmount,
    target,
    resource_hash: resourceHash,
    current_block: 1n,
  });
  console.log("execute_payment", execute);
  await api(
    `/users/${account}/mandates/${mandateId}/execute`,
    jsonInit("POST", {
      agent: account,
      settlementAccount,
      intentId,
      amount: paymentAmount,
      target,
      resourceHash,
      deployHash: execute.hash,
      resultHash,
      currentBlock: 1n,
    }),
  );

  const receiptId = createId("receipt", {
    intentId,
    mandateId,
    deployHash: execute.hash,
    amount: paymentAmount,
    target,
    resourceHash,
    resultHash,
  });
  const recordReceipt = await submitContract("record_receipt", {
    receipt_id: receiptId,
    intent_id: intentId,
    mandate_id: mandateId,
    deploy_hash: execute.hash,
    amount: paymentAmount,
    target,
    resource_hash: resourceHash,
    result_hash: resultHash,
  });
  console.log("record_receipt", { ...recordReceipt, receiptId });
  await api(
    "/receipts",
    jsonInit("POST", {
      user: account,
      intentId,
      mandateId,
      deployHash: execute.hash,
      recordDeployHash: recordReceipt.hash,
      amount: paymentAmount,
      target,
      resourceHash,
      resultHash,
    }),
  );

  const reportResponse = await fetch(
    `${apiBase}/x402/rwa/report`,
    jsonInit("POST", { asset }),
  );
  const paymentRequirements = await reportResponse.json();
  console.log("x402.report", {
    status: reportResponse.status,
    paymentRequirements,
  });

  const verifiedReport = await api(
    "/x402/rwa/verify-payment",
    jsonInit("POST", {
      asset,
      proof: {
        deployHash: execute.hash,
        from: account,
        to: settlementAccount,
        amount: paymentAmount,
        resourceHash,
        signature: createHash(`${execute.hash}:${account}:${settlementAccount}`),
      },
    }),
  );
  console.log("x402.verify-payment", verifiedReport);

  const [vault, intents, mandates, receipts, deploys] = await Promise.all([
    api(`/users/${account}/vault`),
    api(`/users/${account}/intents`),
    api(`/users/${account}/mandates`),
    api(`/users/${account}/receipts`),
    api(`/users/${account}/deploys`),
  ]);

  console.log(
    JSON.stringify(
      {
        vault,
        testedIntent: intents.find((item) => item.id === intentId),
        testedMandate: mandates.find((item) => item.id === mandateId),
        testedReceipt: receipts.find((item) => item.mandateId === mandateId),
        deployEvents: deploys.filter((item) =>
          [
            register.hash,
            stage.hash,
            createMandate.hash,
            execute.hash,
            recordReceipt.hash,
          ].includes(item.deployHash),
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
