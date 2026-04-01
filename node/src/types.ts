export interface AttestationResult {
  valid: boolean;
  attestationType: string;
  checks: Record<string, boolean>;
  report: Record<string, any>;
  errors: string[];
}

export function makeResult(
  attestationType: string,
  overrides: Partial<AttestationResult> = {},
): AttestationResult {
  return {
    valid: false,
    attestationType,
    checks: {},
    report: {},
    errors: [],
    ...overrides,
  };
}

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
