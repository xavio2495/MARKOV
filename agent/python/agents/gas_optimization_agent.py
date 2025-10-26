"""
Gas Optimization Specialist Agent
Version: 2.0.0
Updated: 2025-10-26 05:59:08 UTC
Developer: charlesms-eth

Identifies gas inefficiencies and optimization opportunities.
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


class GasOptimizationAgent:
    """
    Gas Optimization Specialist Agent with uAgents Framework
    
    Detects:
    - Inefficient storage usage
    - Memory vs calldata opportunities
    - Loop optimizations
    - Redundant storage reads
    - Storage packing issues
    """
    
    def __init__(self):
        """Initialize gas optimization agent"""
        
        self.agent = Agent(
            name="markov_gas_optimization",
            seed=os.getenv("GAS_OPTIMIZATION_AGENT_SEED", "gas_optimization_seed_default"),
            port=8006,
            endpoint=["http://localhost:8006/submit"],
            mailbox=os.getenv("GAS_OPTIMIZATION_MAILBOX_KEY")
        )
        
        try:
            fund_agent_if_low(self.agent.wallet.address())
        except Exception as e:
            print(f"   ⚠️  Gas Optimization agent: Could not fund: {e}")
        
        self.address = str(self.agent.address)
        print(f"   ✓ Gas Optimization Agent Address: {self.address}")
        
        self.metta_reasoner = MeTTaReasoner()
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup agent message handlers"""
        
        @self.agent.on_event("startup")
        async def startup(ctx: Context):
            ctx.logger.info(f"🤖 Gas Optimization Agent started")
            await self.metta_reasoner.load_knowledge_base()
        
        @self.agent.on_message(model=AgentTaskRequest)
        async def handle_task(ctx: Context, sender: str, msg: AgentTaskRequest):
            if msg.agent_type != "gas_optimization":
                return
            
            analysis = await self.analyze(msg.source_code, msg.metta_context)
            
            response = AgentTaskResponse(
                audit_id=msg.audit_id,
                agent_type="gas_optimization",
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
        """Analyze contract for gas optimization opportunities"""
        
        findings = {
            "checks": {},
            "issues": [],
            "code_fixes": []
        }
        
        # Check 1: Memory vs Calldata
        memory_issues = self._find_memory_vs_calldata(source_code)
        findings["checks"]["optimal_data_location"] = len(memory_issues) == 0
        
        # Check 2: Storage packing
        storage_packing = self._analyze_storage_packing(source_code)
        findings["checks"]["efficient_storage_packing"] = storage_packing['optimal']
        
        # Check 3: Loop optimizations
        loop_issues = self._find_loop_inefficiencies(source_code)
        findings["checks"]["optimized_loops"] = len(loop_issues) == 0
        
        # Check 4: Redundant storage reads
        redundant_reads = self._find_redundant_storage_reads(source_code)
        findings["checks"]["cached_storage_reads"] = len(redundant_reads) == 0
        
        # Check 5: Constants usage
        constant_opportunities = self._find_constant_opportunities(source_code)
        findings["checks"]["uses_constants"] = len(constant_opportunities) == 0
        
        # MeTTa reasoning
        metta_query = f"""
        (analyze-gas-optimization
          (contract
            (memory-issues {len(memory_issues)})
            (loop-issues {len(loop_issues)})
            (redundant-reads {len(redundant_reads)})))
        """
        
        metta_result = await self.metta_reasoner.query(metta_query)
        
        # Generate issues for memory/calldata
        for issue in memory_issues:
            findings["issues"].append({
                "severity": "low",
                "title": "Inefficient Data Location (Memory vs Calldata)",
                "description": (
                    f"Parameter at line {issue['line']} uses 'memory' but could use "
                    f"'calldata' for read-only data. Using calldata saves ~200 gas per parameter."
                ),
                "location": f"Line {issue['line']}",
                "recommendation": "Change parameter location from memory to calldata"
            })
            
            findings["code_fixes"].append({
                "issue": "Memory instead of calldata",
                "original": issue['code'],
                "fixed": issue['code'].replace(' memory ', ' calldata '),
                "explanation": "Calldata is cheaper than memory for external function parameters"
            })
        
        # Storage packing issues
        if not storage_packing['optimal'] and storage_packing.get('suggestion'):
            findings["issues"].append({
                "severity": "low",
                "title": "Suboptimal Storage Packing",
                "description": (
                    "State variables could be reordered to pack into fewer storage slots. "
                    "Each storage slot costs ~20,000 gas to initialize. Better packing can "
                    "save significant gas on deployment and state modifications."
                ),
                "location": "Contract storage layout",
                "recommendation": "Reorder state variables: smaller types together, then larger types"
            })
            
            findings["code_fixes"].append({
                "issue": "Inefficient storage packing",
                "original": storage_packing['original'],
                "fixed": storage_packing['suggestion'],
                "explanation": "Reordered variables to fit in fewer 32-byte storage slots"
            })
        
        # Loop optimizations
        for loop_issue in loop_issues:
            findings["issues"].append({
                "severity": "low",
                "title": loop_issue['title'],
                "description": loop_issue['description'],
                "location": f"Line {loop_issue['line']}",
                "recommendation": loop_issue['recommendation']
            })
            
            if loop_issue.get('fix'):
                findings["code_fixes"].append(loop_issue['fix'])
        
        # Redundant storage reads
        for redundant in redundant_reads[:3]:  # Limit to 3
            findings["issues"].append({
                "severity": "low",
                "title": "Redundant Storage Read",
                "description": (
                    f"Variable '{redundant['variable']}' read {redundant['count']} times "
                    f"in function. Each SLOAD costs 100 gas. Cache in memory variable to save gas."
                ),
                "location": f"Line {redundant['line']}",
                "recommendation": f"Cache {redundant['variable']} in memory at start of function"
            })
        
        # Constant opportunities
        for const in constant_opportunities:
            findings["issues"].append({
                "severity": "low",
                "title": "Variable Could Be Constant",
                "description": (
                    f"Variable '{const['name']}' is never modified and could be declared as "
                    f"constant or immutable, saving gas on deployment and reads."
                ),
                "location": f"Line {const['line']}",
                "recommendation": f"Declare {const['name']} as constant or immutable"
            })
        
        findings["metta_reasoning"] = metta_result
        
        return findings
    
    def _find_memory_vs_calldata(self, source_code: str) -> List[Dict]:
        """Find parameters that could use calldata instead of memory"""
        
        issues = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Look for external/public functions with memory parameters
            if re.search(r'function\s+\w+\s*\([^)]*\)\s*(external|public)', line):
                # Check if has memory array/string parameters
                memory_params = re.findall(r'(\w+\[\]\s+memory|\w+\s+memory)\s+\w+', line)
                
                if memory_params:
                    issues.append({
                        'line': i + 1,
                        'code': line.strip(),
                        'params': memory_params
                    })
        
        return issues
    
    def _analyze_storage_packing(self, source_code: str) -> Dict[str, Any]:
        """Analyze state variable storage packing"""
        
        # Extract state variables
        state_vars = []
        lines = source_code.split('\n')
        in_contract = False
        
        for i, line in enumerate(lines):
            if re.search(r'contract\s+\w+', line):
                in_contract = True
                continue
            
            if in_contract and re.search(r'^\s*(uint|int|bool|address|bytes)', line):
                # Parse variable type and name
                match = re.search(r'(uint\d*|int\d*|bool|address|bytes\d*)\s+(public\s+|private\s+|internal\s+)?(\w+)', line)
                if match:
                    var_type = match.group(1)
                    var_name = match.group(3)
                    size = self._get_type_size(var_type)
                    
                    state_vars.append({
                        'line': i + 1,
                        'type': var_type,
                        'name': var_name,
                        'size': size
                    })
        
        if not state_vars or len(state_vars) < 2:
            return {'optimal': True}
        
        # Check if packing is optimal
        optimal = self._is_packing_optimal(state_vars)
        
        if not optimal:
            # Generate suggestion
            sorted_vars = sorted(state_vars, key=lambda x: (x['size'], x['name']))
            
            original = '\n'.join([f"    {v['type']} {v['name']};" for v in state_vars[:5]])
            suggestion = '\n'.join([f"    {v['type']} {v['name']};" for v in sorted_vars[:5]])
            
            return {
                'optimal': False,
                'original': original,
                'suggestion': suggestion
            }
        
        return {'optimal': True}
    
    def _get_type_size(self, var_type: str) -> int:
        """Get storage size of type in bytes"""
        
        if var_type == 'bool':
            return 1
        elif var_type.startswith('uint') or var_type.startswith('int'):
            match = re.search(r'\d+', var_type)
            bits = int(match.group()) if match else 256
            return bits // 8
        elif var_type == 'address':
            return 20
        elif var_type.startswith('bytes'):
            match = re.search(r'\d+', var_type)
            return int(match.group()) if match else 32
        else:
            return 32
    
    def _is_packing_optimal(self, state_vars: List[Dict]) -> bool:
        """Check if variable ordering is optimal for storage packing"""
        
        # Check if variables are roughly ordered by size
        sizes = [v['size'] for v in state_vars]
        
        # Count slot usage
        current_slot = 0
        for size in sizes:
            if current_slot + size > 32:
                current_slot = size
            else:
                current_slot += size
        
        # Check optimized ordering
        sorted_sizes = sorted(sizes)
        optimal_slot = 0
        for size in sorted_sizes:
            if optimal_slot + size > 32:
                optimal_slot = size
            else:
                optimal_slot += size
        
        # If current uses more space, it's not optimal
        return current_slot <= optimal_slot
    
    def _find_loop_inefficiencies(self, source_code: str) -> List[Dict]:
        """Find inefficient loop patterns"""
        
        issues = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Check for .length in loop condition
            if re.search(r'for\s*\([^;]*;\s*\w+\s*<\s*\w+\.length', line):
                issues.append({
                    'line': i + 1,
                    'title': 'Array Length in Loop Condition',
                    'description': (
                        "Loop reads array.length on every iteration (SLOAD = 100 gas each). "
                        "Cache length in local variable to save gas."
                    ),
                    'recommendation': "uint256 len = array.length; for (uint256 i; i < len; ++i)",
                    'fix': {
                        'issue': 'Array length in loop',
                        'original': line.strip(),
                        'fixed': self._generate_cached_length_loop(line),
                        'explanation': "Cache array length to avoid repeated SLOAD operations"
                    }
                })
            
            # Check for i++ vs ++i
            if re.search(r'for\s*\([^;]*;\s*[^;]*;\s*i\+\+', line):
                issues.append({
                    'line': i + 1,
                    'title': 'Use ++i Instead of i++',
                    'description': "Using ++i saves ~5 gas per iteration compared to i++",
                    'recommendation': "Change i++ to ++i in loop increment",
                    'fix': {
                        'issue': 'Post-increment in loop',
                        'original': line.strip(),
                        'fixed': line.replace('i++', '++i'),
                        'explanation': "Pre-increment (++i) is more gas efficient than post-increment (i++)"
                    }
                })
        
        return issues
    
    def _find_redundant_storage_reads(self, source_code: str) -> List[Dict]:
        """Find redundant storage variable reads"""
        
        redundant = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if 'function' in line:
                func_body = self._extract_function_body(lines, i)
                
                # Find state variable usages (simplified heuristic)
                var_usage = {}
                for var_line in func_body.split('\n'):
                    # Look for common state variable patterns
                    matches = re.findall(r'\b([a-z][a-zA-Z0-9_]*)\b', var_line)
                    for match in matches:
                        # Filter out keywords
                        if match not in ['memory', 'storage', 'calldata', 'return', 'if', 'for', 'while', 'function']:
                            var_usage[match] = var_usage.get(match, 0) + 1
                
                # Report variables used 4+ times
                for var_name, count in var_usage.items():
                    if count >= 4:
                        redundant.append({
                            'line': i + 1,
                            'variable': var_name,
                            'count': count
                        })
        
        return redundant
    
    def _find_constant_opportunities(self, source_code: str) -> List[Dict]:
        """Find variables that could be constant"""
        
        opportunities = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            # Look for state variables that are never modified
            match = re.search(r'(uint\d*|int\d*|address|bytes\d*)\s+(public\s+|private\s+)?(\w+)\s*=', line)
            if match:
                var_type = match.group(1)
                var_name = match.group(3)
                
                # Check if it's already constant/immutable
                if 'constant' not in line and 'immutable' not in line:
                    # Simple heuristic: if assigned a literal value, could be constant
                    if re.search(r'=\s*[0-9x"\']+', line):
                        opportunities.append({
                            'line': i + 1,
                            'name': var_name,
                            'type': var_type
                        })
        
        return opportunities
    
    def _generate_cached_length_loop(self, original: str) -> str:
        """Generate loop with cached length"""
        
        match = re.search(r'(\w+)\.length', original)
        if match:
            array_name = match.group(1)
            fixed = f"uint256 length = {array_name}.length;\n        "
            fixed += original.replace(f'{array_name}.length', 'length')
            return fixed
        
        return original
    
    def _extract_function_body(self, lines: List[str], start: int) -> str:
        """Extract function body"""
        
        brace_count = 0
        body_lines = []
        started = False
        
        for i in range(start, min(start + 100, len(lines))):
            line = lines[i]
            
            if '{' in line:
                started = True
            
            if started:
                body_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                
                if brace_count == 0:
                    break
        
        return '\n'.join(body_lines)
    
    def run(self):
        """Run the agent"""
        self.agent.run()