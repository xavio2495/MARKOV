"""
Access Control Specialist Agent
Version: 2.0.0
Updated: 2025-10-26 05:56:13 UTC
Developer: charlesms-eth

Detects authorization and access control vulnerabilities.
"""

import re
from typing import Dict, List, Any
from uagents import Agent, Context
from uagents.setup import fund_agent_if_low
import os
from dotenv import load_dotenv

from protocols.messages import AgentTaskRequest, AgentTaskResponse
from metta.metta_integration import MeTTaReasoner

load_dotenv()


class AccessControlAgent:
    """
    Access Control Specialist Agent with uAgents Framework
    
    Detects:
    - Missing access control modifiers
    - Unprotected privileged functions
    - Weak authorization patterns
    - Ownership issues
    """
    
    def __init__(self):
        """Initialize access control agent"""
        
        self.agent = Agent(
            name="markov_access_control",
            seed=os.getenv("ACCESS_CONTROL_AGENT_SEED", "access_control_seed_default"),
            port=8003,
            endpoint=["http://localhost:8003/submit"],
            mailbox=os.getenv("ACCESS_CONTROL_MAILBOX_KEY")
        )
        
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  Access Control agent: Could not fund: {e}")
        
        self.address = str(self.agent.address)
        print(f"   ✓ Access Control Agent Address: {self.address}")
        
        self.metta_reasoner = MeTTaReasoner()
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup agent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            ctx.logger.info(f"🤖 Access Control Agent started")
            await self.metta_reasoner.load_knowledge_base()
        
        @self.agent.on_message(model=AgentTaskRequest)
        async def handle_task(ctx: Context, sender: str, msg: AgentTaskRequest):
            if msg.agent_type != "access_control":
                return
            
            analysis = await self.analyze(msg.source_code, msg.metta_context)
            
            response = AgentTaskResponse(
                audit_id=msg.audit_id,
                agent_type="access_control",
                contract_name=msg.contract_name,
                findings=analysis,
                timestamp=ctx.time()
            )
            
            await ctx.send(sender, response)
    
    async def analyze(
        self,
        source_code: str,
        metta_context: Dict
    ) -> Dict[str, Any]:
        """Analyze contract for access control issues"""
        
        findings = {
            "checks": {},
            "issues": [],
            "code_fixes": []
        }
        
        # Check 1: Has Ownable or Access Control
        has_ownable = bool(re.search(r'Ownable|onlyOwner', source_code))
        has_access_control = bool(re.search(r'AccessControl|hasRole', source_code))
        
        findings["checks"]["has_ownership_mechanism"] = has_ownable
        findings["checks"]["has_role_based_access"] = has_access_control
        
        # Check 2: Find privileged functions without protection
        unprotected_functions = self._find_unprotected_privileged_functions(source_code)
        findings["checks"]["all_privileged_protected"] = len(unprotected_functions) == 0
        
        # Check 3: Proper modifier usage
        has_proper_modifiers = self._check_modifier_usage(source_code)
        findings["checks"]["proper_modifier_usage"] = has_proper_modifiers
        
        # Check 4: tx.origin usage (dangerous)
        uses_tx_origin = bool(re.search(r'tx\.origin', source_code))
        findings["checks"]["no_tx_origin"] = not uses_tx_origin
        
        # MeTTa reasoning
        metta_query = f"""
        (analyze-access-control
          (has-ownable {has_ownable})
          (has-roles {has_access_control})
          (unprotected-count {len(unprotected_functions)})
          (uses-tx-origin {uses_tx_origin}))
        """
        
        metta_result = await self.metta_reasoner.query(metta_query)
        
        # Generate issues
        for func in unprotected_functions:
            severity = "high" if func["type"] == "critical" else "medium"
            
            findings["issues"].append({
                "severity": severity,
                "title": f"Unprotected Privileged Function: {func['name']}",
                "description": (
                    f"Function '{func['name']}' can {func['action']} but lacks "
                    f"access control modifiers. Any user can call this function."
                ),
                "location": f"Line {func['line']}",
                "recommendation": "Add onlyOwner or role-based access modifier"
            })
            
            findings["code_fixes"].append({
                "issue": f"Missing access control on {func['name']}",
                "original": func["code"],
                "fixed": self._add_access_modifier(func["code"], func["name"]),
                "explanation": "Added onlyOwner modifier to restrict access to contract owner"
            })
        
        # tx.origin issue
        if uses_tx_origin:
            findings["issues"].append({
                "severity": "high",
                "title": "Dangerous use of tx.origin",
                "description": (
                    "Contract uses tx.origin for authorization, which is vulnerable "
                    "to phishing attacks. Use msg.sender instead."
                ),
                "location": "Multiple locations",
                "recommendation": "Replace tx.origin with msg.sender"
            })
        
        findings["metta_reasoning"] = metta_result
        
        return findings
    
    def _find_unprotected_privileged_functions(self, source_code: str) -> List[Dict]:
        """Find privileged functions without access control"""
        
        unprotected = []
        lines = source_code.split('\n')
        
        privileged_keywords = [
            ("withdraw", "withdraw funds", "critical"),
            ("transferOwnership", "transfer ownership", "critical"),
            ("pause", "pause contract", "critical"),
            ("unpause", "unpause contract", "critical"),
            ("setFee", "set fees", "medium"),
            ("mint", "mint tokens", "critical"),
            ("burn", "burn tokens", "medium"),
            ("setAdmin", "change admin", "critical"),
            ("emergencyWithdraw", "emergency withdraw", "critical"),
        ]
        
        for i, line in enumerate(lines):
            for keyword, action, severity in privileged_keywords:
                if re.search(r'function\s+' + keyword, line, re.IGNORECASE):
                    # Check if has modifier in next few lines
                    has_modifier = any(
                        re.search(r'onlyOwner|onlyRole|onlyAdmin', lines[j])
                        for j in range(i, min(i + 3, len(lines)))
                    )
                    
                    if not has_modifier:
                        func_code = self._extract_function(lines, i)
                        
                        unprotected.append({
                            "name": keyword,
                            "action": action,
                            "type": severity,
                            "line": i + 1,
                            "code": func_code
                        })
        
        return unprotected
    
    def _check_modifier_usage(self, source_code: str) -> bool:
        """Check if access modifiers are properly defined and used"""
        
        # Check for modifier definitions
        has_modifier_definitions = bool(
            re.search(r'modifier\s+(onlyOwner|onlyAdmin|onlyRole)', source_code)
        )
        
        # Check for OpenZeppelin imports
        has_oz_imports = bool(
            re.search(r'import.*Ownable|import.*AccessControl', source_code)
        )
        
        return has_modifier_definitions or has_oz_imports
    
    def _extract_function(self, lines: List[str], start_line: int) -> str:
        """Extract full function code"""
        
        brace_count = 0
        func_lines = []
        started = False
        
        for i in range(start_line, min(start_line + 50, len(lines))):
            line = lines[i]
            func_lines.append(line)
            
            if '{' in line:
                started = True
                brace_count += line.count('{')
            
            if started:
                brace_count -= line.count('}')
                
                if brace_count == 0:
                    break
        
        return '\n'.join(func_lines)
    
    def _add_access_modifier(self, code: str, function_name: str) -> str:
        """Add onlyOwner modifier to function"""
        
        # Add modifier after visibility specifier
        pattern = r'(function\s+' + function_name + r'\s*\([^)]*\)\s+(public|external))'
        replacement = r'\1 onlyOwner'
        
        fixed = re.sub(pattern, replacement, code)
        
        # Add import if not present
        if 'import' not in fixed:
            fixed = 'import "@openzeppelin/contracts/access/Ownable.sol";\n\n' + fixed
        
        return fixed
    
    def run(self):
        """Run the agent"""
        self.agent.run()