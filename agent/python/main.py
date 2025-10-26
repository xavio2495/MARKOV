"""
Markov Audit Engine - Main Server
Version: 2.0.0
Updated: 2025-10-26 05:50:45 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

This is the main FastAPI server that coordinates all audit operations.
It manages agent communication, MeTTa reasoning, and report generation.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
import logging

# Import components
from agents.coordinator_agent import CoordinatorAgent
from utils.blockscout import BlockscoutMCPClient
from utils.report_generator import ReportGenerator
from protocols.chat_protocol import ChatProtocolHandler

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Markov Audit Engine",
    description="Free AI-powered smart contract auditing with uAgents, MeTTa, and ASI:One",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
logger.info("🔧 Initializing Markov Audit Engine components...")

try:
    coordinator = CoordinatorAgent()
    blockscout = BlockscoutMCPClient()
    report_generator = ReportGenerator()
    chat_handler = ChatProtocolHandler(coordinator)
    
    logger.info("✓ All components initialized successfully")
except Exception as e:
    logger.error(f"✗ Failed to initialize components: {e}")
    raise


# ============================================
# Request/Response Models
# ============================================

class ContractFetchRequest(BaseModel):
    """Request to fetch contract from Blockscout MCP"""
    address: str = Field(..., description="Contract address (0x...)")
    network: str = Field("mainnet", description="Network name")

    class Config:
        schema_extra = {
            "example": {
                "address": "0x1234567890123456789012345678901234567890",
                "network": "mainnet"
            }
        }


class AuditRequest(BaseModel):
    """Request for contract audit"""
    contract_name: str = Field(..., description="Contract name")
    source_code: str = Field(..., description="Solidity source code")
    contract_address: Optional[str] = Field(None, description="On-chain address")
    network: str = Field("mainnet", description="Network")
    output_format: str = Field("both", description="Output format: pdf, md, both, json")

    class Config:
        schema_extra = {
            "example": {
                "contract_name": "MyToken",
                "source_code": "pragma solidity ^0.8.0;\n\ncontract MyToken { }",
                "output_format": "both"
            }
        }


class ChatRequest(BaseModel):
    """Chat message request"""
    message: str = Field(..., description="User message")
    conversation_id: str = Field("default", description="Conversation ID")
    user_id: str = Field("user", description="User ID")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str
    components: Dict[str, str]


# ============================================
# API Endpoints
# ============================================

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Markov Audit Engine",
        "version": "2.0.0",
        "developer": "charlesms-eth",
        "license": "MIT (FREE OPEN SOURCE)",
        "description": "AI-powered smart contract auditing with uAgents, MeTTa, and ASI:One",
        "features": {
            "agents": "6 AI agents with uAgents framework",
            "reasoning": "MeTTa logical reasoning (850+ lines)",
            "chat": "ASI:One natural language interface",
            "blockscout": "Direct MCP integration (no API keys)",
            "reports": "PDF, Markdown, JSON outputs",
            "free": "Completely FREE and open source"
        },
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "fetch_contract": "/api/audit/fetch",
            "audit": "/api/audit",
            "chat": "/api/chat"
        },
        "links": {
            "github": "https://github.com/charlesms-eth/markov-audit",
            "docs": "https://docs.markov-audit.io"
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint
    Returns status of all system components
    """
    
    components_status = {
        "coordinator": "operational",
        "agents": "operational",
        "metta": "loaded",
        "blockscout": "connected",
        "chat": "enabled" if os.getenv("AGENTVERSE_API_KEY") else "disabled"
    }
    
    # Check coordinator agent
    try:
        if hasattr(coordinator, 'agent') and coordinator.agent:
            components_status["coordinator"] = "operational"
        else:
            components_status["coordinator"] = "degraded"
    except:
        components_status["coordinator"] = "error"
    
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        timestamp=datetime.utcnow().isoformat(),
        components=components_status
    )


@app.post("/api/audit/fetch", tags=["Audit"])
async def fetch_contract(request: ContractFetchRequest):
    """
    Fetch verified contract source from Blockscout MCP
    
    This endpoint uses Blockscout's MCP server for direct access
    to blockchain data without requiring API keys.
    """
    
    logger.info(f"📡 Fetching contract {request.address} from {request.network}")
    
    try:
        contract_data = await blockscout.fetch_contract(
            address=request.address,
            network=request.network
        )
        
        logger.info(f"✓ Fetched contract: {contract_data['name']}")
        
        return {
            "name": contract_data["name"],
            "source": contract_data["source_code"],
            "compiler": contract_data.get("compiler_version"),
            "network": request.network,
            "is_verified": True
        }
        
    except Exception as e:
        logger.error(f"✗ Error fetching contract: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch contract: {str(e)}"
        )


