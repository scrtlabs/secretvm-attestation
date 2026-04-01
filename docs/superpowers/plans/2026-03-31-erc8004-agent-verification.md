# ERC-8004 Agent Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `resolveAgent`, `verifyAgent`, and `checkAgent` to the secretvm-verify SDK (Node.js first, Python follow-up), enabling on-chain ERC-8004 agent resolution and full TEE verification.

**Architecture:** Three-layer design: `resolveAgent` handles on-chain resolution via ethers.js (registry contract → tokenURI → metadata JSON), `verifyAgent` takes metadata and runs the full verification flow (TLS + CPU + GPU + workload, same as `checkSecretVm` but endpoint-driven from metadata), and `checkAgent` composes both. RPC URLs come from environment variables (`SECRETVM_RPC_BASE`, `SECRETVM_RPC_ETHEREUM`, etc.) with `SECRETVM_RPC_URL` as fallback.

**Tech Stack:** ethers.js v6 (on-chain queries), Node.js built-in fetch (metadata + attestation endpoints), existing SDK functions for verification.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `node/src/chains.ts` (create) | Chain config: name → chainId + default RPC + registry address |
| `node/src/agent.ts` (create) | `resolveAgent`, `verifyAgent`, `checkAgent` functions |
| `node/src/types.ts` (modify) | Add `AgentMetadata`, `AgentService` interfaces |
| `node/src/index.ts` (modify) | Export new functions and types |
| `node/src/cli.ts` (modify) | Add `--agent` CLI command |
| `node/package.json` (modify) | Add `ethers` dependency |

---

### Task 1: Add ethers dependency and chain configuration

**Files:**
- Modify: `node/package.json`
- Create: `node/src/chains.ts`

- [ ] **Step 1: Install ethers**

```bash
cd node && npm install ethers
```

- [ ] **Step 2: Create chains.ts with chain config and RPC resolution**

Create `node/src/chains.ts`:

```typescript
export interface ChainConfig {
  chainId: number;
  name: string;
  registryAddress: string;
  defaultRpc: string;
}

const DEFAULT_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const SEPOLIA_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const CHAINS: Record<string, ChainConfig> = {
  ethereum:  { chainId: 1,        name: "Ethereum",        registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://eth.llamarpc.com" },
  base:      { chainId: 8453,     name: "Base",            registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://mainnet.base.org" },
  arbitrum:  { chainId: 42161,    name: "Arbitrum",        registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://arb1.arbitrum.io/rpc" },
  sepolia:   { chainId: 11155111, name: "Sepolia",         registryAddress: SEPOLIA_REGISTRY,  defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com" },
  polygon:   { chainId: 137,      name: "Polygon",         registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://polygon-rpc.com/" },
  bnb:       { chainId: 56,       name: "BNB Smart Chain", registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://bsc-dataseed.binance.org/" },
  gnosis:    { chainId: 100,      name: "Gnosis",          registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.gnosischain.com" },
  linea:     { chainId: 59144,    name: "Linea",           registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.linea.build" },
  taiko:     { chainId: 167000,   name: "Taiko",           registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.mainnet.taiko.xyz" },
  celo:      { chainId: 42220,    name: "Celo",            registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://forno.celo.org" },
  avalanche: { chainId: 43114,    name: "Avalanche",       registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://api.avax.network/ext/bc/C/rpc" },
  optimism:  { chainId: 10,       name: "Optimism",        registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://mainnet.optimism.io" },
  abstract:  { chainId: 2741,     name: "Abstract",        registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://api.mainnet.abs.xyz" },
  megaeth:   { chainId: 1000001,  name: "MegaETH",         registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.megaeth.com" },
  mantle:    { chainId: 5000,     name: "Mantle",          registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.mantle.xyz" },
  soneium:   { chainId: 1946,     name: "Soneium",         registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.soneium.org" },
  xlayer:    { chainId: 196,      name: "X Layer",         registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://rpc.xlayer.tech" },
  metis:     { chainId: 1088,     name: "Metis",           registryAddress: DEFAULT_REGISTRY, defaultRpc: "https://andromeda.metis.io/?owner=1088" },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAINS[chain.toLowerCase()];
  if (!config) {
    const valid = Object.keys(CHAINS).join(", ");
    throw new Error(`Unknown chain "${chain}". Supported: ${valid}`);
  }
  return config;
}

/**
 * Resolve the RPC URL for a chain. Priority:
 * 1. SECRETVM_RPC_<CHAIN> (e.g. SECRETVM_RPC_BASE)
 * 2. SECRETVM_RPC_URL (generic fallback)
 * 3. Default public RPC from chain config
 */
export function getRpcUrl(chain: string): string {
  const envKey = `SECRETVM_RPC_${chain.toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey]!;
  if (process.env.SECRETVM_RPC_URL) return process.env.SECRETVM_RPC_URL;
  return getChainConfig(chain).defaultRpc;
}

