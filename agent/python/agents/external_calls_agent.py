"""
External Calls Specialist Agent
Version: 2.0.0
Updated: 2025-10-26 05:59:08 UTC
Developer: charlesms-eth

Analyzes safety of external contract calls.
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


class ExternalCallsAgent:
    """
    External Calls Specialist Agent with uAgents Framework
    
    Detects:
    - Unchecked low-level calls
    - Unsafe delegatecall usage
    - Missing return value checks
    - Pull vs push payment patterns
    """
    
    def __init__(self):
        """Initialize external calls agent"""
        
        self.agent = Agent(
            name="markov_external_calls",
            seed=os.getenv("EXTERNAL_CALLS_AGENT_SEED", "external_calls_seed_default"),
            port=8005,
            endpoint=["http://localhost:8005/submit"],
            mailbox=os.getenv("EXTERNAL_CALLS_MAILBOX_KEY")
        )
        
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  External Calls agent: Could not fund: {e}")
        
        self.address = str(self.agent.address)
        print(f"   ✓ External Calls Agent Address: {self.address}")
        
        self.metta_reasoner = MeTTaReasoner()
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup agent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            ctx.logger.info(f"🤖 External Calls Agent started")
            await self.metta_reasoner.load_knowledge_base()
        
        @self.agent.on_message(model=AgentTaskRequest)
        async def handle_task(ctx: Context, sender: str, msg: AgentTaskRequest):
            if msg.agent_type != "external_calls":
                return
            
            analysis = await self.analyze(msg.source_code, msg.metta_context)
            
            response = AgentTaskResponse(
                audit_id=msg.audit_id,
                agent_type="external_calls",
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
        """Analyze contract for external call safety issues"""
        
        findings = {
            "checks": {},
            "issues": [],
            "code_fixes": []
        }
        
        # Find all external calls
        low_level_calls = self._find_low_level_calls(source_code)
        transfer_calls = self._find_transfer_calls(source_code)
        delegatecalls = self._find_delegatecalls(source_code)
        
        # Check 1: Low-level calls checked
        unchecked_calls = [call for call in low_level_calls if not call['checked']]
        findings["checks"]["low_level_calls_checked"] = len(unchecked_calls) == 0
        
        # Check 2: Uses safe transfer methods
        findings["checks"]["uses_safe_transfer"] = len(transfer_calls) > 0
        
        # Check 3: Delegatecall to trusted addresses only
        unsafe_delegatecalls = [dc for dc in delegatecalls if dc['unsafe']]
        findings["checks"]["safe_delegatecall_usage"] = len(unsafe_delegatecalls) == 0
        
        # Check 4: Pull over push pattern
        uses_pull_pattern = self._check_pull_pattern(source_code)
        findings["checks"]["uses_pull_payment_pattern"] = uses_pull_pattern
        
        # Check 5: External call gas limits
        has_gas_limits = self._check_gas_limits(source_code)
        findings["checks"]["has_gas_limits"] = has_gas_limits
        
        # MeTTa reasoning
        metta_query = f"""
        (analyze-external-calls
          (contract
            (unchecked-calls {len(unchecked_calls)})
            (unsafe-delegatecalls {len(unsafe_delegatecalls)})
            (uses-pull-pattern {uses_pull_pattern})))
        """
        
        metta_result = await self.metta_reasoner.query(metta_query)
        
        # Generate issues for unchecked low-level calls
        for call in unchecked_calls:
            findings["issues"].append({
                "severity": "medium",
                "title": "Unchecked Low-Level Call",
                "description": (
                    f"Low-level call at line {call['line']} does not check return value. "
                    f"Failed calls will silently continue execution, potentially leading "
                    f"to unexpected behavior."
                ),
                "location": f"Line {call['line']}",
                "recommendation": (
                    "1. Check return value with require()\n"
                    "2. Or use transfer() for sending ETH\n"
                    "3. Handle failure cases explicitly"
                )
            })
            
            findings["code_fixes"].append({
                "issue": "Unchecked call return value",
                "original": call['code'],
                "fixed": self._generate_checked_call(call['code']),
                "explanation": "Add require() to check call success and handle failures"
            })
        
        # Generate issues for unsafe delegatecalls
        for dc in unsafe_delegatecalls:
            findings["issues"].append({
                "severity": "critical",
                "title": "Unsafe Delegatecall to Untrusted Address",
                "description": (
                    f"Delegatecall at line {dc['line']} uses user-controlled address. "
                    f"This allows arbitrary code execution in contract's context, "
                    f"potentially allowing attackers to modify storage and steal funds."
                ),
                "location": f"Line {dc['line']}",
                "recommendation": (
                    "1. Only delegatecall to whitelisted, trusted addresses\n"
                    "2. Implement address whitelist mapping\n"
                    "3. Consider using library calls instead"
                )
            })
            
            findings["code_fixes"].append({
                "issue": "Unsafe delegatecall",
                "original": dc['code'],
                "fixed": self._generate_safe_delegatecall(dc['code']),
                "explanation": "Add whitelist check before delegatecall to prevent arbitrary code execution"
            })
        
        # Pull pattern recommendation
        if not uses_pull_pattern and len(transfer_calls) > 0:
            findings["issues"].append({
                "severity": "low",
                "title": "Consider Pull Payment Pattern",
                "description": (
                    "Contract uses push payments (direct transfers). Consider implementing "
                    "pull payment pattern where users withdraw funds themselves. This "
                    "prevents DOS attacks and reduces gas costs."
                ),
                "location": "Multiple locations",
                "recommendation": "Implement withdrawal pattern with mapping for pending balances"
            })
        
        findings["metta_reasoning"] = metta_result
        
        return findings
    
    def _find_low_level_calls(self, source_code: str) -> List[Dict]:
        """Find low-level calls (.call, .staticcall)"""
        
        calls = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\.call\(|\.call\{', line):
                # Check if return value is checked
                checked = self._is_return_checked(lines, i)
                
                calls.append({
                    'line': i + 1,
                    'code': line.strip(),
                    'type': 'call',
                    'checked': checked
                })
        
        return calls
    
    def _find_transfer_calls(self, source_code: str) -> List[Dict]:
        """Find transfer() calls"""
        
        transfers = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\.transfer\(', line):
                transfers.append({
                    'line': i + 1,
                    'code': line.strip()
                })
        
        return transfers
    
    def _find_delegatecalls(self, source_code: str) -> List[Dict]:
        """Find delegatecall operations"""
        
        delegatecalls = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\.delegatecall\(', line):
                # Check if target address is user-controlled
                unsafe = self._is_user_controlled_address(lines, i)
                
                delegatecalls.append({
                    'line': i + 1,
                    'code': line.strip(),
                    'unsafe': unsafe
                })
        
        return delegatecalls
    
    def _is_return_checked(self, lines: List[str], call_line: int) -> bool:
        """Check if call return value is checked"""
        
        # Look for patterns in same line or next few lines
        check_patterns = [
            r'require\s*\(',
            r'assert\s*\(',
            r'if\s*\(',
            r'\(bool\s+\w+',  # (bool success, ...)
        ]
        
        # Check current line
        for pattern in check_patterns:
            if re.search(pattern, lines[call_line]):
                return True
        
        # Check next 2 lines
        for i in range(call_line + 1, min(call_line + 3, len(lines))):
            for pattern in check_patterns:
                if re.search(pattern, lines[i]):
                    return True
        
        return False
    
    def _is_user_controlled_address(self, lines: List[str], delegatecall_line: int) -> bool:
        """Check if delegatecall target is user-controlled"""
        
        # Check current line and previous 3 lines
        check_range = range(max(0, delegatecall_line - 3), delegatecall_line + 1)
        context = '\n'.join([lines[i] for i in check_range if i < len(lines)])
        
        # Indicators of user control
        unsafe_patterns = [
            r'msg\.sender',
            r'_to\b',
            r'target\b',
            r'_address\b',
            r'addr\b',
        ]
        
        # Safe patterns (constants, state variables)
        safe_patterns = [
            r'implementation\b',
            r'LOGIC_CONTRACT\b',
            r'constant\b',
            r'immutable\b',
        ]
        
        has_unsafe = any(re.search(pattern, context) for pattern in unsafe_patterns)
        has_safe = any(re.search(pattern, context) for pattern in safe_patterns)
        
        return has_unsafe and not has_safe
    
    def _check_pull_pattern(self, source_code: str) -> bool:
        """Check if contract uses pull payment pattern"""
        
        # Look for withdrawal pattern
        withdrawal_patterns = [
            r'function\s+withdraw\s*\(',
            r'function\s+claim\s*\(',
            r'mapping\s*\([^)]+\)\s*\w*balances\w*',
            r'pendingWithdrawals',
        ]
        
        return any(re.search(pattern, source_code) for pattern in withdrawal_patterns)
    
    def _check_gas_limits(self, source_code: str) -> bool:
        """Check if external calls use gas limits"""
        
        return bool(re.search(r'\.call\{gas:', source_code))
    
    def _generate_checked_call(self, original_code: str) -> str:
        """Generate code with checked return value"""
        
        if '(bool' in original_code:
            return original_code  # Already has bool return
        
        # Add require check
        fixed = re.sub(
            r'(\w+)\.call\(',
            r'(bool success, ) = \1.call(',
            original_code
        )
        
        fixed += '\nrequire(success, "External call failed");'
        
        return fixed
    
    def _generate_safe_delegatecall(self, original_code: str) -> str:
        """Generate safe delegatecall with whitelist"""
        
        fixed = (
            "// Add to contract:\n"
            "mapping(address => bool) public trustedImplementations;\n\n"
            "// In constructor or admin function:\n"
            "// trustedImplementations[yourLogicContract] = true;\n\n"
            "require(trustedImplementations[target], \"Untrusted implementation\");\n"
            + original_code
        )
        
        return fixed
    
    def run(self):
        """Run the agent"""
        self.agent.run()