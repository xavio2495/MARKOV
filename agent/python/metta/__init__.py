"""
MeTTa Integration Package
Version: 2.0.0
Updated: 2025-10-26 06:01:44 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Provides reasoning capabilities for smart contract auditing using Hyperon MeTTa.
"""

__version__ = "2.0.0"
__author__ = "charlesms-eth"
__license__ = "MIT"

from .metta_integration import MeTTaReasoner, get_metta_reasoner
from .reasoning_engine import AdvancedReasoner, ReasoningContext

__all__ = [
    'MeTTaReasoner',
    'get_metta_reasoner',
    'AdvancedReasoner',
    'ReasoningContext'
]