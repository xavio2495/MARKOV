import os
import json
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
from pyswip import Prolog
import motto  # from metta-motto

os.environ['BLOCKSCOUT_DISABLE_COMMUNITY_TELEMETRY'] = 'true'

ASI_API_KEY = '<YOUR_ASI_ONE_API_KEY>'
client = OpenAI(
    base_url='https://api.asi1.ai/v1',
    api_key=ASI_API_KEY,
)

MCP_URL = 'https://mcp.blockscout.com/mcp'
DISCORD_WEBHOOK = '<YOUR_DISCORD_WEBHOOK_URL>'  # Replace
DIAMOND_ADDR = '0xFe89...'  # Replace with actual Diamond contract address
CHAIN_ID = '1'  # e.g., Ethereum mainnet

# MeTTa-WAM setup
prolog = Prolog()
prolog.consult('path/to/metta-wam/metta-wam.pl')  # Replace with actual path
prolog.assertz('(anomaly(high_gas, 1000000, "High: Potential denial of service", "Optimize contract"))')
prolog.assertz('(anomaly(unusual_event, "Unexpected event emission", "Medium: Possible exploit", ""))')

# Agent setup
agent = Agent(
    name="mcp-monitoring-agent",
    seed="mcp_monitoring_seed",
    port=8003,
    mailbox=True,
    publish_agent_details=True,
)

protocol = Protocol(spec=chat_protocol_spec)

# Agent addresses
AGENT1_ADDR = 'agent1_address@http://localhost:8001'
AGENT4_ADDR = 'coordinator_address@http://localhost:8004'

@agent.on_startup
async def startup(ctx: Context):
    ctx.logger.info("Agent 3 starting up")
    # Unlock MCP
    try:
        requests.post(MCP_URL, json={"tool": "__unlock_blockchain_analysis__", "args": {}})
        ctx.logger.info("MCP unlocked")
    except Exception as e:
        ctx.logger.error(f"MCP unlock failed: {e}")

# Helper to send Discord alert
def send_discord_alert(message):
    try:
        requests.post(DISCORD_WEBHOOK, json={"content": message})
        return "Alert sent"
    except Exception as e:
        return f"Error sending Discord alert: {e}"

# Use metta-motto to enhance prompt with MeTTa-WAM reasoning
def enhance_with_metta(query):
    try:
        motto_agent = motto.Motto(prolog)  # Adapt if needed
        reasoned = motto_agent.chain(query, model=client, prompt_template="Reason about {query} using knowledge graph: include impacts")
        return reasoned
    except Exception as e:
        return f"MeTTa-WAM error: {e}"