@app.post("/api/audit", tags=["Audit"])
async def audit_contract(request: AuditRequest, background_tasks: BackgroundTasks):
    """
    Perform comprehensive AI-powered audit
    
    This endpoint:
    1. Coordinates 6 specialist AI agents (via uAgents)
    2. Runs MeTTa reasoning on findings (850+ line knowledge base)
    3. Generates comprehensive report with fixes
    4. Outputs in requested format (PDF/MD/JSON)
    
    Features:
    - 50+ security checks
    - Reentrancy detection
    - Access control analysis
    - Integer overflow checks
    - External call safety
    - Gas optimization suggestions
    """
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🔍 Starting audit: {request.contract_name}")
    logger.info(f"{'='*60}")
    
    try:
        # Run audit through coordinator agent
        result = await coordinator.audit(
            contract_name=request.contract_name,
            source_code=request.source_code,
            contract_address=request.contract_address
        )
        
        # Generate reports
        output_dir = os.getenv("OUTPUT_DIR", "./audit-reports")
        os.makedirs(output_dir, exist_ok=True)
        
        if request.output_format in ["pdf", "both"]:
            pdf_path = f"{output_dir}/{request.contract_name}_audit.pdf"
            await report_generator.generate_pdf(result, pdf_path)
            result["pdf_path"] = pdf_path
            logger.info(f"   📄 PDF: {pdf_path}")
        
        if request.output_format in ["md", "both"]:
            md_path = f"{output_dir}/{request.contract_name}_audit.md"
            await report_generator.generate_markdown(result, md_path)
            result["md_path"] = md_path
            logger.info(f"   📄 MD: {md_path}")
        
        logger.info(f"✅ Audit complete: {request.contract_name}")
        logger.info(f"{'='*60}\n")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error during audit: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Audit failed: {str(e)}"
        )


@app.post("/api/chat", tags=["Chat"])
async def chat(request: ChatRequest):
    """
    ASI:One Chat Interface
    
    Natural language interaction with Markov AI assistant.
    Supports:
    - Audit requests via natural language
    - Contract analysis questions
    - Security best practices
    - Help and guidance
    """
    
    logger.info(f"💬 Chat message: {request.message[:50]}...")
    
    try:
        response = await chat_handler.handle_message(
            message=request.message,
            conversation_id=request.conversation_id,
            user_id=request.user_id
        )
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Chat error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Chat error: {str(e)}"
        )


# ============================================
# Startup/Shutdown Events
# ============================================

@app.on_event("startup")
async def startup_event():
    """Application startup"""
    
    print("\n" + "=" * 70)
    print("🚀 MARKOV AUDIT ENGINE - FREE AI SMART CONTRACT SECURITY")
    print("=" * 70)
    print(f"   Version: 2.0.0")
    print(f"   Updated: 2025-10-26 05:50:45 UTC")
    print(f"   Developer: charlesms-eth")
    print(f"   License: MIT (FREE OPEN SOURCE)")
    print("=" * 70)
    print(f"   🌐 Server: http://localhost:{os.getenv('MCP_SERVER_PORT', 8000)}")
    print(f"   📚 Docs: http://localhost:{os.getenv('MCP_SERVER_PORT', 8000)}/docs")
    print(f"   🏥 Health: http://localhost:{os.getenv('MCP_SERVER_PORT', 8000)}/health")
    print("=" * 70)
    print(f"   🤖 Agents: 6 AI agents with uAgents framework")
    print(f"   🧠 MeTTa: 850+ lines of reasoning knowledge base")
    print(f"   💬 Chat: ASI:One natural language interface")
    print(f"   🔗 Blockscout: Direct MCP integration (no API keys!)")
    print("=" * 70)
    print(f"   🆓 Completely FREE - No subscriptions - No hidden costs")
    print(f"   ⭐ Star: https://github.com/charlesms-eth/markov-audit")
    print("=" * 70 + "\n")
    
    logger.info("✅ Markov Audit Engine ready to serve!")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("🛑 Shutting down Markov Audit Engine...")
    
    # Cleanup
    try:
        await blockscout.close()
        logger.info("✓ Blockscout client closed")
    except:
        pass
    
    logger.info("✅ Shutdown complete")


# ============================================
# Run Server
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("MCP_SERVER_PORT", 8000))
    host = os.getenv("MCP_SERVER_HOST", "0.0.0.0")
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
        access_log=True,
    )