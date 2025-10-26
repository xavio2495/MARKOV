"""
Coordinator Agent - Orchestrates Multi-Agent Audit System
Version: 2.0.0
Updated: 2025-10-26 05:56:13 UTC
Developer: charlesms-eth

This agent coordinates all specialist agents, aggregates findings,
and performs cross-agent MeTTa reasoning.
"""

import asyncio
from typing import Dict, Any, List
from datetime import datetime
import os
from uagents import Agent, Context, Model
from uagents.setup import fund_agent_if_low
from dotenv import load_dotenv

# Import specialist agents
from .reentrancy_agent import ReentrancyAgent
from .access_control_agent import AccessControlAgent
from .integer_overflow_agent import IntegerOverflowAgent
from .external_calls_agent import ExternalCallsAgent
from .gas_optimization_agent import GasOptimizationAgent

# Import MeTTa reasoner
from metta.metta_integration import MeTTaReasoner

# Import protocol messages
from protocols.messages import (
    AuditRequest,
    AuditResponse,
    AgentTaskRequest,
    AgentTaskResponse,
)

load_dotenv()


class CoordinatorAgent:
    """
    Coordinator Agent using uAgents Framework
    
    Responsibilities:
    - Receive audit requests from MCP server
    - Analyze contract structure with MeTTa
    - Distribute tasks to specialist agents
    - Aggregate findings from all agents
    - Perform cross-agent MeTTa reasoning
    - Generate final audit report
    """
    
    def __init__(self):
        """Initialize coordinator agent with uAgents framework"""
        
        # Initialize uAgent
        self.agent = Agent(
            name="markov_coordinator",
            seed=os.getenv("COORDINATOR_AGENT_SEED", "coordinator_seed_default"),
            port=8001,
            endpoint=["http://localhost:8001/submit"],
            mailbox=os.getenv("COORDINATOR_MAILBOX_KEY")
        )
        
        # Fund agent if needed (for Agentverse communication)
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  Could not fund agent: {e}")
        
        # Store agent address
        self.address = str(self.agent.address)
        print(f"   ✓ Coordinator Agent Address: {self.address}")
        
        # Initialize specialist agents
        self.reentrancy_agent = ReentrancyAgent()
        self.access_control_agent = AccessControlAgent()
        self.integer_overflow_agent = IntegerOverflowAgent()
        self.external_calls_agent = ExternalCallsAgent()
        self.gas_optimization_agent = GasOptimizationAgent()
        
        # Initialize MeTTa reasoner
        self.metta_reasoner = MeTTaReasoner()
        
        # Active audits tracking
        self.active_audits: Dict[str, Dict[str, Any]] = {}
        
        # Setup agent event handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup uAgent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            """Agent startup event"""
            ctx.logger.info(f"🤖 Coordinator Agent started")
            ctx.logger.info(f"   Address: {self.agent.address}")
            
            # Load MeTTa knowledge base
            await self.metta_reasoner.load_knowledge_base()
            ctx.logger.info(f"   ✓ MeTTa knowledge base loaded")
        
        @self.agent.on_message(model=AuditRequest)
        async def handle_audit_request(ctx: Context, sender: str, msg: AuditRequest):
            """Handle incoming audit request"""
            ctx.logger.info(f"📥 Received audit request: {msg.contract_name}")
            
            # Process audit
            result = await self.audit(
                contract_name=msg.contract_name,
                source_code=msg.source_code,
                contract_address=msg.contract_address
            )
            
            # Send response
            response = AuditResponse(
                request_id=msg.request_id,
                contract_name=msg.contract_name,
                report=result,
                timestamp=datetime.utcnow().isoformat()
            )
            
            await ctx.send(sender, response)
            ctx.logger.info(f"📤 Sent audit response for {msg.contract_name}")
    
    async def audit(
        self,
        contract_name: str,
        source_code: str,
        contract_address: str = None
    ) -> Dict[str, Any]:
        """
        Main audit orchestration method
        
        This method:
        1. Analyzes contract with MeTTa
        2. Creates tasks for specialist agents
        3. Runs agents in parallel
        4. Aggregates findings
        5. Performs cross-agent reasoning
        6. Generates final report
        """
        
        print(f"   📊 Coordinator: Analyzing contract structure...")
        
        # Step 1: Analyze contract with MeTTa
        contract_analysis = await self.metta_reasoner.analyze_contract(
            source_code=source_code,
            contract_name=contract_name
        )
        
        print(f"   🤖 Coordinator: Distributing to specialist agents...")
        
        # Step 2: Create agent tasks based on analysis
        tasks = self._create_agent_tasks(contract_analysis)
        
        # Step 3: Run specialist agents in parallel
        agent_tasks = [
            self.reentrancy_agent.analyze(source_code, contract_analysis),
            self.access_control_agent.analyze(source_code, contract_analysis),
            self.integer_overflow_agent.analyze(source_code, contract_analysis),
            self.external_calls_agent.analyze(source_code, contract_analysis),
            self.gas_optimization_agent.analyze(source_code, contract_analysis),
        ]
        
        results = await asyncio.gather(*agent_tasks, return_exceptions=True)
        
        # Handle any agent failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"   ⚠️  Agent {i} failed: {result}")
                results[i] = {"checks": {}, "issues": [], "code_fixes": []}
        
        # Step 4: Aggregate findings
        all_findings = {
            "Reentrancy": results[0],
            "AccessControl": results[1],
            "IntegerOverflow": results[2],
            "ExternalCalls": results[3],
            "GasOptimization": results[4],
        }
        
        print(f"   🧠 Coordinator: Running MeTTa cross-agent reasoning...")
        
        # Step 5: Cross-agent MeTTa reasoning
        reasoning_result = await self.metta_reasoner.reason_about_findings(all_findings)
        
        # Step 6: Calculate summary
        summary = self._calculate_summary(all_findings)
        
        # Step 7: Build final report
        report = {
            "contract_name": contract_name,
            "contract_address": contract_address,
            "audit_date": datetime.utcnow().isoformat(),
            "criteria": all_findings,
            "summary": summary,
            "risk_score": reasoning_result.get("risk_score", 0),
            "metta_insights": reasoning_result.get("insights", []),
            "recommendations": reasoning_result.get("recommendations", []),
            "agent_addresses": {
                "coordinator": self.address,
                "reentrancy": self.reentrancy_agent.address,
                "access_control": self.access_control_agent.address,
                "integer_overflow": self.integer_overflow_agent.address,
                "external_calls": self.external_calls_agent.address,
                "gas_optimization": self.gas_optimization_agent.address,
            }
        }
        
        print(f"   ✅ Coordinator: Audit complete")
        
        return report
    
    def _create_agent_tasks(self, contract_analysis: Dict) -> List[Dict]:
        """Create specialized tasks for each agent based on contract analysis"""
        
        tasks = []
        
        # Reentrancy task
        if contract_analysis.get("has_external_calls"):
            tasks.append({
                "agent": "reentrancy",
                "priority": "high",
                "focus": contract_analysis.get("external_call_functions", [])
            })
        
        # Access control task
        if contract_analysis.get("has_privileged_functions"):
            tasks.append({
                "agent": "access_control",
                "priority": "high",
                "focus": contract_analysis.get("privileged_functions", [])
            })
        
        # Integer overflow task
        if contract_analysis.get("solidity_version_below_08"):
            tasks.append({
                "agent": "integer_overflow",
                "priority": "medium",
                "focus": contract_analysis.get("arithmetic_operations", [])
            })
        
        return tasks
    
    def _calculate_summary(self, findings: Dict) -> Dict[str, int]:
        """Calculate summary statistics from all agent findings"""
        
        total_checks = 0
        passed_checks = 0
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0
        }
        
        for category, data in findings.items():
            # Count checks
            checks = data.get("checks", {})
            total_checks += len(checks)
            passed_checks += sum(1 for v in checks.values() if v)
            
            # Count issues by severity
            issues = data.get("issues", [])
            for issue in issues:
                severity = issue.get("severity", "low")
                if severity in severity_counts:
                    severity_counts[severity] += 1
        
        return {
            "total_checks": total_checks,
            "passed_checks": passed_checks,
            "critical_issues": severity_counts["critical"],
            "high_issues": severity_counts["high"],
            "medium_issues": severity_counts["medium"],
            "low_issues": severity_counts["low"]
        }
    
    def run(self):
        """Run the agent (for standalone mode)"""
        self.agent.run()