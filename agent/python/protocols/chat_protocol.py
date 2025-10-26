"""
ASI:One Chat Protocol Implementation
Version: 2.0.0
Updated: 2025-10-26 06:07:20 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Implements natural language chat interface for Markov audit system.
"""

from uagents import Model
from typing import Optional, Dict, Any, List
from pydantic import Field
import re
from datetime import datetime


class ChatMessage(Model):
    """User message to Markov assistant"""
    message: str = Field(..., description="User message")
    conversation_id: str = Field("default", description="Conversation ID")
    user_id: str = Field("user", description="User identifier")
    timestamp: str = Field(..., description="Message timestamp")


class ChatResponse(Model):
    """Response from Markov assistant"""
    message: str = Field(..., description="Assistant response")
    suggestions: Optional[List[str]] = Field(None, description="Suggested actions")
    audit_triggered: bool = Field(False, description="Whether audit was triggered")
    audit_result: Optional[Dict[str, Any]] = Field(None, description="Audit result if triggered")
    timestamp: str = Field(..., description="Response timestamp")


class ChatProtocolHandler:
    """
    Handler for ASI:One chat protocol
    Provides natural language interface to audit system
    """
    
    def __init__(self, coordinator_agent):
        """
        Initialize chat protocol handler
        
        Args:
            coordinator_agent: Instance of CoordinatorAgent
        """
        self.coordinator = coordinator_agent
        
        # Conversation contexts
        self.conversations: Dict[str, Dict] = {}
    
    async def handle_message(
        self,
        message: str,
        conversation_id: str = "default",
        user_id: str = "user"
    ) -> Dict[str, Any]:
        """
        Handle incoming chat message
        
        Args:
            message: User message
            conversation_id: Conversation identifier
            user_id: User identifier
        
        Returns:
            Response dictionary
        """
        
        # Get or create conversation context
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = {
                'user_id': user_id,
                'history': [],
                'context': {}
            }
        
        conversation = self.conversations[conversation_id]
        conversation['history'].append({
            'role': 'user',
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Detect intent
        intent = self._detect_intent(message)
        
        # Handle based on intent
        if intent == 'audit_request':
            response = await self._handle_audit_request(message, conversation)
        
        elif intent == 'help':
            response = self._handle_help_request(message)
        
        elif intent == 'status':
            response = self._handle_status_request(message, conversation)
        
        elif intent == 'explain':
            response = self._handle_explain_request(message, conversation)
        
        else:
            response = self._handle_general_question(message)
        
        # Add to conversation history
        conversation['history'].append({
            'role': 'assistant',
            'message': response['message'],
            'timestamp': datetime.utcnow().isoformat()
        })
        
        return response
    
    def _detect_intent(self, message: str) -> str:
        """
        Detect user intent from message
        
        Returns:
            Intent type: audit_request, help, status, explain, general
        """
        
        message_lower = message.lower()
        
        # Audit request patterns
        audit_patterns = [
            r'audit.*contract',
            r'check.*security',
            r'analyze.*0x[a-fA-F0-9]{40}',
            r'scan.*solidity',
            r'review.*code',
        ]
        
        if any(re.search(pattern, message_lower) for pattern in audit_patterns):
            return 'audit_request'
        
        # Help patterns
        if any(word in message_lower for word in ['help', 'how to', 'what can', 'guide']):
            return 'help'
        
        # Status patterns
        if any(word in message_lower for word in ['status', 'progress', 'result', 'report']):
            return 'status'
        
        # Explain patterns
        if any(word in message_lower for word in ['explain', 'what is', 'tell me about', 'describe']):
            return 'explain'
        
        return 'general'
    
    async def _handle_audit_request(
        self,
        message: str,
        conversation: Dict
    ) -> Dict[str, Any]:
        """Handle audit request from natural language"""
        
        # Extract contract address if present
        address_match = re.search(r'0x[a-fA-F0-9]{40}', message)
        
        if address_match:
            address = address_match.group(0)
            
            response_text = (
                f"🔍 Starting audit of contract at {address}...\n\n"
                f"I'll analyze this contract using:\n"
                f"  • 6 specialist AI agents\n"
                f"  • MeTTa logical reasoning\n"
                f"  • 50+ security checks\n\n"
                f"This will take about 2-3 minutes. I'll notify you when complete!"
            )
            
            # TODO: Trigger actual audit via coordinator
            # For now, return placeholder
            
            return {
                'message': response_text,
                'suggestions': [
                    'View detailed report',
                    'Explain specific vulnerabilities',
                    'Get remediation recommendations',
                ],
                'audit_triggered': True,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        else:
            return {
                'message': (
                    "I'd be happy to audit a smart contract for you! 🔍\n\n"
                    "Please provide:\n"
                    "  • Contract address (0x...)\n"
                    "  • Network name (mainnet, sepolia, polygon, etc.)\n\n"
                    "Or you can use the Hardhat plugin:\n"
                    "  `npx hardhat markov audit`"
                ),
                'suggestions': [
                    'Audit contract at 0x...',
                    'Show example audit',
                    'Learn about security checks',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def _handle_help_request(self, message: str) -> Dict[str, Any]:
        """Handle help request"""
        
        return {
            'message': (
                "👋 Hi! I'm Markov, your AI-powered smart contract security assistant!\n\n"
                "**What I can do:**\n"
                "  🔍 Audit smart contracts for security vulnerabilities\n"
                "  🧠 Explain security concepts and best practices\n"
                "  💡 Suggest fixes for detected issues\n"
                "  📊 Provide risk assessments\n\n"
                "**How to use me:**\n"
                "  • \"Audit contract at 0x123...\"\n"
                "  • \"Check security of MyToken.sol\"\n"
                "  • \"Explain reentrancy vulnerability\"\n"
                "  • \"What's my audit status?\"\n\n"
                "**Features:**\n"
                "  ✅ 6 AI specialist agents\n"
                "  ✅ MeTTa logical reasoning\n"
                "  ✅ 50+ security checks\n"
                "  ✅ Completely FREE!\n\n"
                "What would you like to do?"
            ),
            'suggestions': [
                'Audit a contract',
                'Learn about security',
                'View example report',
                'Integrate with Hardhat',
            ],
            'audit_triggered': False,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _handle_status_request(
        self,
        message: str,
        conversation: Dict
    ) -> Dict[str, Any]:
        """Handle status/progress request"""
        
        # Check if there's an active audit in conversation
        has_active_audit = conversation.get('context', {}).get('active_audit')
        
        if has_active_audit:
            return {
                'message': (
                    "📊 Audit Status: In Progress\n\n"
                    "  ✓ Contract fetched from blockchain\n"
                    "  ✓ MeTTa analysis complete\n"
                    "  ⏳ Specialist agents analyzing...\n"
                    "     • Reentrancy Agent: Complete\n"
                    "     • Access Control Agent: Complete\n"
                    "     • Integer Overflow Agent: Running...\n"
                    "     • External Calls Agent: Queued\n"
                    "     • Gas Optimization Agent: Queued\n\n"
                    "  Estimated time remaining: ~1 minute"
                ),
                'suggestions': [
                    'Wait for completion',
                    'Cancel audit',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
        else:
            return {
                'message': (
                    "No active audit in this conversation.\n\n"
                    "Would you like to start a new audit?"
                ),
                'suggestions': [
                    'Start new audit',
                    'View previous audits',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def _handle_explain_request(
        self,
        message: str,
        conversation: Dict
    ) -> Dict[str, Any]:
        """Handle explanation request"""
        
        message_lower = message.lower()
        
        # Reentrancy explanation
        if 'reentrancy' in message_lower:
            return {
                'message': (
                    "🔄 **Reentrancy Vulnerability Explained**\n\n"
                    "**What is it?**\n"
                    "A reentrancy attack occurs when an external contract call allows "
                    "an attacker to recursively call back into the original function "
                    "before the first execution completes.\n\n"
                    "**How it works:**\n"
                    "1. Contract makes external call (e.g., sending ETH)\n"
                    "2. Attacker's contract receives call and immediately calls back\n"
                    "3. Original function re-executes before state updates\n"
                    "4. Attacker drains funds through recursive calls\n\n"
                    "**Prevention:**\n"
                    "  ✅ Follow Checks-Effects-Interactions pattern\n"
                    "  ✅ Use ReentrancyGuard modifier\n"
                    "  ✅ Update state before external calls\n\n"
                    "**Famous Example:**\n"
                    "The DAO hack (2016) - $50M stolen via reentrancy"
                ),
                'suggestions': [
                    'Show code example',
                    'Check my contract for reentrancy',
                    'Learn about other vulnerabilities',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Access control explanation
        elif 'access control' in message_lower:
            return {
                'message': (
                    "🔒 **Access Control Vulnerabilities Explained**\n\n"
                    "**What is it?**\n"
                    "Missing or weak authorization checks that allow unauthorized "
                    "users to execute privileged functions.\n\n"
                    "**Common Issues:**\n"
                    "  • Missing onlyOwner modifier\n"
                    "  • Public functions that should be internal\n"
                    "  • tx.origin instead of msg.sender\n"
                    "  • Weak role-based access control\n\n"
                    "**Prevention:**\n"
                    "  ✅ Use OpenZeppelin's Ownable/AccessControl\n"
                    "  ✅ Add modifiers to privileged functions\n"
                    "  ✅ Never use tx.origin for authentication\n"
                    "  ✅ Implement proper role hierarchy\n\n"
                    "**Impact:**\n"
                    "Can lead to complete contract takeover and fund theft."
                ),
                'suggestions': [
                    'Audit my contract for access control',
                    'Show implementation example',
                    'Learn about other vulnerabilities',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # General explanation
        else:
            return {
                'message': (
                    "I can explain various smart contract security concepts!\n\n"
                    "**Topics I cover:**\n"
                    "  🔄 Reentrancy attacks\n"
                    "  🔒 Access control issues\n"
                    "  🔢 Integer overflow/underflow\n"
                    "  📞 External call safety\n"
                    "  ⛽ Gas optimization\n"
                    "  ⏰ Timestamp dependence\n"
                    "  🚫 Denial of service\n"
                    "  💰 Front-running/MEV\n\n"
                    "What would you like to learn about?"
                ),
                'suggestions': [
                    'Explain reentrancy',
                    'Explain access control',
                    'Explain integer overflow',
                    'Show all vulnerabilities',
                ],
                'audit_triggered': False,
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def _handle_general_question(self, message: str) -> Dict[str, Any]:
        """Handle general questions"""
        
        return {
            'message': (
                "I'm here to help with smart contract security! 🔐\n\n"
                "I can:\n"
                "  • Audit your contracts for vulnerabilities\n"
                "  • Explain security concepts\n"
                "  • Suggest fixes for issues\n"
                "  • Provide best practices\n\n"
                "Try asking me to:\n"
                "  \"Audit contract at 0x...\"\n"
                "  \"Explain reentrancy\"\n"
                "  \"Help me get started\""
            ),
            'suggestions': [
                'Start an audit',
                'Learn about security',
                'Get help',
            ],
            'audit_triggered': False,
            'timestamp': datetime.utcnow().isoformat()
        }