export function listChains(): string[] {
  return Object.keys(CHAINS);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add node/package.json node/package-lock.json node/src/chains.ts
git commit -m "Add ethers dependency and chain configuration for ERC-8004"
```

---

### Task 2: Add AgentMetadata types

**Files:**
- Modify: `node/src/types.ts`

- [ ] **Step 1: Add AgentMetadata and AgentService interfaces to types.ts**

Add to the end of `node/src/types.ts`:

```typescript
export interface AgentService {
  name: string;
  endpoint: string;
}

export interface AgentMetadata {
  name: string;
  description?: string;
  supportedTrust: string[];
  services: AgentService[];
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add node/src/types.ts
git commit -m "Add AgentMetadata and AgentService types"
```

---

### Task 3: Implement resolveAgent

**Files:**
- Create: `node/src/agent.ts`

- [ ] **Step 1: Create agent.ts with resolveAgent**

Create `node/src/agent.ts`:

```typescript
import { ethers } from "ethers";
import { getChainConfig, getRpcUrl } from "./chains.js";
import type { AgentMetadata, AgentService } from "./types.js";

const REGISTRY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function agentURI(uint256 agentId) view returns (string)",
];

function normalizeServices(raw: unknown): AgentService[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((service, index) => {
    const entry = (service ?? {}) as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name : "";
    const endpoint = typeof entry.endpoint === "string" ? entry.endpoint : "";
    return {
      name: name || `service-${index + 1}`,
      endpoint,
    };
  });
}

/**
 * Resolve an ERC-8004 agent's metadata from the on-chain registry.
 *
 * Queries the registry contract for the agent's tokenURI, fetches the
 * metadata JSON, and returns a normalized AgentMetadata object.
 *
 * RPC URL resolution priority:
 *   1. SECRETVM_RPC_<CHAIN> env var (e.g. SECRETVM_RPC_BASE)
 *   2. SECRETVM_RPC_URL env var (generic fallback)
 *   3. Default public RPC for the chain
 */
export async function resolveAgent(
  agentId: number,
  chain: string,
): Promise<AgentMetadata> {
  const chainConfig = getChainConfig(chain);
  const rpcUrl = getRpcUrl(chain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(
    chainConfig.registryAddress,
    REGISTRY_ABI,
    provider,
  );

  // Try tokenURI first, fall back to agentURI
  let tokenUri: string;
  try {
    tokenUri = await contract.tokenURI(agentId);
  } catch {
    try {
      tokenUri = await contract.agentURI(agentId);
    } catch {
      throw new Error(
        `Could not find tokenURI or agentURI for agent ${agentId} on ${chainConfig.name}`,
      );
    }
  }

  if (!tokenUri || tokenUri.trim() === "") {
    throw new Error(`Registry returned empty tokenURI for agent ${agentId}`);
  }

  // Handle IPFS URIs
  let fetchUrl = tokenUri;
  if (fetchUrl.startsWith("ipfs://")) {
    fetchUrl = fetchUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
  }

  // Fetch and parse the metadata JSON
  const resp = await fetch(fetchUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch agent metadata from ${fetchUrl}: HTTP ${resp.status}`);
  }
  const manifest = (await resp.json()) as Record<string, unknown>;

  const trust =
    (manifest.supportedTrust as string[] | undefined) ??
    (manifest.supported_trust as string[] | undefined) ??
    [];

  return {
    name:
      typeof manifest.name === "string" && manifest.name.trim()
        ? manifest.name
        : `Agent ${agentId}`,
    description:
      typeof manifest.description === "string" ? manifest.description : undefined,
    supportedTrust: Array.isArray(trust) ? trust : [],
    services: normalizeServices(manifest.services ?? manifest.endpoints),
  };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Test resolveAgent manually against Base**

```bash
SECRETVM_RPC_BASE="https://base-mainnet.infura.io/v3/6b55933f4b7c4d77b64a49babb97cd08" \
node -e "
import { resolveAgent } from './dist/agent.js';
const meta = await resolveAgent(1, 'base');
console.log(JSON.stringify(meta, null, 2));
"
```

Verify it returns metadata with name, services, and supportedTrust.

- [ ] **Step 4: Commit**

```bash
git add node/src/agent.ts
git commit -m "Implement resolveAgent for on-chain ERC-8004 metadata resolution"
```

---

### Task 4: Implement verifyAgent

**Files:**
- Modify: `node/src/agent.ts`

`verifyAgent` takes `AgentMetadata`, finds the `teequote` and `workload` service endpoints, then runs the same verification flow as `checkSecretVm` (TLS cert → CPU quote → TLS binding → GPU → GPU binding → workload).

- [ ] **Step 1: Add verifyAgent to agent.ts**

Add to the end of `node/src/agent.ts`:

```typescript
import { AttestationResult, makeResult } from "./types.js";
import { checkCpuAttestation } from "./cpu.js";
import { checkNvidiaGpuAttestation } from "./nvidia.js";
import { verifyWorkload } from "./workload.js";
import crypto from "node:crypto";
import tls from "node:tls";
```

(Move or merge these imports to the top of the file.)

Then add the helper and main function:

```typescript
function getTlsCertFingerprint(
  host: string,
  port: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port, rejectUnauthorized: true },
      () => {
        const cert = socket.getPeerX509Certificate();
        if (!cert) {
          socket.destroy();
          return reject(new Error("No certificate received"));
        }
        const fingerprint = crypto
          .createHash("sha256")
          .update(cert.raw)
          .digest();
        socket.destroy();
        resolve(fingerprint);
      },
    );
    socket.on("error", reject);
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
  });
}

