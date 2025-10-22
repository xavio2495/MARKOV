import json
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

# ASI:One setup
ASI_API_KEY = '<YOUR_ASI_ONE_API_KEY>'
client = OpenAI(
    base_url='https://api.asi1.ai/v1',
    api_key=ASI_API_KEY,
)

# MeTTa-WAM setup for query routing and reasoning
prolog = Prolog()
prolog.consult('path/to/metta-wam/metta-wam.pl')  # Replace with actual path
prolog.assertz('(route(analysis, "audit vuln optimize"))')
prolog.assertz('(route(simulation, "simulate fork tx exploit"))')
prolog.assertz('(route(monitoring, "monitor logs anomaly"))')
prolog.assertz('(route(all, "full workflow"))')

# Agent setup
agent = Agent(
    name="coordinator-agent",
    seed="coordinator_seed",
    port=8004,
    mailbox=True,
    publish_agent_details=True,
)

protocol = Protocol(spec=chat_protocol_spec)

# Agent addresses (resolve dynamically via Agentverse; placeholders for demo)
AGENT1_ADDR = 'agent1_address@http://localhost:8001'
AGENT2_ADDR = 'agent2_address@http://localhost:8002'
AGENT3_ADDR = 'agent3_address@http://localhost:8003'

@agent.on_startup
async def startup(ctx: Context):
    ctx.logger.info("Coordinator starting up")
    # Initialize storage
    ctx.storage.set("aggregated", {})

# Enhance prompt with MeTTa-WAM reasoning (using direct prolog.query)
def enhance_with_metta(query):
    try:
        reasoning = list(prolog.query("route(R, K)"))  # Query for routes
        reasoned_str = json.dumps(reasoning)
        return f"{query} with reasoning: {reasoned_str}"
    except Exception as e:
        return f"MeTTa-WAM error: {e}. {query}"

# Models for inter-agent communication
class TaskRequest(Model):
    query: str
    type: str  # e.g., 'analysis', 'simulation', 'monitoring'
    query_id: str

class TaskResult(Model):
    result: str
    query_id: str

@protocol.on_message(ChatMessage)
async def handle_user_query(ctx: Context, sender: str, msg: ChatMessage):
    ctx.logger.info(f"Handling user query from {sender}")
    await ctx.send(
        sender,
        ChatAcknowledgement(timestamp=datetime.now(), acknowledged_msg_id=msg.msg_id),
    )
    
    text = ''
    for item in msg.content:
        if isinstance(item, TextContent):
            text += item.text
    
    ctx.logger.info(f"Received user query: {text}")
    
    # Use MeTTa-WAM to classify and route
    try:
        routing = enhance_with_metta(text)
        ctx.logger.info(f"Routing decision: {routing}")
    except Exception as e:
        routing = ''
        ctx.logger.error(f"Routing failed: {e}")
    
    query_id = str(uuid4())
    aggregated_key = f"aggregated_{query_id}"
    ctx.storage.set(aggregated_key, {'analysis': None, 'simulation': None, 'monitoring': None, 'sender': sender})
    
    # Route based on routing (parse lowercase)
    routed = False
    try:
        if 'analysis' in routing.lower():
            await ctx.send(AGENT1_ADDR, TaskRequest(query=text, type='analysis', query_id=query_id))
            routed = True
        if 'simulation' in routing.lower():
            await ctx.send(AGENT2_ADDR, TaskRequest(query=text, type='simulation', query_id=query_id))
            routed = True
        if 'monitoring' in routing.lower():
            await ctx.send(AGENT3_ADDR, TaskRequest(query=text, type='monitoring', query_id=query_id))
            routed = True
        
        if not routed:
            # Default or full workflow: route to all
            await ctx.send(AGENT1_ADDR, TaskRequest(query=text, type='analysis', query_id=query_id))
            await ctx.send(AGENT2_ADDR, TaskRequest(query=text, type='simulation', query_id=query_id))
            await ctx.send(AGENT3_ADDR, TaskRequest(query=text, type='monitoring', query_id=query_id))
        ctx.logger.info(f"Routed tasks for query_id {query_id}")
    except Exception as e:
        ctx.logger.error(f"Routing send failed: {e}")

# Handle results from other agents
@agent.on_message(TaskResult)
async def handle_task_result(ctx: Context, sender: str, msg: TaskResult):
    ctx.logger.info(f"Received TaskResult from {sender} for query_id {msg.query_id}")
    aggregated_key = f"aggregated_{msg.query_id}"
    aggregated = ctx.storage.get(aggregated_key, {})
    
    # Determine type based on sender (simplify for demo)
    if sender.startswith('agent1'):
        aggregated['analysis'] = msg.result
    elif sender.startswith('agent2'):
        aggregated['simulation'] = msg.result
    elif sender.startswith('agent3'):
        aggregated['monitoring'] = msg.result
    
    ctx.storage.set(aggregated_key, aggregated)
    
    # Check if all expected results are in (demo: assume all three or non-None)
    if all(value is not None for value in aggregated.values() if value is not None):
        # ASI:One to summarize aggregated results
        summary = 'Aggregated report.'
        try:
            r = client.chat.completions.create(
                model="asi1-mini",
                messages=[
                    {"role": "system", "content": "Summarize results from multiple agents into a cohesive report."},
                    {"role": "user", "content": json.dumps(aggregated)},
                ],
                max_tokens=2048,
            )
            summary = r.choices[0].message.content
            ctx.logger.info("Summary complete")
        except Exception as e:
            ctx.logger.exception('Error in summary')
            summary = f"Error: {e}"
        
        # Send back to user
        user_sender = aggregated.get('sender')
        if user_sender:
            try:
                await ctx.send(user_sender, ChatMessage(
                    timestamp=datetime.utcnow(),
                    msg_id=uuid4(),
                    content=[
                        TextContent(type="text", text=summary),
                        EndSessionContent(type="end-session"),
                    ]
                ))
                ctx.logger.info(f"Sent summary to user for query_id {msg.query_id}")
            except Exception as e:
                ctx.logger.error(f"Failed to send summary: {e}")
        
        # Update shared MeTTa-WAM knowledge
        try:
            prolog.assertz(f'(query_result("{summary}"))')
            ctx.logger.info("Updated MeTTa-WAM knowledge")
        except Exception as e:
            ctx.logger.error(f"MeTTa-WAM update failed: {e}")
        
        # Clean up storage
        ctx.storage.delete(aggregated_key)

@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()