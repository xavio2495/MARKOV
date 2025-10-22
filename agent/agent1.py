import json
import subprocess
import requests
from datetime import datetime
from uuid import uuid4
from openai import OpenAI
from uagents import Agent, Context, Model, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)
from hyperon import MeTTa
import motto  # from metta-motto

# ASI:One setup
ASI_API_KEY = '<YOUR_ASI_ONE_API_KEY>'  # Replace with your key
client = OpenAI(
    base_url='https://api.asi1.ai/v1',
    api_key=ASI_API_KEY,
)

# MCP server URL (hosted or local: 'http://localhost:8000/mcp' if running locally)
MCP_URL = 'https://mcp.blockscout.com/mcp'

# MeTTa setup for knowledge graph
metta = MeTTa()
# Load initial knowledge (example: add vuln rules)
metta.run('''
!(add-atom &self (vuln reentrancy (description "External calls before state update") (impact "High: Potential fund loss") (mitigation "Use checks-effects-interactions pattern")))
!(add-atom &self (opt packing (description "Pack variables to save storage slots") (impact "Medium: Gas savings") (mitigation "Reorder variables by size")))
''')

# Agent setup with Agentverse registration
agent = Agent(
    name="solidity-analysis-agent",
    seed="solidity_analysis_seed",
    port=8001,
    mailbox=True,
    publish_agent_details=True,
)

protocol = Protocol(spec=chat_protocol_spec)

# Agent addresses (resolve dynamically via Agentverse; placeholders for demo)
AGENT2_ADDR = 'agent2_address@http://localhost:8002'  # Resolve via Agentverse
AGENT4_ADDR = 'coordinator_address@http://localhost:8004'  # Coordinator

@agent.on_startup
async def startup(ctx: Context):
    ctx.logger.info("Agent 1 starting up")
    # Initialize MCP unlock
    try:
        requests.post(MCP_URL, json={"tool": "__unlock_blockchain_analysis__", "args": {}})
        ctx.logger.info("MCP unlocked")
    except Exception as e:
        ctx.logger.error(f"MCP unlock failed: {e}")

# Helper to call MCP (e.g., for fetching contract code if address provided)
def call_mcp(tool_name, args):
    try:
        response = requests.post(MCP_URL, json={"tool": tool_name, "args": args})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e)}

# Helper to get Solidity code from file via Hardhat (e.g., compile to verify)
def get_code_from_hardhat(file_path):
    try:
        result = subprocess.run(['npx', 'hardhat', 'compile'], capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Error compiling: {result.stderr}")
        with open(file_path, 'r') as f:
            return f.read()
    except Exception as e:
        return f"Error: {str(e)}"

# Use metta-motto to enhance prompt with MeTTa reasoning
def enhance_with_metta(query):
    try:
        motto_agent = motto.Motto(metta)
        reasoned = motto_agent.chain(query, model=client, prompt_template="Reason about {query} using knowledge graph: query for impacts and mitigations")
        return reasoned
    except Exception as e:
        return f"MeTTa error: {e}"

@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    ctx.logger.info(f"Handling ChatMessage from {sender}")
    await ctx.send(
        sender,
        ChatAcknowledgement(timestamp=datetime.now(), acknowledged_msg_id=msg.msg_id),
    )
    
    text = ''
    for item in msg.content:
        if isinstance(item, TextContent):
            text += item.text
    
    ctx.logger.info(f"Received query: {text}")
    
    # Extract code or handle file/address
    solidity_code = ''
    try:
        if 'file:' in text:  # e.g., "Analyze file: path/to/contract.sol"
            file_path = text.split('file:')[-1].strip()
            solidity_code = get_code_from_hardhat(file_path)
            ctx.logger.info(f"Loaded code from file: {file_path}")
        elif 'address:' in text and 'chain_id:' in text:  # e.g., "Analyze address: 0x... on chain_id: 1"
            parts = text.split()
            address = next(p for p in parts if p.startswith('address:')).split(':')[-1]
            chain_id = next(p for p in parts if p.startswith('chain_id:')).split(':')[-1]
            mcp_response = call_mcp("inspect_contract_code", {"chain_id": chain_id, "address": address})
            solidity_code = json.dumps(mcp_response) if 'error' not in mcp_response else mcp_response['error']
            ctx.logger.info(f"Fetched code from MCP for address {address} on chain {chain_id}")
        else:
            # Assume code is in the message
            solidity_code = text
    except Exception as e:
        ctx.logger.error(f"Error extracting code: {e}")
        solidity_code = f"Error: {e}"
    
    # MeTTa reasoning
    try:
        metta_reasoning = metta.run('!(match &self (vuln $v $d $i $m) ($v $d $i $m))')  # Query KG with more details
        ctx.logger.info(f"MeTTa reasoning: {metta_reasoning}")
    except Exception as e:
        metta_reasoning = []
        ctx.logger.error(f"MeTTa query failed: {e}")
    enhanced_prompt = enhance_with_metta(f"Audit: {solidity_code} with reasoning: {metta_reasoning}")
    
    # ASI:One prompt - structured output
    response_text = 'Error analyzing code.'
    try:
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {"role": "system", "content": "You are an expert in Solidity auditing. Audit the provided code for vulnerabilities like reentrancy, overflows, access control issues. Suggest gas optimizations such as variable packing, loop unrolling, constant folding. Structure output as: Introduction, Vulnerabilities (with Impact, Proof-of-Concept, Recommended Mitigation), Optimizations, Final Thoughts. Provide a detailed report."},
                {"role": "user", "content": enhanced_prompt},
            ],
            max_tokens=2048,
        )
        response_text = r.choices[0].message.content
        ctx.logger.info("ASI:One analysis complete")
    except Exception as e:
        ctx.logger.exception('Error querying ASI:One')
    
    try:
        await ctx.send(sender, ChatMessage(
            timestamp=datetime.utcnow(),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=response_text),
                EndSessionContent(type="end-session"),
            ]
        ))
        ctx.logger.info("Response sent")
    except Exception as e:
        ctx.logger.error(f"Failed to send response: {e}")
    
    # For collaboration: if anomaly or needs simulation, send to Agent2 or back to Coordinator
    if 'anomaly' in text.lower() or 'simulate' in text.lower():
        try:
            await ctx.send(AGENT2_ADDR, TaskRequest(query=text, type='simulation', query_id=str(uuid4())))
            ctx.logger.info("Sent simulation request to Agent2")
        except Exception as e:
            ctx.logger.error(f"Failed to send to Agent2: {e}")

# Models for inter-agent communication
class TaskRequest(Model):
    query: str
    type: str  # e.g., 'analysis'
    query_id: str

class TaskResult(Model):
    result: str
    query_id: str

@agent.on_message(TaskRequest)
async def handle_task_req(ctx: Context, sender: str, msg: TaskRequest):
    ctx.logger.info(f"Handling TaskRequest from {sender} with query_id {msg.query_id}")
    if msg.type == 'analysis':
        # Process as in handle_message (reuse logic)
        try:
            # ... (extract, analyze, etc. - simulate full logic here)
            analysis_result = "Analysis complete: [structured details]"  # Placeholder; integrate full analysis
            await ctx.send(sender, TaskResult(result=analysis_result, query_id=msg.query_id))
            ctx.logger.info(f"Sent TaskResult for query_id {msg.query_id}")
            
            # Update MeTTa with new knowledge
            metta.run(f'!(add-atom &self (audit-result "{analysis_result}"))')
            ctx.logger.info("Updated MeTTa knowledge")
        except Exception as e:
            ctx.logger.error(f"Task processing failed: {e}")

@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()