function extractDockerCompose(raw: string): string {
  let text = raw.trim();
  const preMatch = text.match(/<pre>([\s\S]*?)<\/pre>/i);
  if (preMatch) text = preMatch[1]!;
  text = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
  return text;
}

/**
 * Find the teequote service endpoint from agent metadata.
 * Looks for a service named "teequote" (case-insensitive).
 */
function findTeequoteEndpoint(services: AgentService[]): string | undefined {
  for (const s of services) {
    if (s.name.toLowerCase() === "teequote" && s.endpoint) return s.endpoint;
  }
  // Fallback: look for an endpoint on port 29343
  for (const s of services) {
    if (s.endpoint && s.endpoint.includes(":29343")) return s.endpoint;
  }
  return undefined;
}

/**
 * Find the workload service endpoint from agent metadata.
 * Looks for a service named "workload" (case-insensitive).
 */
function findWorkloadEndpoint(services: AgentService[]): string | undefined {
  for (const s of services) {
    if (s.name.toLowerCase() === "workload" && s.endpoint) return s.endpoint;
  }
  return undefined;
}

/**
 * Normalize a service endpoint to a full URL.
 */
function normalizeEndpoint(endpoint: string): string {
  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    return `https://${endpoint}`;
  }
  return endpoint;
}

/**
 * Verify an ERC-8004 agent given its metadata.
 *
 * Discovers teequote and workload endpoints from the metadata, then runs
 * the full verification flow: TLS cert, CPU quote, TLS binding, GPU quote,
 * GPU binding, and workload verification.
 */
