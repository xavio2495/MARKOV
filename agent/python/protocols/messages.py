"""
Protocol Message Definitions
Version: 2.0.0
Updated: 2025-10-26 06:07:20 UTC
Developer: charlesms-eth

Defines all message types for uAgents communication.
"""

from uagents import Model
from typing import Optional, Dict, Any, List
from pydantic import Field


class AuditRequest(Model):
    """
    Request to audit a smart contract
    Sent from MCP Server to Coordinator Agent
    """
    request_id: str = Field(..., description="Unique request identifier")
    contract_name: str = Field(..., description="Contract name")
    source_code: str = Field(..., description="Solidity source code")
    contract_address: Optional[str] = Field(None, description="On-chain address")
    network: str = Field("mainnet", description="Network name")
    timestamp: str = Field(..., description="Request timestamp")


class AuditResponse(Model):
    """
    Response with audit results
    Sent from Coordinator Agent to MCP Server
    """
    request_id: str = Field(..., description="Request identifier")
    contract_name: str = Field(..., description="Contract name")
    report: Dict[str, Any] = Field(..., description="Complete audit report")
    timestamp: str = Field(..., description="Response timestamp")


class AgentTaskRequest(Model):
    """
    Task request to specialist agent
    Sent from Coordinator to Specialist Agents
    """
    audit_id: str = Field(..., description="Audit identifier")
    agent_type: str = Field(..., description="Target agent type")
    contract_name: str = Field(..., description="Contract name")
    source_code: str = Field(..., description="Source code")
    metta_context: Dict[str, Any] = Field(..., description="MeTTa analysis context")
    timestamp: str = Field(..., description="Task timestamp")


class AgentTaskResponse(Model):
    """
    Task response from specialist agent
    Sent from Specialist Agent to Coordinator
    """
    audit_id: str = Field(..., description="Audit identifier")
    agent_type: str = Field(..., description="Agent type")
    contract_name: str = Field(..., description="Contract name")
    findings: Dict[str, Any] = Field(..., description="Agent findings")
    timestamp: str = Field(..., description="Response timestamp")


class HealthCheck(Model):
    """Health check request"""
    timestamp: str = Field(..., description="Check timestamp")


class HealthCheckResponse(Model):
    """Health check response"""
    agent_address: str = Field(..., description="Agent address")
    status: str = Field(..., description="Status: operational, degraded, error")
    timestamp: str = Field(..., description="Response timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")