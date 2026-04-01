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