export async function verifyAgent(
  metadata: AgentMetadata,
): Promise<AttestationResult> {
  const errors: string[] = [];
  const checks: Record<string, boolean> = {};
  const report: Record<string, any> = {};

  report.agent_name = metadata.name;

  // 1. Validate metadata
  const hasTeeAttestation = metadata.supportedTrust
    .map((t) => t.toLowerCase())
    .includes("tee-attestation");
  if (!hasTeeAttestation) {
    errors.push("Agent does not support tee-attestation");
    checks.metadata_valid = false;
    return makeResult("ERC-8004", { checks, report, errors });
  }

  const teequoteEndpoint = findTeequoteEndpoint(metadata.services);
  if (!teequoteEndpoint) {
    errors.push("No teequote service endpoint found in agent metadata");
    checks.metadata_valid = false;
    return makeResult("ERC-8004", { checks, report, errors });
  }
  checks.metadata_valid = true;

  // 2. Derive URLs
  const baseUrl = normalizeEndpoint(teequoteEndpoint).replace(/\/+$/, "");
  // CPU endpoint: if base already ends with /cpu, use as-is; otherwise append /cpu
  const cpuUrl = baseUrl.endsWith("/cpu") ? baseUrl : `${baseUrl}/cpu`;
  const gpuUrl = baseUrl.endsWith("/cpu")
    ? baseUrl.replace(/\/cpu$/, "/gpu")
    : `${baseUrl}/gpu`;

  // Workload URL: prefer explicit workload service, fall back to teequote base + /docker-compose
  const workloadService = findWorkloadEndpoint(metadata.services);
  const workloadUrl = workloadService
    ? normalizeEndpoint(workloadService)
    : baseUrl.endsWith("/cpu")
      ? baseUrl.replace(/\/cpu$/, "/docker-compose")
      : `${baseUrl}/docker-compose`;

  // Extract host/port from teequote endpoint for TLS check
  const parsed = new URL(cpuUrl.endsWith("/cpu") ? cpuUrl.replace(/\/cpu$/, "") : cpuUrl);
  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;

  // 3. TLS certificate fingerprint
  let tlsFingerprint: Buffer;
  try {
    tlsFingerprint = await getTlsCertFingerprint(host, port);
    checks.tls_cert_obtained = true;
    report.tls_fingerprint = tlsFingerprint.toString("hex");
  } catch (e: any) {
    errors.push(`Failed to get TLS certificate: ${e.message}`);
    checks.tls_cert_obtained = false;
    return makeResult("ERC-8004", { checks, report, errors });
  }

  // 4. Fetch and verify CPU quote
  let cpuData: string;
  try {
    const resp = await fetch(cpuUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    cpuData = await resp.text();
    checks.cpu_quote_fetched = true;
  } catch (e: any) {
    errors.push(`Failed to fetch CPU quote: ${e.message}`);
    checks.cpu_quote_fetched = false;
    return makeResult("ERC-8004", { checks, report, errors });
  }

  const cpuResult = await checkCpuAttestation(cpuData);
  checks.cpu_attestation_valid = cpuResult.valid;
  report.cpu = cpuResult.report;
  report.cpu_type = cpuResult.attestationType;
  if (!cpuResult.valid) errors.push(...cpuResult.errors);

  // 5. TLS binding
  const reportDataHex: string = cpuResult.report.report_data ?? "";
  if (reportDataHex.length >= 64) {
    const firstHalf = reportDataHex.slice(0, 64);
    checks.tls_binding = firstHalf === tlsFingerprint.toString("hex");
    if (!checks.tls_binding) {
      errors.push(
        `TLS binding failed: report_data first half (${firstHalf.slice(0, 16)}...) ` +
          `!= TLS fingerprint (${tlsFingerprint.toString("hex").slice(0, 16)}...)`,
      );
    }
  } else {
    checks.tls_binding = false;
    errors.push("report_data too short for TLS binding check");
  }

  // 6. GPU quote (optional)
  let gpuPresent = false;
  let gpuData = "";
  try {
    const resp = await fetch(gpuUrl);
    if (resp.ok) {
      gpuData = await resp.text();
      const parsed = JSON.parse(gpuData);
      if ("error" in parsed) {
        checks.gpu_quote_fetched = false;
      } else {
        gpuPresent = true;
        checks.gpu_quote_fetched = true;
      }
    } else {
      checks.gpu_quote_fetched = false;
    }
  } catch {
    checks.gpu_quote_fetched = false;
  }

  if (gpuPresent) {
    const gpuResult = await checkNvidiaGpuAttestation(gpuData);
    checks.gpu_attestation_valid = gpuResult.valid;
    report.gpu = gpuResult.report;
    if (!gpuResult.valid) errors.push(...gpuResult.errors);

    // GPU binding
    const gpuJson = JSON.parse(gpuData);
    const gpuNonce: string = gpuJson.nonce ?? "";
    if (reportDataHex.length >= 128) {
      const secondHalf = reportDataHex.slice(64, 128);
      checks.gpu_binding = secondHalf === gpuNonce;
      if (!checks.gpu_binding) {
        errors.push(
          `GPU binding failed: report_data second half (${secondHalf.slice(0, 16)}...) ` +
            `!= GPU nonce (${gpuNonce.slice(0, 16)}...)`,
        );
      }
    } else {
      checks.gpu_binding = false;
      errors.push("report_data too short for GPU binding check");
    }
  }

  // 7. Workload verification
  try {
    const resp = await fetch(workloadUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dockerCompose = extractDockerCompose(await resp.text());
    checks.workload_fetched = true;

    const workloadResult = verifyWorkload(cpuData, dockerCompose);
    checks.workload_verified = workloadResult.status === "authentic_match";
    report.workload = workloadResult;
    if (workloadResult.status === "authentic_mismatch") {
      errors.push("Workload mismatch: VM is authentic but docker-compose does not match");
    } else if (workloadResult.status === "not_authentic") {
      errors.push("Workload verification failed: not an authentic SecretVM");
    }
  } catch (e: any) {
    errors.push(`Failed to fetch workload: ${e.message}`);
    checks.workload_fetched = false;
  }

  // Overall validity
  const requiredChecks = [
    checks.metadata_valid,
    checks.tls_cert_obtained,
    checks.cpu_quote_fetched,
    checks.cpu_attestation_valid,
    checks.tls_binding,
    !!checks.workload_verified,
  ];
  if (gpuPresent) {
    requiredChecks.push(!!checks.gpu_attestation_valid);
    requiredChecks.push(!!checks.gpu_binding);
  }
  const valid = requiredChecks.every(Boolean);

  return makeResult("ERC-8004", { valid, checks, report, errors });
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add node/src/agent.ts
git commit -m "Implement verifyAgent for ERC-8004 agent verification"
```

---

### Task 5: Implement checkAgent

**Files:**
- Modify: `node/src/agent.ts`

- [ ] **Step 1: Add checkAgent to agent.ts**

Add at the end of `node/src/agent.ts`:

```typescript
/**
 * End-to-end ERC-8004 agent verification.
 *
 * Resolves the agent's metadata from the on-chain registry, then runs
 * the full verification flow via verifyAgent.
 *
 * @param agentId - The agent's on-chain token ID
 * @param chain - Chain name (e.g. "base", "ethereum", "arbitrum")
 */
export async function checkAgent(
  agentId: number,
  chain: string,
): Promise<AttestationResult> {
  const errors: string[] = [];
  const checks: Record<string, boolean> = {};

  let metadata: AgentMetadata;
  try {
    metadata = await resolveAgent(agentId, chain);
    checks.agent_resolved = true;
  } catch (e: any) {
    errors.push(`Failed to resolve agent: ${e.message}`);
    checks.agent_resolved = false;
    return makeResult("ERC-8004", { checks, errors });
  }

  const result = await verifyAgent(metadata);

  // Merge the resolution check into the result
  result.checks = { agent_resolved: true, ...result.checks };

  return result;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add node/src/agent.ts
git commit -m "Implement checkAgent for end-to-end ERC-8004 verification"
```

---

### Task 6: Export new functions and update CLI

**Files:**
- Modify: `node/src/index.ts`
- Modify: `node/src/cli.ts`

- [ ] **Step 1: Add exports to index.ts**

Add to `node/src/index.ts`:

```typescript
export { resolveAgent, verifyAgent, checkAgent } from "./agent.js";
export type { AgentMetadata, AgentService } from "./types.js";
export { getChainConfig, getRpcUrl, listChains } from "./chains.js";
export type { ChainConfig } from "./chains.js";
```

- [ ] **Step 2: Add --agent and --check-agent CLI commands to cli.ts**

In the imports section of `cli.ts`, add:

```typescript
import { resolveAgent, verifyAgent, checkAgent } from "./agent.js";
```

In the USAGE string, add these commands:

```
  --check-agent <id> --chain <name>
                                    Resolve and verify an ERC-8004 agent on-chain
  --agent <file>                    Verify an ERC-8004 agent from a metadata JSON file
```

Add the command handlers (before the `else` / legacy URL block):

```typescript
} else if (getFlag("--check-agent")) {
  const id = getFlagValue("--check-agent");
  const chain = getFlagValue("--chain");
  if (!id || !chain) {
    console.log(USAGE);
    process.exit(1);
  }
  if (!raw) console.log(`Resolving and verifying agent ${id} on ${chain} ...\n`);
  result = await checkAgent(Number(id), chain);
} else if (getFlag("--agent")) {
  const file = getFlagValue("--agent") ?? getPositional();
  if (!file) {
    console.log(USAGE);
    process.exit(1);
  }
  const metadata = JSON.parse(readFileSync(file, "utf8"));
  if (!raw) console.log(`Verifying agent "${metadata.name}" ...\n`);
  result = await verifyAgent(metadata);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Test end-to-end with Base chain**

```bash
npm install -g .
SECRETVM_RPC_BASE="https://base-mainnet.infura.io/v3/6b55933f4b7c4d77b64a49babb97cd08" \
secretvm-verify --check-agent 1 --chain base -v
```

- [ ] **Step 5: Commit**

```bash
git add node/src/index.ts node/src/cli.ts
git commit -m "Export agent functions and add --check-agent, --agent CLI commands"
```

---

### Task 7: Manual integration test

- [ ] **Step 1: Test resolveAgent standalone**

```bash
SECRETVM_RPC_BASE="https://base-mainnet.infura.io/v3/6b55933f4b7c4d77b64a49babb97cd08" \
node -e "
import { resolveAgent } from 'secretvm-verify';
const meta = await resolveAgent(1, 'base');
console.log(JSON.stringify(meta, null, 2));
"
```

- [ ] **Step 2: Test verifyAgent with saved metadata**

Save the output from step 1 to `test-agent-metadata.json`, then:

```bash
secretvm-verify --agent test-agent-metadata.json -v
```

- [ ] **Step 3: Test checkAgent end-to-end**

```bash
SECRETVM_RPC_BASE="https://base-mainnet.infura.io/v3/6b55933f4b7c4d77b64a49babb97cd08" \
secretvm-verify --check-agent 1 --chain base -v
```

- [ ] **Step 4: Test with --raw flag**

```bash
SECRETVM_RPC_BASE="https://base-mainnet.infura.io/v3/6b55933f4b7c4d77b64a49babb97cd08" \
secretvm-verify --check-agent 1 --chain base --raw
```
