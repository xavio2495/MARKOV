"""
Markov Audit System - Agent Package
Version: 2.0.0
Updated: 2025-10-26 05:56:13 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

This package contains all specialist agents built with Fetch.ai uAgents framework.
Each agent performs specialized security analysis using MeTTa reasoning.
"""

__version__ = "2.0.0"
__author__ = "charlesms-eth"
__license__ = "MIT"

from .coordinator_agent import CoordinatorAgent
from .reentrancy_agent import ReentrancyAgent
from .access_control_agent import AccessControlAgent
from .integer_overflow_agent import IntegerOverflowAgent
from .external_calls_agent import ExternalCallsAgent
from .gas_optimization_agent import GasOptimizationAgent

__all__ = [
    "CoordinatorAgent",
    "ReentrancyAgent",
    "AccessControlAgent",
    "IntegerOverflowAgent",
    "ExternalCallsAgent",
    "GasOptimizationAgent",
]