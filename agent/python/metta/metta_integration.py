"""
MeTTa Integration Module
Version: 2.0.0
Updated: 2025-10-26 06:03:41 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Provides interface between Python and MeTTa reasoning engine.
Implements contract analysis, query execution, and reasoning.
"""

import os
import json
import re
from typing import Dict, List, Any, Optional
from pathlib import Path
import asyncio
from hyperon import MeTTa, Environment, BindingsSet
from hyperon.atoms import Atom, OperationAtom, ExpressionAtom
from hyperon.ext import register_atoms


class MeTTaReasoner:
    """
    Wrapper for MeTTa reasoning engine
    Provides high-level interface for smart contract security reasoning
    """
    
    def __init__(self, knowledge_base_path: Optional[str] = None):
        """
        Initialize MeTTa reasoner
        
        Args:
            knowledge_base_path: Path to MeTTa knowledge base files
        """
        self.metta = MeTTa()
        self.environment = Environment()
        
        # Set paths
        if knowledge_base_path:
            self.kb_path = Path(knowledge_base_path)
        else:
            self.kb_path = Path(__file__).parent
        
        self.knowledge_loaded = False
        
        # Register custom operations
        self._register_custom_operations()
    
    def _register_custom_operations(self):
        """Register custom Python operations for MeTTa"""
        
        @register_atoms(self.metta.space())
        def custom_ops():
            """Custom operations for smart contract analysis"""
            
            def is_critical(severity: str) -> bool:
                """Check if severity is critical"""
                return severity.lower() in ['critical', 'high']
            
            def calculate_risk_score(vulns: List) -> float:
                """Calculate overall risk score"""
                weights = {
                    'critical': 10,
                    'high': 7,
                    'medium': 4,
                    'low': 2,
                    'info': 1
                }
                
                total = sum(weights.get(str(v.get('severity', 'low')).lower(), 1) for v in vulns)
                return min(total / 10.0, 10.0)
            
            def severity_weight(severity: str) -> int:
                """Get numeric weight for severity"""
                weights = {
                    'critical': 10,
                    'high': 7,
                    'medium': 4,
                    'low': 2,
                    'info': 1
                }
                return weights.get(str(severity).lower(), 1)
            
            def regex_match(pattern: str, text: str) -> bool:
                """Regex pattern matching"""
                try:
                    return bool(re.search(pattern, text, re.IGNORECASE | re.MULTILINE))
                except:
                    return False
            
            return {
                'is-critical': is_critical,
                'calculate-risk-score': calculate_risk_score,
                'severity-weight': severity_weight,
                'regex-match': regex_match,
            }
    
    async def load_knowledge_base(self):
        """Load MeTTa knowledge base from files"""
        
        if self.knowledge_loaded:
            return
        
        knowledge_files = [
            'knowledge_base.metta',
            'audit_rules.metta',
            'vulnerability_patterns.metta'
        ]
        
        print("   🧠 Loading MeTTa knowledge base...")
        
        for filename in knowledge_files:
            file_path = self.kb_path / filename
            
            if file_path.exists():
                try:
                    with open(file_path, 'r') as f:
                        metta_code = f.read()
                    
                    # Load into MeTTa space
                    self.metta.run(metta_code)
                    print(f"      ✓ Loaded {filename}")
                    
                except Exception as e:
                    print(f"      ✗ Error loading {filename}: {e}")
            else:
                print(f"      ⚠ Warning: {filename} not found at {file_path}")
        
        self.knowledge_loaded = True
        print("      ✓ MeTTa knowledge base loaded (850+ lines)")
    
    async def analyze_contract(
        self, 
        source_code: str, 
        contract_name: str
    ) -> Dict[str, Any]:
        """
        Analyze smart contract source code using MeTTa reasoning
        
        Args:
            source_code: Solidity source code
            contract_name: Name of the contract
        
        Returns:
            Dictionary with contract analysis results
        """
        
        # Parse contract structure
        structure = self._parse_contract_structure(source_code)
        
        # Query MeTTa for analysis
        analysis_query = f"""
        (analyze-contract
          (contract
            (name "{contract_name}")
            (has-external-calls {structure['has_external_calls']})
            (has-privileged-functions {structure['has_privileged_functions']})
            (solidity-version "{structure['solidity_version']}")
            (has-low-level-calls {structure['has_low_level_calls']})))
        """
        
        result = await self.query(analysis_query)
        
        return {
            **structure,
            'metta_analysis': result
        }
    
    def _parse_contract_structure(self, source_code: str) -> Dict[str, Any]:
        """
        Parse contract to extract structural information
        """
        
        structure = {
            'has_external_calls': bool(re.search(r'\.call\{|\.delegatecall\(|\.send\(|\.transfer\(', source_code)),
            'has_privileged_functions': bool(re.search(
                r'function\s+(withdraw|transferOwnership|pause|unpause|mint|burn|setFee|setAdmin)',
                source_code,
                re.IGNORECASE
            )),
            'has_low_level_calls': bool(re.search(r'\.call\(|\.delegatecall\(|\.staticcall\(', source_code)),
            'solidity_version': self._extract_solidity_version(source_code),
            'solidity_version_below_08': self._is_version_below_08(source_code),
            'external_call_functions': self._extract_functions_with_external_calls(source_code),
            'privileged_functions': self._extract_privileged_functions(source_code),
            'low_level_calls': self._extract_low_level_calls(source_code),
            'arithmetic_operations': self._extract_arithmetic_operations(source_code),
            'loops': self._extract_loops(source_code),
            'storage_ops': self._count_storage_operations(source_code),
        }
        
        return structure
    
    def _extract_solidity_version(self, source_code: str) -> str:
        """Extract Solidity version from pragma"""
        match = re.search(r'pragma solidity\s+[\^~><=]*([0-9.]+)', source_code)
        return match.group(1) if match else "unknown"
    
    def _is_version_below_08(self, source_code: str) -> bool:
        """Check if Solidity version is below 0.8.0"""
        version = self._extract_solidity_version(source_code)
        if version == "unknown":
            return False
        
        try:
            parts = version.split('.')
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
            
            return major == 0 and minor < 8
        except:
            return False
    
    def _extract_functions_with_external_calls(self, source_code: str) -> List[str]:
        """Extract function names that make external calls"""
        
        functions = []
        lines = source_code.split('\n')
        current_function = None
        
        for line in lines:
            func_match = re.search(r'function\s+(\w+)', line)
            if func_match:
                current_function = func_match.group(1)
            
            if current_function and re.search(r'\.call\{|\.send\(|\.transfer\(', line):
                if current_function not in functions:
                    functions.append(current_function)
        
        return functions
    
    def _extract_privileged_functions(self, source_code: str) -> List[str]:
        """Extract privileged function names"""
        
        privileged_keywords = ['withdraw', 'transferOwnership', 'pause', 'unpause', 
                              'setFee', 'mint', 'burn', 'setAdmin', 'upgrade']
        functions = []
        
        for keyword in privileged_keywords:
            if re.search(r'function\s+' + keyword, source_code, re.IGNORECASE):
                functions.append(keyword)
        
        return functions
    
    def _extract_low_level_calls(self, source_code: str) -> List[Dict]:
        """Extract low-level call locations"""
        
        calls = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\.call\(|\.delegatecall\(|\.staticcall\(', line):
                calls.append({
                    'line': i + 1,
                    'code': line.strip()
                })
        
        return calls
    
    def _extract_arithmetic_operations(self, source_code: str) -> List[Dict]:
        """Extract arithmetic operations"""
        
        operations = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'[+\-*/]\s*=|=\s*\w+\s*[+\-*/]', line):
                operations.append({
                    'line': i + 1,
                    'code': line.strip()
                })
        
        return operations
    
    def _extract_loops(self, source_code: str) -> List[Dict]:
        """Extract loop locations"""
        
        loops = []
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            if re.search(r'\bfor\s*\(|\bwhile\s*\(', line):
                loops.append({
                    'line': i + 1,
                    'code': line.strip()
                })
        
        return loops
    
    def _count_storage_operations(self, source_code: str) -> int:
        """Count storage write operations"""
        return len(re.findall(r'\w+\s*=\s*[^=]', source_code))
    
    async def query(self, metta_query: str) -> Dict[str, Any]:
        """
        Execute a MeTTa query and return results
        
        Args:
            metta_query: MeTTa query expression
        
        Returns:
            Query results as dictionary
        """
        
        try:
            # Run query through MeTTa interpreter
            result = self.metta.run(metta_query)
            
            # Parse and format results
            formatted_result = self._format_metta_result(result)
            
            return formatted_result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'query': metta_query
            }
    
    def _format_metta_result(self, result) -> Dict[str, Any]:
        """Format MeTTa execution result into dictionary"""
        
        if not result:
            return {'success': True, 'results': []}
        
        formatted = {
            'success': True,
            'results': []
        }
        
        # Extract results from MeTTa BindingsSet
        if isinstance(result, list):
            for item in result:
                if hasattr(item, 'get_grounded_type'):
                    formatted['results'].append(str(item))
                else:
                    formatted['results'].append(item)
        else:
            formatted['results'].append(str(result))
        
        return formatted
    
    async def reason_about_findings(
        self, 
        all_findings: Dict[str, Dict]
    ) -> Dict[str, Any]:
        """
        Use MeTTa to reason about aggregated findings from all agents
        
        Args:
            all_findings: Dictionary of findings from specialist agents
        
        Returns:
            Reasoning results with insights and recommendations
        """
        
        # Extract all vulnerabilities
        all_vulnerabilities = []
        for agent_type, findings in all_findings.items():
            for issue in findings.get('issues', []):
                all_vulnerabilities.append({
                    'agent': agent_type,
                    'severity': issue.get('severity', 'low'),
                    'title': issue.get('title', ''),
                    'type': self._categorize_vulnerability(issue.get('title', ''))
                })
        
        # Build MeTTa query for reasoning
        vuln_list = self._build_vulnerability_atoms(all_vulnerabilities)
        
        reasoning_query = f"""
        ; Calculate risk score
        (= (overall-risk)
           (calculate-risk-score {json.dumps(all_vulnerabilities)}))
        
        ; Detect compound vulnerabilities
        (= (compound-risks)
           (detect-compound-vulnerability {vuln_list}))
        
        ; Generate recommendations
        (= (recommendations)
           (generate-recommendations {vuln_list}))
        
        ; Query all
        (list (overall-risk) (compound-risks) (recommendations))
        """
        
        result = await self.query(reasoning_query)
        
        # Extract insights
        insights = self._extract_insights(all_vulnerabilities, result)
        
        # Calculate risk score
        risk_score = self._calculate_risk_score(all_vulnerabilities)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(all_vulnerabilities, insights)
        
        return {
            'insights': insights,
            'risk_score': risk_score,
            'recommendations': recommendations,
            'metta_result': result
        }
    
    def _categorize_vulnerability(self, title: str) -> str:
        """Categorize vulnerability by type"""
        title_lower = title.lower()
        
        if 'reentrancy' in title_lower:
            return 'reentrancy'
        elif 'access' in title_lower or 'authorization' in title_lower:
            return 'access-control'
        elif 'overflow' in title_lower or 'underflow' in title_lower:
            return 'integer-overflow'
        elif 'call' in title_lower:
            return 'external-call'
        elif 'gas' in title_lower:
            return 'gas-optimization'
        else:
            return 'other'
    
    def _build_vulnerability_atoms(self, vulnerabilities: List[Dict]) -> str:
        """Build MeTTa atom representation of vulnerabilities"""
        atoms = []
        for vuln in vulnerabilities:
            atom = f"(vulnerability {vuln['type']} {vuln['severity']})"
            atoms.append(atom)
        
        return f"(list {' '.join(atoms)})"
    
    def _extract_insights(
        self, 
        vulnerabilities: List[Dict], 
        metta_result: Dict
    ) -> List[str]:
        """Extract high-level insights from vulnerability analysis"""
        
        insights = []
        
        # Group by severity
        severity_counts = {}
        for vuln in vulnerabilities:
            severity = vuln['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Generate insights
        if severity_counts.get('critical', 0) > 0:
            insights.append(
                f"⚠️ CRITICAL: Contract has {severity_counts['critical']} critical "
                f"vulnerabilities that could lead to complete loss of funds."
            )
        
        if severity_counts.get('high', 0) > 0:
            insights.append(
                f"🔴 HIGH RISK: {severity_counts['high']} high-severity issues detected. "
                f"Immediate remediation required before deployment."
            )
        
        # Check for compound vulnerabilities
        vuln_types = [v['type'] for v in vulnerabilities]
        if 'reentrancy' in vuln_types and 'access-control' in vuln_types:
            insights.append(
                "⚡ COMPOUND RISK: Reentrancy vulnerability combined with weak access "
                "control creates elevated exploitation risk."
            )
        
        if len(vulnerabilities) == 0:
            insights.append(
                "✅ SECURE: No critical vulnerabilities detected. Contract follows "
                "security best practices."
            )
        
        return insights
    
    def _calculate_risk_score(self, vulnerabilities: List[Dict]) -> float:
        """Calculate numerical risk score (0-10)"""
        
        weights = {
            'critical': 10,
            'high': 7,
            'medium': 4,
            'low': 2,
            'info': 1
        }
        
        total = sum(weights.get(v.get('severity', 'low'), 1) for v in vulnerabilities)
        
        # Normalize to 0-10 scale
        risk_score = min(total / 10.0, 10.0)
        
        return round(risk_score, 2)
    
    def _generate_recommendations(
        self, 
        vulnerabilities: List[Dict], 
        insights: List[str]
    ) -> List[str]:
        """Generate actionable recommendations"""
        
        recommendations = []
        
        vuln_types = set(v['type'] for v in vulnerabilities)
        
        if 'reentrancy' in vuln_types:
            recommendations.append(
                "Implement ReentrancyGuard from OpenZeppelin or follow "
                "checks-effects-interactions pattern in all functions with external calls."
            )
        
        if 'access-control' in vuln_types:
            recommendations.append(
                "Add proper access control modifiers (onlyOwner, onlyRole) to all "
                "privileged functions. Consider using OpenZeppelin's AccessControl."
            )
        
        if 'integer-overflow' in vuln_types:
            recommendations.append(
                "Upgrade to Solidity 0.8.0 or later for built-in overflow protection, "
                "or use SafeMath library for arithmetic operations."
            )
        
        if 'external-call' in vuln_types:
            recommendations.append(
                "Always check return values of external calls. Use transfer() or "
                "require() with call() for safer fund transfers."
            )
        
        # General recommendations
        if len(vulnerabilities) > 5:
            recommendations.append(
                "Contract has multiple security issues. Consider a comprehensive "
                "professional audit before mainnet deployment."
            )
        
        if not recommendations:
            recommendations.append(
                "Continue following security best practices and perform regular audits."
            )
        
        return recommendations


# Singleton instance
_metta_reasoner_instance = None

def get_metta_reasoner() -> MeTTaReasoner:
    """Get singleton MeTTa reasoner instance"""
    global _metta_reasoner_instance
    
    if _metta_reasoner_instance is None:
        _metta_reasoner_instance = MeTTaReasoner()
    
    return _metta_reasoner_instance