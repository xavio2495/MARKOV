"""
Contract Parser
Version: 2.0.0
Updated: 2025-10-26 06:10:45 UTC
Developer: charlesms-eth

Parses Solidity contracts to extract structure and patterns.
"""

import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class FunctionInfo:
    """Information about a function"""
    name: str
    visibility: str
    state_mutability: str
    modifiers: List[str]
    parameters: List[str]
    line_number: int


@dataclass
class StateVariableInfo:
    """Information about a state variable"""
    name: str
    type: str
    visibility: str
    is_constant: bool
    is_immutable: bool
    line_number: int


class ContractParser:
    """
    Parser for Solidity smart contracts
    
    Extracts:
    - Functions and their properties
    - State variables
    - Inheritance hierarchy
    - Events
    - Modifiers
    """
    
    def __init__(self):
        """Initialize contract parser"""
        pass
    
    def parse(self, source_code: str) -> Dict[str, Any]:
        """
        Parse Solidity contract source code
        
        Args:
            source_code: Solidity source code
        
        Returns:
            Dictionary with parsed contract structure
        """
        
        structure = {
            'pragma': self._extract_pragma(source_code),
            'imports': self._extract_imports(source_code),
            'contracts': self._extract_contracts(source_code),
            'functions': self._extract_functions(source_code),
            'state_variables': self._extract_state_variables(source_code),
            'events': self._extract_events(source_code),
            'modifiers': self._extract_modifiers(source_code),
            'inheritance': self._extract_inheritance(source_code),
        }
        
        return structure
    
    def _extract_pragma(self, source_code: str) -> str:
        """Extract pragma directive"""
        match = re.search(r'pragma solidity\s+([^;]+);', source_code)
        return match.group(1) if match else 'unknown'
    
    def _extract_imports(self, source_code: str) -> List[str]:
        """Extract import statements"""
        imports = re.findall(r'import\s+"([^"]+)"', source_code)
        return imports
    
    def _extract_contracts(self, source_code: str) -> List[str]:
        """Extract contract names"""
        contracts = re.findall(r'contract\s+(\w+)', source_code)
        return contracts
    
    def _extract_functions(self, source_code: str) -> List[FunctionInfo]:
        """Extract function information"""
        functions = []
        
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            func_match = re.search(
                r'function\s+(\w+)\s*\([^)]*\)\s*(public|private|internal|external)?\s*(view|pure|payable)?\s*(.*?)\s*\{?',
                line
            )
            
            if func_match:
                name = func_match.group(1)
                visibility = func_match.group(2) or 'public'
                state_mutability = func_match.group(3) or 'nonpayable'
                modifiers_str = func_match.group(4) or ''
                
                # Extract modifiers
                modifiers = [m.strip() for m in modifiers_str.split() if m.strip() and m != 'returns']
                
                functions.append(FunctionInfo(
                    name=name,
                    visibility=visibility,
                    state_mutability=state_mutability,
                    modifiers=modifiers,
                    parameters=[],
                    line_number=i + 1
                ))
        
        return functions
    
    def _extract_state_variables(self, source_code: str) -> List[StateVariableInfo]:
        """Extract state variable information"""
        variables = []
        
        lines = source_code.split('\n')
        in_contract = False
        
        for i, line in enumerate(lines):
            # Check if we're inside a contract
            if re.search(r'contract\s+\w+', line):
                in_contract = True
                continue
            
            if in_contract and re.search(r'^\s*}', line):
                in_contract = False
                continue
            
            if in_contract:
                # Match state variable declarations
                var_match = re.search(
                    r'^\s*(uint\d*|int\d*|bool|address|string|bytes\d*|mapping\s*\([^)]+\))\s+(public|private|internal)?\s+(constant|immutable)?\s*(\w+)',
                    line
                )
                
                if var_match:
                    var_type = var_match.group(1)
                    visibility = var_match.group(2) or 'internal'
                    modifier = var_match.group(3) or ''
                    name = var_match.group(4)
                    
                    variables.append(StateVariableInfo(
                        name=name,
                        type=var_type,
                        visibility=visibility,
                        is_constant='constant' in modifier,
                        is_immutable='immutable' in modifier,
                        line_number=i + 1
                    ))
        
        return variables
    
    def _extract_events(self, source_code: str) -> List[Dict[str, Any]]:
        """Extract event definitions"""
        events = []
        
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            event_match = re.search(r'event\s+(\w+)\s*\(([^)]*)\)', line)
            
            if event_match:
                name = event_match.group(1)
                params = event_match.group(2)
                
                events.append({
                    'name': name,
                    'parameters': params.strip(),
                    'line_number': i + 1
                })
        
        return events
    
    def _extract_modifiers(self, source_code: str) -> List[Dict[str, Any]]:
        """Extract modifier definitions"""
        modifiers = []
        
        lines = source_code.split('\n')
        
        for i, line in enumerate(lines):
            modifier_match = re.search(r'modifier\s+(\w+)', line)
            
            if modifier_match:
                name = modifier_match.group(1)
                
                modifiers.append({
                    'name': name,
                    'line_number': i + 1
                })
        
        return modifiers
    
    def _extract_inheritance(self, source_code: str) -> Dict[str, List[str]]:
        """Extract contract inheritance relationships"""
        inheritance = {}
        
        contract_matches = re.finditer(
            r'contract\s+(\w+)\s+is\s+([^{]+)\{',
            source_code
        )
        
        for match in contract_matches:
            contract_name = match.group(1)
            parents = [p.strip() for p in match.group(2).split(',')]
            inheritance[contract_name] = parents
        
        return inheritance