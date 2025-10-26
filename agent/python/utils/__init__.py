"""
Utility Modules Package
Version: 2.0.0
Updated: 2025-10-26 06:10:45 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Utility modules for contract parsing, report generation, and blockchain interaction.
"""

__version__ = "2.0.0"
__author__ = "charlesms-eth"
__license__ = "MIT"

from .blockscout import BlockscoutMCPClient
from .contract_parser import ContractParser
from .report_generator import ReportGenerator

__all__ = [
    'BlockscoutMCPClient',
    'ContractParser',
    'ReportGenerator',
]