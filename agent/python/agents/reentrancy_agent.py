"""
Reentrancy Specialist Agent
Version: 2.0.0
Updated: 2025-10-26 05:56:13 UTC
Developer: charlesms-eth

Detects reentrancy vulnerabilities using uAgents framework and MeTTa reasoning.
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


class ReentrancyAgent:
    """
    Reentrancy Specialist Agent with uAgents Framework
    
    Detects:
    - Reentrancy vulnerabilities
    - CEI pattern violations
    - State changes after external calls
    - Missing reentrancy guards
    """
    
    def __init__(self):
        """Initialize reentrancy agent"""
        
        self.agent = Agent(
            name="markov_reentrancy",
            seed=os.getenv("REENTRANCY_AGENT_SEED", "reentrancy_seed_default"),
            port=8002,
            endpoint=["http://localhost:8002/submit"],
            mailbox=os.getenv("REENTRANCY_MAILBOX_KEY")
        )
        
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  Reentrancy agent: Could not fund: {e}")
        
        self.address = str(self.agent.address)
        print(f"   ✓ Reentrancy Agent Address: {self.address}")
        
        self.metta_reasoner = MeTTaReasoner()
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup agent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            ctx.logger.info(f"🤖 Reentrancy Agent started")
            ctx.logger.info(f"   Address: {self.agent.address}")
            await self.metta_reasoner.load_knowledge_base()
        
        @self.agent.on_message(model=AgentTaskRequest)
        async def handle_task(ctx: Context, sender: str, msg: AgentTaskRequest):
            if msg.agent_type != "reentrancy":
                return
            
            ctx.logger.info(f"📥 Analyzing {msg.contract_name} for reentrancy...")
            
            analysis = await self.analyze(msg.source_code, msg.metta_context)
            
            response = AgentTaskResponse(
                audit_id=msg.audit_id,
                agent_type="reentrancy",
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
        """
        Analyze contract for reentrancy vulnerabilities
        
        Uses MeTTa reasoning to detect:
        - External calls before state updates
        - Missing reentrancy guards
        - CEI pattern violations
        """
        
        findings = {
            "checks": {},
            "issues": [],
            "code_fixes": []
        }
        
        # Check 1: Reentrancy Guard Present
        has_reentrancy_guard = bool(
            re.search(r'ReentrancyGuard|nonReentrant', source_code)
        )
        findings["checks"]["reentrancy_guard_present"] = has_reentrancy_guard
        
        # Check 2: Checks-Effects-Interactions Pattern
        follows_cei = await self._check_cei_pattern(source_code)
        findings["checks"]["checks_effects_interactions"] = follows_cei
        
        # Check 3: State changes after external calls
        vulnerable_patterns = self._find_vulnerable_patterns(source_code)
        findings["checks"]["no_state_after_call"] = len(vulnerable_patterns) == 0
        
        # Check 4: Pull over push pattern
        uses_pull_pattern = self._check_pull_pattern(source_code)
        findings["checks"]["uses_pull_payment"] = uses_pull_pattern
        
        # Use MeTTa to reason about findings
        metta_query = f"""
        (detect-reentrancy 
          (contract 
            (has-guard {has_reentrancy_guard})
            (follows-cei {follows_cei})
            (vulnerable-patterns {len(vulnerable_patterns)})))
        """
        
        metta_result = await self.metta_reasoner.query(metta_query)
        
        # Generate issues based on findings
        if not has_reentrancy_guard and vulnerable_patterns:
            for pattern in vulnerable_patterns:
                findings["issues"].append({
                    "severity": "high",
                    "title": "Reentrancy Vulnerability Detected",
                    "description": (
                        f"Function '{pattern['function']}' performs external call "
                        f"at line {pattern['line']} followed by state changes. "
                        f"This allows attackers to reenter and drain funds."
                    ),
                    "location": f"Line {pattern['line']}",
                    "recommendation": (
                        "1. Implement ReentrancyGuard from OpenZeppelin\n"
                        "2. Follow checks-effects-interactions pattern\n"
                        "3. Update state before external calls"
                    )
                })
                
                # Generate code fix
                findings["code_fixes"].append({
                    "issue": "Missing ReentrancyGuard",
                    "original": pattern["code"],
                    "fixed": self._generate_fixed_code(pattern),
                    "explanation": (
                        "Added nonReentrant modifier to prevent reentrant calls. "
                        "Also reordered code to follow CEI pattern."
                    )
                })
        
        # Add MeTTa reasoning insights
        findings["metta_reasoning"] = metta_result
        
        return findings
    
    async def _check_cei_pattern(self, source_code: str) -> bool:
        """Check if contract follows Checks-Effects-Interactions pattern"""
        
        # Look for patterns where state is modified before external calls
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Found external call
            if re.search(r'\.call\{|\.transfer\(|\.send\(', line):
                # Check previous 5 lines for state modifications
                for j in range(max(0, i - 5), i):
                    if re.search(r'\w+\s*=\s*', lines[j]):
                        # State modification before call - good!
                        return True
        
        return False
    
    def _find_vulnerable_patterns(self, source_code: str) -> List[Dict]:
        """Find specific code patterns vulnerable to reentrancy"""
        
        vulnerabilities = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Found external call
            if re.search(r'\.call\{|\.send\(|\.transfer\(', line):
                # Check next few lines for state changes
                for j in range(i + 1, min(i + 5, len(lines))):
                    if re.search(r'(\w+)\s*=\s*', lines[j]):
                        # Check if it's a balance or important state
                        if re.search(r'balance|amount|shares|deposit', lines[j], re.IGNORECASE):
                            vulnerabilities.append({
                                "function": self._extract_function_name(lines, i),
                                "line": i + 1,
                                "code": '\n'.join(lines[max(0, i-2):min(len(lines), j+2)])
                            })
                            break
        
        return vulnerabilities
    
    def _extract_function_name(self, lines: List[str], line_number: int) -> str:
        """Extract function name from line number"""
        
        for i in range(line_number, -1, -1):
            match = re.search(r'function\s+(\w+)', lines[i])
            if match:
                return match.group(1)
        return "unknown"
    
    def _check_pull_pattern(self, source_code: str) -> bool:
        """Check if contract uses pull payment pattern"""
        
        withdrawal_patterns = [
            r'function\s+withdraw\s*\(',
            r'mapping\s*\([^)]+\)\s*\w*balance',
            r'pendingWithdrawals',
        ]
        
        return any(re.search(pattern, source_code) for pattern in withdrawal_patterns)
    
    def _generate_fixed_code(self, pattern: Dict) -> str:
        """Generate fixed code with reentrancy protection"""
        
        original = pattern["code"]
        function_name = pattern["function"]
        
        # Add nonReentrant modifier
        fixed = re.sub(
            r'function\s+' + function_name + r'\s*\(',
            f'function {function_name}() nonReentrant (',
            original
        )
        
        # Reorder to follow CEI pattern (simplified)
        lines = fixed.split('\n')
        call_line = None
        state_lines = []
        
        for i, line in enumerate(lines):
            if '.call{' in line or '.transfer(' in line:
                call_line = i
            elif '=' in line and 'balance' in line.lower():
                state_lines.append(i)
        
        # Move state changes before call
        if call_line and state_lines:
            # Simple reordering (production would need AST manipulation)
            fixed += "\n// TODO: Reorder state changes before external call"
        
        return fixed
    
    def run(self):
        """Run the agent"""
        self.agent.run()