@agent.on_interval(period=300)  # Poll every 5 minutes
async def monitor_diamond(ctx: Context):
    ctx.logger.info("Starting periodic monitoring")
    try:
        # Get recent transactions
        txs = requests.post(MCP_URL, json={
            "tool": "get_transactions_by_address",
            "args": {"chain_id": CHAIN_ID, "address": DIAMOND_ADDR, "age_from": int(datetime.now().timestamp()) - 3600, "age_to": int(datetime.now().timestamp()), "methods": []}
        }).json()
        ctx.logger.info(f"Transactions fetched: {len(txs.get('transactions', []))}")
        
        summary_data = {"txs": txs}
        
        if 'transactions' in txs and txs['transactions']:
            latest_tx_hash = txs['transactions'][0]['hash']
            # Add transaction_summary for deeper insights
            tx_summary = requests.post(MCP_URL, json={
                "tool": "transaction_summary",
                "args": {"chain_id": CHAIN_ID, "hash": latest_tx_hash}
            }).json()
            summary_data["tx_summary"] = tx_summary
            ctx.logger.info(f"Transaction summary: {tx_summary}")
            
            logs = requests.post(MCP_URL, json={
                "tool": "get_transaction_logs",
                "args": {"chain_id": CHAIN_ID, "hash": latest_tx_hash}
            }).json()
            summary_data["logs"] = logs
            ctx.logger.info(f"Logs fetched: {len(logs.get('logs', []))}")
        
        summary = json.dumps(summary_data)
        
        # MeTTa-WAM inference
        try:
            inference = list(prolog.query('match(self, anomaly(A, T, I, M), (A, T, I, M))'))
            ctx.logger.info(f"MeTTa-WAM inference: {inference}")
        except Exception as e:
            inference = []
            ctx.logger.error(f"MeTTa-WAM query failed: {e}")
        enhanced_prompt = enhance_with_metta(summary + str(inference))
        
        # ASI:One anomaly detection
        anomaly_text = 'No anomalies.'
        try:
            r = client.chat.completions.create(
                model="asi1-mini",
                messages=[
                    {"role": "system", "content": "Summarize on-chain activity and detect anomalies like high gas txs, unusual events. Structure with impacts."},
                    {"role": "user", "content": enhanced_prompt},
                ],
                max_tokens=2048,
            )
            anomaly_text = r.choices[0].message.content
            ctx.logger.info("ASI:One summary complete")
        except Exception as e:
            ctx.logger.exception('Error querying ASI:One')
        
        ctx.logger.info(f"Monitoring summary: {anomaly_text}")
        print(f"CLI Alert: {anomaly_text}")  # CLI output
        
        if 'anomaly' in anomaly_text.lower() or 'high gas' in anomaly_text.lower():
            alert_status = send_discord_alert(f"Alert: {anomaly_text}")
            ctx.logger.info(alert_status)
            # Send to Coordinator or Agent1
            try:
                await ctx.send(AGENT4_ADDR, TaskResult(result=anomaly_text, query_id=str(uuid4())))
                ctx.logger.info("Sent anomaly to Coordinator")
            except Exception as e:
                ctx.logger.error(f"Failed to send to Coordinator: {e}")
            
            # Update MeTTa-WAM with new anomaly
            prolog.assertz(f'(new_anomaly("{anomaly_text}"))')
            ctx.logger.info("Updated MeTTa-WAM knowledge")
    except Exception as e:
        ctx.logger.exception('Monitoring error')

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
    
    # Handle ad-hoc queries, e.g., "Latest logs from 0xFe89... before Nov 08 2024"
    response_text = 'Monitoring query processed.'
    try:
        # Parse query and call MCP accordingly (example assumes tx_hash in text)
        tx_hash = text.split('logs from')[-1].split(';')[0].strip() if 'logs from' in text else 'default_hash'
        logs = requests.post(MCP_URL, json={
            "tool": "get_transaction_logs",
            "args": {"chain_id": CHAIN_ID, "hash": tx_hash}
        }).json()
        ctx.logger.info(f"Logs for {tx_hash}: {len(logs.get('logs', []))}")
        
        # Add summary
        tx_summary = requests.post(MCP_URL, json={
            "tool": "transaction_summary",
            "args": {"chain_id": CHAIN_ID, "hash": tx_hash}
        }).json()
        ctx.logger.info(f"Summary for {tx_hash}: {tx_summary}")
        
        data = json.dumps({"logs": logs, "summary": tx_summary})
        
        # Enhance with MeTTa-WAM
        enhanced_prompt = enhance_with_metta(data)
        
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {"role": "system", "content": "Check anomalies in this log and summary."},
                {"role": "user", "content": enhanced_prompt},
            ],
            max_tokens=2048,
        )
        response_text = r.choices[0].message.content
        ctx.logger.info("ASI:One analysis complete")
    except Exception as e:
        ctx.logger.exception('Query error')
        response_text = f"Error: {e}"
    
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

# Models for inter-agent
class TaskRequest(Model):
    query: str
    type: str
    query_id: str

class TaskResult(Model):
    result: str
    query_id: str

@agent.on_message(TaskRequest)
async def handle_task_req(ctx: Context, sender: str, msg: TaskRequest):
    ctx.logger.info(f"Handling TaskRequest from {sender} with query_id {msg.query_id}")
    if msg.type == 'monitoring':
        try:
            # Process monitoring query (reuse monitor logic)
            # ... (similar to handle_message or monitor_diamond)
            monitor_result = "Monitoring complete: [details]"
            await ctx.send(sender, TaskResult(result=monitor_result, query_id=msg.query_id))
            ctx.logger.info(f"Sent TaskResult for query_id {msg.query_id}")
        except Exception as e:
            ctx.logger.error(f"Task processing failed: {e}")

@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()