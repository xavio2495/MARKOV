"""
Integer Overflow Specialist Agent
Version: 2.0.0
Updated: 2025-10-26 05:59:08 UTC
Developer: charlesms-eth

Detects integer overflow/underflow vulnerabilities.
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


class IntegerOverflowAgent:
    """
    Integer Overflow Specialist Agent with uAgents Framework
    
    Detects:
    - Integer overflow/underflow risks
    - Missing SafeMath usage (pre-0.8.0)
    - Unsafe arithmetic operations
    - Unchecked blocks in Solidity 0.8+
    """
    
    def __init__(self):
        """Initialize integer overflow agent"""
        
        self.agent = Agent(
            name="markov_integer_overflow",
            seed=os.getenv("INTEGER_OVERFLOW_AGENT_SEED", "integer_overflow_seed_default"),
            port=8004,
            endpoint=["http://localhost:8004/submit"],
            mailbox=os.getenv("INTEGER_OVERFLOW_MAILBOX_KEY")
        )
        
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  Integer Overflow agent: Could not fund: {e}")
        
        self.address = str(self.agent.address)
        print(f"   ✓ Integer Overflow Agent Address: {self.address}")
        
        self.metta_reasoner = MeTTaReasoner()
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup agent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            ctx.logger.info(f"🤖 Integer Overflow Agent started")
            await self.metta_reasoner.load_knowledge_base()
        
        @self.agent.on_message(model=AgentTaskRequest)
        async def handle_task(ctx: Context, sender: str, msg: AgentTaskRequest):
            if msg.agent_type != "integer_overflow":
                return
            
            analysis = await self.analyze(msg.source_code, msg.metta_context)
            
            response = AgentTaskResponse(
                audit_id=msg.audit_id,
                agent_type="integer_overflow",
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
        """Analyze contract for integer overflow issues"""
        
        findings = {
            "checks": {},
            "issues": [],
            "code_fixes": []
        }
        
        # Check 1: Solidity version
        version = self._extract_solidity_version(source_code)
        is_safe_version = self._check_safe_version(version)
        findings["checks"]["solidity_version_safe"] = is_safe_version
        
        # Check 2: SafeMath usage (for older versions)
        uses_safe_math = bool(re.search(r'using SafeMath|SafeMath\.(add|sub|mul|div)', source_code))
        findings["checks"]["uses_safe_math"] = uses_safe_math
        
        # Check 3: Unchecked blocks
        unchecked_blocks = self._find_unchecked_blocks(source_code)
        findings["checks"]["appropriate_unchecked_usage"] = len(unchecked_blocks) == 0 or is_safe_version
        
        # Check 4: Arithmetic operations
        arithmetic_ops = self._find_arithmetic_operations(source_code)
        findings["checks"]["arithmetic_operations_safe"] = is_safe_version or uses_safe_math
        
        # Check 5: Division before multiplication
        precision_loss = self._check_precision_loss(source_code)
        findings["checks"]["no_precision_loss"] = len(precision_loss) == 0
        
        # MeTTa reasoning
        metta_query = f"""
        (analyze-integer-overflow
          (contract
            (solidity-version "{version}")
            (uses-safe-math {uses_safe_math})
            (has-arithmetic {len(arithmetic_ops) > 0})
            (has-unchecked {len(unchecked_blocks) > 0})))
        """
        
        metta_result = await self.metta_reasoner.query(metta_query)
        
        # Generate issues
        if not is_safe_version and not uses_safe_math and arithmetic_ops:
            for op in arithmetic_ops[:3]:  # Limit to first 3 for brevity
                findings["issues"].append({
                    "severity": "high",
                    "title": "Integer Overflow/Underflow Risk",
                    "description": (
                        f"Arithmetic operation at line {op['line']} is vulnerable to "
                        f"integer overflow/underflow. Contract uses Solidity {version} "
                        f"without SafeMath protection."
                    ),
                    "location": f"Line {op['line']}",
                    "recommendation": (
                        "1. Upgrade to Solidity 0.8.0+ for built-in protection\n"
                        "2. Or use SafeMath library for all arithmetic operations"
                    )
                })
            
            findings["code_fixes"].append({
                "issue": "Missing overflow protection",
                "original": f"pragma solidity ^{version};",
                "fixed": "pragma solidity ^0.8.20;",
                "explanation": "Solidity 0.8.0+ has built-in overflow/underflow protection"
            })
            
            if not uses_safe_math and arithmetic_ops:
                findings["code_fixes"].append({
                    "issue": "Add SafeMath library",
                    "original": arithmetic_ops[0]["code"],
                    "fixed": self._add_safemath(arithmetic_ops[0]["code"]),
                    "explanation": "Use SafeMath library for safe arithmetic operations"
                })
        
        # Check for risky unchecked blocks
        if unchecked_blocks and is_safe_version:
            for block in unchecked_blocks:
                if not self._is_safe_unchecked_usage(block):
                    findings["issues"].append({
                        "severity": "medium",
                        "title": "Potentially Unsafe Unchecked Block",
                        "description": (
                            f"Unchecked block at line {block['line']} may contain "
                            f"operations that could overflow without protection. "
                            f"Verify this is intentional."
                        ),
                        "location": f"Line {block['line']}",
                        "recommendation": "Review unchecked blocks for overflow safety"
                    })
        
        # Precision loss issues
        for loss in precision_loss:
            findings["issues"].append({
                "severity": "medium",
                "title": "Precision Loss: Division Before Multiplication",
                "description": (
                    f"Operation at line {loss['line']} performs division before "
                    f"multiplication, which can lead to precision loss in integer arithmetic."
                ),
                "location": f"Line {loss['line']}",
                "recommendation": "Reorder operations: multiply first, then divide"
            })
        
        findings["metta_reasoning"] = metta_result
        
        return findings
    
    def _extract_solidity_version(self, source_code: str) -> str:
        """Extract Solidity version from pragma"""
        match = re.search(r'pragma solidity\s+[\^~><=]*([0-9.]+)', source_code)
        return match.group(1) if match else "unknown"
    
    def _check_safe_version(self, version: str) -> bool:
        """Check if Solidity version has built-in overflow protection"""
        if version == "unknown":
            return False
        
        try:
            parts = version.split('.')
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
            
            return major > 0 or (major == 0 and minor >= 8)
        except:
            return False
    
    def _find_unchecked_blocks(self, source_code: str) -> List[Dict]:
        """Find unchecked blocks in source code"""
        
        blocks = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\bunchecked\s*\{', line):
                blocks.append({
                    'line': i + 1,
                    'code': self._extract_block(lines, i)
                })
        
        return blocks
    
    def _find_arithmetic_operations(self, source_code: str) -> List[Dict]:
        """Find arithmetic operations in code"""
        
        operations = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Skip comments and strings
            if '//' in line or '/*' in line or '"' in line:
                continue
            
            # Look for arithmetic operators
            if re.search(r'[+\-*/]\s*=|=\s*\w+\s*[+\-*/]', line):
                # Skip if in SafeMath context
                if 'SafeMath' in line:
                    continue
                
                operations.append({
                    'line': i + 1,
                    'code': line.strip(),
                    'operator': self._extract_operator(line)
                })
        
        return operations
    
    def _check_precision_loss(self, source_code: str) -> List[Dict]:
        """Check for division before multiplication (precision loss)"""
        
        precision_issues = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Pattern: a / b * c (loses precision)
            if re.search(r'\w+\s*/\s*\w+\s*\*\s*\w+', line):
                precision_issues.append({
                    'line': i + 1,
                    'code': line.strip()
                })
        
        return precision_issues
    
    def _extract_block(self, lines: List[str], start: int) -> str:
        """Extract code block starting from line"""
        
        brace_count = 0
        block_lines = []
        
        for i in range(start, min(start + 20, len(lines))):
            line = lines[i]
            block_lines.append(line)
            
            brace_count += line.count('{') - line.count('}')
            
            if brace_count == 0 and '{' in line:
                break
        
        return '\n'.join(block_lines)
    
    def _extract_operator(self, line: str) -> str:
        """Extract arithmetic operator from line"""
        
        for op in ['+', '-', '*', '/', '%']:
            if op in line:
                return op
        return 'unknown'
    
    def _is_safe_unchecked_usage(self, block: Dict) -> bool:
        """Check if unchecked block usage is safe"""
        
        code = block['code'].lower()
        
        # Safe patterns: loop counters, gas optimization for known safe operations
        safe_patterns = [
            r'\+\+',  # Increment
            r'--',    # Decrement
            r'i\s*\+\s*1',  # Loop counter
        ]
        
        # Unsafe patterns: user input, complex arithmetic
        unsafe_patterns = [
            r'msg\.value',
            r'amount',
            r'balance',
            r'\*',  # Multiplication
            r'user',
            r'input',
        ]
        
        has_safe = any(re.search(pattern, code) for pattern in safe_patterns)
        has_unsafe = any(re.search(pattern, code) for pattern in unsafe_patterns)
        
        return has_safe and not has_unsafe
    
    def _add_safemath(self, code: str) -> str:
        """Add SafeMath library usage"""
        
        fixed = "using SafeMath for uint256;\n\n" + code
        
        # Replace operators
        fixed = re.sub(r'(\w+)\s*\+\s*(\w+)', r'\1.add(\2)', fixed)
        fixed = re.sub(r'(\w+)\s*-\s*(\w+)', r'\1.sub(\2)', fixed)
        fixed = re.sub(r'(\w+)\s*\*\s*(\w+)', r'\1.mul(\2)', fixed)
        fixed = re.sub(r'(\w+)\s*/\s*(\w+)', r'\1.div(\2)', fixed)
        
        return fixed
    
    def run(self):
        """Run the agent"""
        self.agent.run()