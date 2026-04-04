"""Shared data types for the secretvm.verify package."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AttestationResult:
    valid: bool
    attestation_type: str  # "TDX", "SEV-SNP", "NVIDIA-GPU"
    checks: dict = field(default_factory=dict)
    report: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)


@dataclass
class WorkloadResult:
    """Result of a SecretVM workload verification."""
    status: str  # "authentic_match" | "authentic_mismatch" | "not_authentic"
    template_name: Optional[str] = None
    vm_type: Optional[str] = None
    artifacts_ver: Optional[str] = None
    env: Optional[str] = None


@dataclass
class AgentService:
    name: str
    endpoint: str
    description: str = ""


@dataclass
class AgentMetadata:
    name: str
    supported_trust: list[str]
    services: list[AgentService]
    description: str = ""
    image: str = ""
    type: str = ""
    active: bool = True
    x402_support: bool = False
    attributes: dict = field(default_factory=dict)
    raw: dict = field(default_factory=dict)
