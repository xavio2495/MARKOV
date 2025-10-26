"""
Blockscout MCP Client
Version: 2.0.0
Updated: 2025-10-26 06:10:45 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Client for fetching verified contract source code via Blockscout MCP Server.
No API keys required - uses MCP protocol for direct access.
"""

import httpx
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv

load_dotenv()


# Network configurations for Blockscout MCP
NETWORK_CONFIGS = {
    'mainnet': {
        'name': 'Ethereum Mainnet',
        'mcp_endpoint': 'https://mcp.blockscout.com/eth-mainnet',
        'chain_id': 1,
    },
    'sepolia': {
        'name': 'Sepolia Testnet',
        'mcp_endpoint': 'https://mcp.blockscout.com/eth-sepolia',
        'chain_id': 11155111,
    },
    'polygon': {
        'name': 'Polygon',
        'mcp_endpoint': 'https://mcp.blockscout.com/polygon',
        'chain_id': 137,
    },
    'arbitrum': {
        'name': 'Arbitrum One',
        'mcp_endpoint': 'https://mcp.blockscout.com/arbitrum',
        'chain_id': 42161,
    },
    'optimism': {
        'name': 'Optimism',
        'mcp_endpoint': 'https://mcp.blockscout.com/optimism',
        'chain_id': 10,
    },
    'base': {
        'name': 'Base',
        'mcp_endpoint': 'https://mcp.blockscout.com/base',
        'chain_id': 8453,
    },
    'avalanche': {
        'name': 'Avalanche C-Chain',
        'mcp_endpoint': 'https://mcp.blockscout.com/avalanche',
        'chain_id': 43114,
    },
}


class BlockscoutMCPClient:
    """
    Client for Blockscout MCP Server
    
    Uses MCP (Model Context Protocol) for seamless blockchain data access
    without requiring separate API keys. MCP provides direct access to
    Blockscout REST API endpoints with built-in rate limiting and caching.
    """
    
    def __init__(self, mcp_server_url: Optional[str] = None):
        """
        Initialize Blockscout MCP client
        
        Args:
            mcp_server_url: Base URL for MCP server (optional)
        """
        self.mcp_server_url = mcp_server_url or os.getenv(
            'BLOCKSCOUT_MCP_SERVER',
            'https://mcp.blockscout.com'
        )
        
        self.client = httpx.AsyncClient(timeout=30.0)
        
        print(f"   ✓ Blockscout MCP Client initialized")
        print(f"      Server: {self.mcp_server_url}")
        print(f"      Networks: {len(NETWORK_CONFIGS)} supported")
    
    async def fetch_contract(
        self,
        address: str,
        network: str = 'mainnet'
    ) -> Dict[str, Any]:
        """
        Fetch verified contract source code via MCP
        
        Args:
            address: Contract address (0x...)
            network: Network name (mainnet, sepolia, polygon, etc.)
        
        Returns:
            Dictionary with contract data
        
        Raises:
            Exception: If contract not found or not verified
        """
        
        # Validate network
        if network not in NETWORK_CONFIGS:
            raise ValueError(
                f"Unsupported network: {network}. "
                f"Supported: {', '.join(NETWORK_CONFIGS.keys())}"
            )
        
        network_config = NETWORK_CONFIGS[network]
        
        # Build MCP request
        mcp_endpoint = f"{self.mcp_server_url}/contract/source"
        
        payload = {
            'address': address,
            'network': network,
            'chain_id': network_config['chain_id'],
        }
        
        try:
            # Call MCP server
            response = await self.client.post(
                mcp_endpoint,
                json=payload,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Markov-Audit-System/2.0.0'
                }
            )
            
            if response.status_code != 200:
                raise Exception(
                    f"MCP request failed: {response.status_code} - {response.text}"
                )
            
            data = response.json()
            
            # Parse response
            if not data.get('is_verified'):
                raise Exception(
                    f"Contract at {address} is not verified on {network_config['name']}"
                )
            
            # Extract source code (handle multi-file contracts)
            source_code = self._parse_source_code(data.get('source_code', ''))
            
            return {
                'name': data.get('name', 'Unknown'),
                'source_code': source_code,
                'compiler_version': data.get('compiler_version'),
                'optimization': data.get('optimization_used'),
                'optimization_runs': data.get('optimization_runs'),
                'abi': data.get('abi'),
                'constructor_arguments': data.get('constructor_arguments'),
                'is_proxy': data.get('is_proxy', False),
                'implementation': data.get('implementation_address'),
                'network': network_config['name'],
                'chain_id': network_config['chain_id'],
            }
            
        except httpx.RequestError as e:
            raise Exception(f"Network error fetching contract: {str(e)}")
        except Exception as e:
            raise Exception(f"Error fetching contract: {str(e)}")
    
    def _parse_source_code(self, source_code_data: Any) -> str:
        """
        Parse source code from various formats
        
        Handles:
        - Single file (string)
        - Multi-file (JSON object)
        - Standard JSON input
        """
        
        if isinstance(source_code_data, str):
            # Single file contract
            return source_code_data
        
        elif isinstance(source_code_data, dict):
            # Multi-file contract
            if 'sources' in source_code_data:
                # Standard JSON input format
                sources = source_code_data['sources']
                
                # Concatenate all files
                combined_source = ""
                for filepath, file_data in sources.items():
                    content = file_data.get('content', '')
                    combined_source += f"\n// File: {filepath}\n\n{content}\n\n"
                
                return combined_source
            
            else:
                # Direct file mapping
                combined_source = ""
                for filepath, content in source_code_data.items():
                    combined_source += f"\n// File: {filepath}\n\n{content}\n\n"
                
                return combined_source
        
        else:
            return str(source_code_data)
    
    async def get_contract_abi(
        self,
        address: str,
        network: str = 'mainnet'
    ) -> List[Dict]:
        """
        Get contract ABI
        
        Args:
            address: Contract address
            network: Network name
        
        Returns:
            Contract ABI as list of function definitions
        """
        
        contract_data = await self.fetch_contract(address, network)
        return contract_data.get('abi', [])
    
    async def check_if_proxy(
        self,
        address: str,
        network: str = 'mainnet'
    ) -> Dict[str, Any]:
        """
        Check if contract is a proxy and get implementation
        
        Args:
            address: Contract address
            network: Network name
        
        Returns:
            Dictionary with proxy information
        """
        
        contract_data = await self.fetch_contract(address, network)
        
        return {
            'is_proxy': contract_data.get('is_proxy', False),
            'implementation_address': contract_data.get('implementation'),
            'proxy_type': contract_data.get('proxy_type', 'unknown')
        }
    
    async def fetch_multiple_contracts(
        self,
        addresses: List[str],
        network: str = 'mainnet'
    ) -> List[Dict[str, Any]]:
        """
        Fetch multiple contracts in parallel
        
        Args:
            addresses: List of contract addresses
            network: Network name
        
        Returns:
            List of contract data dictionaries
        """
        
        import asyncio
        
        tasks = [
            self.fetch_contract(address, network)
            for address in addresses
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"   ✗ Failed to fetch {addresses[i]}: {result}")
            else:
                valid_results.append(result)
        
        return valid_results
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Singleton instance
_blockscout_client = None

def get_blockscout_client() -> BlockscoutMCPClient:
    """Get singleton Blockscout MCP client"""
    global _blockscout_client
    
    if _blockscout_client is None:
        _blockscout_client = BlockscoutMCPClient()
    
    return _blockscout_client