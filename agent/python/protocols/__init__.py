"""
Protocol Messages Package
Version: 2.0.0
Updated: 2025-10-26 06:07:20 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Defines message protocols for agent communication using uAgents framework.
"""

__version__ = "2.0.0"
__author__ = "charlesms-eth"
__license__ = "MIT"

from .messages import (
    AuditRequest,
    AuditResponse,
    AgentTaskRequest,
    AgentTaskResponse,
    HealthCheck,
    HealthCheckResponse,
)

from .chat_protocol import (
    ChatMessage,
    ChatResponse,
    ChatProtocolHandler,
)

__all__ = [
    'AuditRequest',
    'AuditResponse',
    'AgentTaskRequest',
    'AgentTaskResponse',
    'HealthCheck',
    'HealthCheckResponse',
    'ChatMessage',
    'ChatResponse',
    'ChatProtocolHandler',
]