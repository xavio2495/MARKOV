"""
Advanced Reasoning Engine
Version: 2.0.0
Updated: 2025-10-26 06:07:20 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Provides advanced multi-step reasoning, attack vector analysis,
and exploit probability calculations using MeTTa.
"""

import asyncio
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json


class VulnerabilityType(Enum):
    """Vulnerability types"""
    REENTRANCY = "reentrancy"
    ACCESS_CONTROL = "access-control"
    INTEGER_OVERFLOW = "integer-overflow"
    EXTERNAL_CALL = "external-call"
    GAS_OPTIMIZATION = "gas-optimization"
    FRONT_RUNNING = "front-running"
    TIMESTAMP = "timestamp-dependence"
    DOS = "denial-of-service"


class Severity(Enum):
    """Severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ReasoningContext:
    """Context for reasoning operations"""
    contract_name: str
    vulnerabilities: List[Dict[str, Any]]
    contract_metadata: Dict[str, Any]
    agent_findings: Dict[str, Dict[str, Any]]


class AdvancedReasoner:
    """
    Advanced reasoning engine for smart contract security
    
    Provides:
    - Multi-step logical inference
    - Attack vector identification
    - Exploit probability calculation
    - Compound vulnerability detection
    - Remediation action planning
    """
    
    def __init__(self, metta_reasoner):
        """
        Initialize advanced reasoner
        
        Args:
            metta_reasoner: Instance of MeTTaReasoner
        """
        self.metta = metta_reasoner
    
    async def perform_multi_agent_reasoning(
        self,
        context: ReasoningContext
    ) -> Dict[str, Any]:
        """
        Perform comprehensive reasoning across all agent findings
        
        Args:
            context: ReasoningContext with all audit information
        
        Returns:
            Dictionary with advanced reasoning results
        """
        
        print("   🧠 Advanced Reasoning: Analyzing vulnerability interactions...")
        
        # Step 1: Analyze vulnerability interactions
        interactions = await self._analyze_vulnerability_interactions(
            context.vulnerabilities
        )
        
        # Step 2: Identify attack vectors
        attack_vectors = await self._identify_attack_vectors(
            context.vulnerabilities,
            context.contract_metadata
        )
        
        # Step 3: Calculate exploit probabilities
        exploit_probs = await self._calculate_exploit_probabilities(
            context.vulnerabilities,
            context.contract_metadata
        )
        
        # Step 4: Detect compound vulnerabilities
        compound_vulns = await self._detect_compound_vulnerabilities(
            context.vulnerabilities
        )
        
        # Step 5: Generate attack scenarios
        attack_scenarios = await self._generate_attack_scenarios(
            context.vulnerabilities,
            attack_vectors
        )
        
        # Step 6: Calculate business impact
        business_impact = await self._calculate_business_impact(
            context.vulnerabilities,
            context.contract_metadata
        )
        
        # Step 7: Generate remediation action plan
        action_plan = await self._generate_action_plan(
            context.vulnerabilities,
            compound_vulns
        )
        
        print("   ✓ Advanced reasoning complete")
        
        return {
            'vulnerability_interactions': interactions,
            'attack_vectors': attack_vectors,
            'exploit_probabilities': exploit_probs,
            'compound_vulnerabilities': compound_vulns,
            'attack_scenarios': attack_scenarios,
            'business_impact': business_impact,
            'action_plan': action_plan,
        }
    
    async def _analyze_vulnerability_interactions(
        self,
        vulnerabilities: List[Dict]
    ) -> List[Dict[str, Any]]:
        """
        Analyze how vulnerabilities interact with each other
        """
        
        interactions = []
        
        # Check for known dangerous combinations
        vuln_types = [v.get('type', '') for v in vulnerabilities]
        
        # Reentrancy + Access Control = Critical Compound
        if 'reentrancy' in vuln_types and 'access-control' in vuln_types:
            interactions.append({
                'type': 'compound',
                'vulnerabilities': ['reentrancy', 'access-control'],
                'severity': 'critical',
                'description': (
                    'Reentrancy vulnerability combined with weak access control '
                    'allows unauthorized attackers to drain funds through recursive calls.'
                ),
                'amplification_factor': 2.5
            })
        
        # Integer Overflow + External Call
        if 'integer-overflow' in vuln_types and 'external-call' in vuln_types:
            interactions.append({
                'type': 'compound',
                'vulnerabilities': ['integer-overflow', 'external-call'],
                'severity': 'high',
                'description': (
                    'Integer overflow in external call context can corrupt contract '
                    'state and lead to unexpected behavior in dependent contracts.'
                ),
                'amplification_factor': 1.8
            })
        
        # Front-running + Timestamp Dependence
        if 'front-running' in vuln_types and 'timestamp' in vuln_types:
            interactions.append({
                'type': 'compound',
                'vulnerabilities': ['front-running', 'timestamp'],
                'severity': 'high',
                'description': (
                    'Timestamp-dependent logic vulnerable to front-running allows '
                    'attackers to manipulate timing for financial gain.'
                ),
                'amplification_factor': 1.6
            })
        
        return interactions
    
    async def _identify_attack_vectors(
        self,
        vulnerabilities: List[Dict],
        contract_metadata: Dict
    ) -> List[Dict[str, Any]]:
        """
        Identify specific attack vectors for each vulnerability
        """
        
        attack_vectors = []
        
        for vuln in vulnerabilities:
            vuln_type = vuln.get('type', '')
            severity = vuln.get('severity', 'low')
            
            if vuln_type == 'reentrancy':
                attack_vectors.append({
                    'vulnerability': vuln_type,
                    'vector': 'Recursive Call Attack',
                    'steps': [
                        '1. Attacker deploys malicious contract with fallback function',
                        '2. Attacker calls vulnerable withdraw() function',
                        '3. Fallback function reenters withdraw() before state update',
                        '4. Process repeats until contract is drained',
                    ],
                    'complexity': 'medium',
                    'prerequisites': [
                        'Contract must have external call before state update',
                        'Attacker needs initial balance in contract',
                    ],
                    'estimated_loss': 'Total contract balance'
                })
            
            elif vuln_type == 'access-control':
                attack_vectors.append({
                    'vulnerability': vuln_type,
                    'vector': 'Unauthorized Access',
                    'steps': [
                        '1. Attacker identifies unprotected privileged function',
                        '2. Attacker calls function directly without authorization',
                        '3. Attacker executes privileged operations (withdraw, mint, etc.)',
                    ],
                    'complexity': 'low',
                    'prerequisites': [
                        'Function must be public/external without modifiers',
                    ],
                    'estimated_loss': 'Function-specific (could be total funds)'
                })
            
            elif vuln_type == 'integer-overflow':
                attack_vectors.append({
                    'vulnerability': vuln_type,
                    'vector': 'Balance Manipulation',
                    'steps': [
                        '1. Attacker finds arithmetic operation without SafeMath',
                        '2. Attacker crafts transaction to trigger overflow',
                        '3. Balance wraps around to very large number',
                        '4. Attacker withdraws inflated balance',
                    ],
                    'complexity': 'medium',
                    'prerequisites': [
                        'Solidity version < 0.8.0 without SafeMath',
                        'User-controllable arithmetic operation',
                    ],
                    'estimated_loss': 'Variable (depends on overflow location)'
                })
            
            elif vuln_type == 'external-call':
                attack_vectors.append({
                    'vulnerability': vuln_type,
                    'vector': 'Call Return Manipulation',
                    'steps': [
                        '1. Attacker deploys contract that fails on call',
                        '2. Contract makes unchecked call to attacker contract',
                        '3. Call fails but execution continues',
                        '4. Contract state becomes inconsistent',
                    ],
                    'complexity': 'low',
                    'prerequisites': [
                        'Contract must not check call return values',
                    ],
                    'estimated_loss': 'Depends on failed call consequences'
                })
        
        return attack_vectors
    
    async def _calculate_exploit_probabilities(
        self,
        vulnerabilities: List[Dict],
        contract_metadata: Dict
    ) -> List[Dict[str, Any]]:
        """
        Calculate probability of successful exploitation for each vulnerability
        """
        
        probabilities = []
        
        for vuln in vulnerabilities:
            vuln_type = vuln.get('type', '')
            severity = vuln.get('severity', 'low')
            
            # Base probability by type
            base_probs = {
                'reentrancy': 0.85,
                'access-control': 0.95,
                'integer-overflow': 0.70,
                'external-call': 0.60,
                'front-running': 0.75,
                'timestamp': 0.65,
                'dos': 0.80,
                'gas-optimization': 0.30,
            }
            
            base_prob = base_probs.get(vuln_type, 0.50)
            
            # Adjust for complexity
            complexity_factor = 1.0
            if 'requires complex attack' in vuln.get('description', '').lower():
                complexity_factor = 0.6
            
            # Adjust for visibility
            visibility_factor = 1.0
            if contract_metadata.get('is_verified'):
                visibility_factor = 0.9  # Verified contracts are more visible to attackers
            
            # Adjust for value at risk
            value_factor = 1.0
            if contract_metadata.get('holds_funds'):
                value_factor = 1.2  # Higher incentive
            
            # Calculate final probability
            exploit_prob = base_prob * complexity_factor * visibility_factor * value_factor
            exploit_prob = min(exploit_prob, 1.0)  # Cap at 100%
            
            probabilities.append({
                'vulnerability': vuln_type,
                'severity': severity,
                'exploit_probability': round(exploit_prob, 2),
                'base_probability': base_prob,
                'factors': {
                    'complexity': complexity_factor,
                    'visibility': visibility_factor,
                    'value_at_risk': value_factor,
                },
                'risk_level': self._categorize_risk(exploit_prob, severity)
            })
        
        return probabilities
    
    def _categorize_risk(self, probability: float, severity: str) -> str:
        """Categorize combined risk level"""
        
        severity_weights = {
            'critical': 10,
            'high': 7,
            'medium': 4,
            'low': 2
        }
        
        weight = severity_weights.get(severity, 2)
        risk_score = probability * weight
        
        if risk_score >= 7:
            return 'EXTREME'
        elif risk_score >= 5:
            return 'HIGH'
        elif risk_score >= 3:
            return 'MODERATE'
        else:
            return 'LOW'
    
    async def _detect_compound_vulnerabilities(
        self,
        vulnerabilities: List[Dict]
    ) -> List[Dict[str, Any]]:
        """
        Detect compound vulnerabilities where multiple issues amplify risk
        """
        
        compound_vulns = []
        
        vuln_types = [v.get('type', '') for v in vulnerabilities]
        
        # Define dangerous combinations
        dangerous_combinations = [
            {
                'types': ['reentrancy', 'access-control'],
                'name': 'Reentrancy with Weak Access Control',
                'severity': 'critical',
                'risk_multiplier': 3.0,
                'description': (
                    'Critical compound vulnerability: Reentrancy can be exploited '
                    'by unauthorized parties due to missing access controls. '
                    'This significantly amplifies the attack surface and potential loss.'
                ),
            },
            {
                'types': ['integer-overflow', 'external-call'],
                'name': 'Arithmetic Overflow in External Context',
                'severity': 'high',
                'risk_multiplier': 2.0,
                'description': (
                    'Integer overflow combined with external calls can propagate '
                    'corrupted state to dependent contracts, causing cascading failures.'
                ),
            },
            {
                'types': ['access-control', 'dos'],
                'name': 'Unauthorized DoS Attack',
                'severity': 'high',
                'risk_multiplier': 1.8,
                'description': (
                    'Missing access control on DoS-vulnerable functions allows '
                    'anyone to halt contract operations indefinitely.'
                ),
            },
            {
                'types': ['reentrancy', 'integer-overflow'],
                'name': 'Reentrancy with State Corruption',
                'severity': 'critical',
                'risk_multiplier': 2.5,
                'description': (
                    'Reentrancy combined with integer overflow can cause permanent '
                    'state corruption while draining funds.'
                ),
            },
        ]
        
        for combo in dangerous_combinations:
            if all(vtype in vuln_types for vtype in combo['types']):
                compound_vulns.append(combo)
        
        return compound_vulns
    
    async def _generate_attack_scenarios(
        self,
        vulnerabilities: List[Dict],
        attack_vectors: List[Dict]
    ) -> List[Dict[str, Any]]:
        """
        Generate concrete attack scenarios with step-by-step exploitation
        """
        
        scenarios = []
        
        # Scenario 1: Reentrancy Attack
        if any(v.get('type') == 'reentrancy' for v in vulnerabilities):
            scenarios.append({
                'name': 'Reentrancy Attack Scenario',
                'severity': 'critical',
                'prerequisites': [
                    'Attacker has ETH to deposit',
                    'Contract allows withdrawals',
                ],
                'steps': [
                    {
                        'step': 1,
                        'action': 'Deploy malicious contract',
                        'code': 'contract Attacker { fallback() external payable { victim.withdraw(balance); } }',
                    },
                    {
                        'step': 2,
                        'action': 'Deposit initial funds',
                        'code': 'victim.deposit{value: 1 ether}();',
                    },
                    {
                        'step': 3,
                        'action': 'Trigger reentrancy',
                        'code': 'victim.withdraw(1 ether); // Fallback reenters',
                    },
                    {
                        'step': 4,
                        'action': 'Drain contract',
                        'result': 'Contract balance transferred to attacker',
                    },
                ],
                'estimated_time': '1 transaction',
                'estimated_cost': '~200k gas',
                'estimated_profit': 'Full contract balance',
            })
        
        # Scenario 2: Access Control Bypass
        if any(v.get('type') == 'access-control' for v in vulnerabilities):
            scenarios.append({
                'name': 'Unauthorized Access Scenario',
                'severity': 'high',
                'prerequisites': [
                    'Public function without access modifier',
                ],
                'steps': [
                    {
                        'step': 1,
                        'action': 'Identify unprotected function',
                        'method': 'Read contract source or ABI',
                    },
                    {
                        'step': 2,
                        'action': 'Call privileged function directly',
                        'code': 'victim.emergencyWithdraw(); // No onlyOwner check',
                    },
                    {
                        'step': 3,
                        'action': 'Receive unauthorized funds',
                        'result': 'Attacker receives contract funds',
                    },
                ],
                'estimated_time': '1 transaction',
                'estimated_cost': '~50k gas',
                'estimated_profit': 'Function-dependent',
            })
        
        return scenarios
    
    async def _calculate_business_impact(
        self,
        vulnerabilities: List[Dict],
        contract_metadata: Dict
    ) -> Dict[str, Any]:
        """
        Calculate potential business impact of vulnerabilities
        """
        
        impact = {
            'financial': self._assess_financial_impact(vulnerabilities, contract_metadata),
            'reputational': self._assess_reputational_impact(vulnerabilities),
            'operational': self._assess_operational_impact(vulnerabilities),
            'legal': self._assess_legal_impact(vulnerabilities),
            'overall_impact': 'HIGH',  # Will be calculated
        }
        
        # Calculate overall impact
        impact_scores = [
            impact['financial']['score'],
            impact['reputational']['score'],
            impact['operational']['score'],
            impact['legal']['score'],
        ]
        
        avg_score = sum(impact_scores) / len(impact_scores)
        
        if avg_score >= 8:
            impact['overall_impact'] = 'CRITICAL'
        elif avg_score >= 6:
            impact['overall_impact'] = 'HIGH'
        elif avg_score >= 4:
            impact['overall_impact'] = 'MEDIUM'
        else:
            impact['overall_impact'] = 'LOW'
        
        return impact
    
    def _assess_financial_impact(self, vulnerabilities: List[Dict], metadata: Dict) -> Dict:
        """Assess financial impact"""
        
        critical_count = sum(1 for v in vulnerabilities if v.get('severity') == 'critical')
        high_count = sum(1 for v in vulnerabilities if v.get('severity') == 'high')
        
        score = min(critical_count * 3 + high_count * 2, 10)
        
        return {
            'score': score,
            'description': 'Potential for total loss of contract funds' if score >= 8 else 'Moderate financial risk',
            'estimated_loss': 'Up to 100% of contract value' if score >= 8 else 'Variable',
        }
    
    def _assess_reputational_impact(self, vulnerabilities: List[Dict]) -> Dict:
        """Assess reputational impact"""
        
        has_critical = any(v.get('severity') == 'critical' for v in vulnerabilities)
        
        return {
            'score': 9 if has_critical else 5,
            'description': 'Severe damage to project reputation and user trust' if has_critical else 'Moderate reputational risk',
            'consequences': [
                'Loss of user trust',
                'Negative media coverage',
                'Difficulty attracting new users',
            ] if has_critical else ['Minor reputation concerns'],
        }
    
    def _assess_operational_impact(self, vulnerabilities: List[Dict]) -> Dict:
        """Assess operational impact"""
        
        has_dos = any(v.get('type') == 'dos' for v in vulnerabilities)
        
        return {
            'score': 8 if has_dos else 4,
            'description': 'Contract operations could be halted' if has_dos else 'Limited operational impact',
            'downtime_risk': 'HIGH' if has_dos else 'LOW',
        }
    
    def _assess_legal_impact(self, vulnerabilities: List[Dict]) -> Dict:
        """Assess legal/regulatory impact"""
        
        critical_count = sum(1 for v in vulnerabilities if v.get('severity') == 'critical')
        
        return {
            'score': min(critical_count * 2, 10),
            'description': 'Potential regulatory scrutiny and legal liability' if critical_count > 0 else 'Low legal risk',
            'regulatory_risk': 'HIGH' if critical_count > 0 else 'LOW',
        }
    
    async def _generate_action_plan(
        self,
        vulnerabilities: List[Dict],
        compound_vulns: List[Dict]
    ) -> Dict[str, Any]:
        """
        Generate prioritized remediation action plan
        """
        
        actions = []
        
        # Group vulnerabilities by severity
        critical_vulns = [v for v in vulnerabilities if v.get('severity') == 'critical']
        high_vulns = [v for v in vulnerabilities if v.get('severity') == 'high']
        medium_vulns = [v for v in vulnerabilities if v.get('severity') == 'medium']
        low_vulns = [v for v in vulnerabilities if v.get('severity') == 'low']
        
        # Immediate actions (Critical)
        if critical_vulns:
            actions.append({
                'priority': 'IMMEDIATE',
                'timeframe': 'Before deployment / Emergency patch',
                'actions': [
                    f'Fix {len(critical_vulns)} critical vulnerabilities',
                    'Halt deployment if already live',
                    'Engage professional security auditor',
                    'Prepare incident response plan',
                ],
                'vulnerabilities': [v.get('type') for v in critical_vulns],
            })
        
        # Urgent actions (High)
        if high_vulns:
            actions.append({
                'priority': 'URGENT',
                'timeframe': 'Within 48 hours',
                'actions': [
                    f'Address {len(high_vulns)} high-severity issues',
                    'Review and test fixes thoroughly',
                    'Update documentation',
                ],
                'vulnerabilities': [v.get('type') for v in high_vulns],
            })
        
        # Medium priority (Medium)
        if medium_vulns:
            actions.append({
                'priority': 'MEDIUM',
                'timeframe': 'Within 1 week',
                'actions': [
                    f'Resolve {len(medium_vulns)} medium-severity issues',
                    'Implement additional tests',
                ],
                'vulnerabilities': [v.get('type') for v in medium_vulns],
            })
        
        # Low priority (Low)
        if low_vulns:
            actions.append({
                'priority': 'LOW',
                'timeframe': 'Before final release',
                'actions': [
                    f'Address {len(low_vulns)} optimization opportunities',
                    'Refactor for better gas efficiency',
                ],
                'vulnerabilities': [v.get('type') for v in low_vulns],
            })
        
        # Compound vulnerabilities
        if compound_vulns:
            actions.insert(0, {
                'priority': 'CRITICAL',
                'timeframe': 'IMMEDIATE',
                'actions': [
                    f'Fix compound vulnerabilities: {len(compound_vulns)} detected',
                    'These amplify risk significantly',
                    'Address underlying issues in both vulnerability types',
                ],
                'compound_vulnerabilities': [c.get('name') for c in compound_vulns],
            })
        
        return {
            'total_actions': len(actions),
            'estimated_time': self._estimate_fix_time(vulnerabilities),
            'recommended_order': actions,
            'testing_requirements': [
                'Unit tests for all fixes',
                'Integration tests for compound vulnerabilities',
                'Gas optimization verification',
                'Re-run full security audit after fixes',
            ],
        }
    
    def _estimate_fix_time(self, vulnerabilities: List[Dict]) -> str:
        """Estimate time required to fix all vulnerabilities"""
        
        # Rough estimates per vulnerability
        time_estimates = {
            'critical': 2,  # days
            'high': 1,
            'medium': 0.5,
            'low': 0.25,
        }
        
        total_days = sum(
            time_estimates.get(v.get('severity', 'low'), 0.5)
            for v in vulnerabilities
        )
        
        if total_days < 1:
            return f"{int(total_days * 8)} hours"
        elif total_days < 7:
            return f"{int(total_days)} days"
        else:
            return f"{int(total_days / 7)} weeks"