import json
import subprocess
import matplotlib.pyplot as plt
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

ASI_API_KEY = '<YOUR_ASI_ONE_API_KEY>'
client = OpenAI(
    base_url='https://api.asi1.ai/v1',
    api_key=ASI_API_KEY,
)

# MeTTa setup
metta = MeTTa()
metta.run('''
!(add-atom &self (edge-case high-gas (description "Tx exceeding block limit") (impact "High: Tx failure") (mitigation "Optimize loops and storage")))
!(add-atom &self (edge-case reentrancy-exploit (description "Simulate reentrant call") (poc "Deploy attacker contract and call")))
''')

# Agent setup
agent = Agent(
    name="simulation-agent",
    seed="simulation_seed",
    port=8002,
    mailbox=True,
    publish_agent_details=True,
)

protocol = Protocol(spec=chat_protocol_spec)

# Agent addresses
AGENT4_ADDR = 'coordinator_address@http://localhost:8004'

@agent.on_startup
async def startup(ctx: Context):
    ctx.logger.info("Agent 2 starting up")

# Helper to run Hardhat simulation (e.g., fork and simulate tx; support exploit POC)
def run_hardhat_simulation(scenario, is_exploit=False):
    try:
        # Adjust cmd for scenario; e.g., pass args to script
        cmd = ['npx', 'hardhat', 'run', '--network', 'localhost', 'scripts/simulate.js']  # Customize with -- args if needed
        if is_exploit:
            cmd.append('--exploit')  # Assume script handles
        result = subprocess.run(cmd, capture_output=True, text=True)
        result.check_returncode()
        
        # Parse gas usage from output (assume "gas:12345")
        gas_usage = 0
        for line in result.stdout.splitlines():
            if line.startswith('gas:'):
                gas_usage = int(line.split(':')[-1].strip())
        
        return result.stdout, gas_usage
    except Exception as e:
        return str(e), 0

# Generate gas chart
def generate_gas_chart(gas_data):
    try:
        plt.figure()
        plt.bar(['Simulated Gas'], [gas_data])
        plt.savefig('gas_chart.png')
        return 'Gas chart saved as gas_chart.png'
    except Exception as e:
        return f'Error generating chart: {e}'

# Use metta-motto to enhance prompt with MeTTa reasoning
def enhance_with_metta(query):
    try:
        motto_agent = motto.Motto(metta)
        reasoned = motto_agent.chain(query, model=client, prompt_template="Reason about {query} using knowledge graph: include POC if applicable")
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
    
    ctx.logger.info(f"Received simulation query: {text}")
    
    is_exploit = 'exploit' in text.lower() or 'poc' in text.lower()
    sim_output, gas_usage = run_hardhat_simulation(text, is_exploit)
    ctx.logger.info(f"Simulation output: {sim_output}")
    chart_msg = generate_gas_chart(gas_usage)
    
    # MeTTa enhancement
    try:
        metta_reasoning = metta.run('!(match &self (edge-case $e $d $i $m) ($e $d $i $m))')
        ctx.logger.info(f"MeTTa reasoning: {metta_reasoning}")
    except Exception as e:
        metta_reasoning = []
        ctx.logger.error(f"MeTTa query failed: {e}")
    enhanced_prompt = enhance_with_metta(f"Output: {sim_output}\nGas: {gas_usage}\nReasoning: {metta_reasoning}")
    
    # ASI:One analysis
    response_text = 'Error analyzing simulation.'
    try:
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {"role": "system", "content": "Analyze this simulation output for edge cases, potential failures, gas usage, and optimizations. If exploit POC, detail outcomes."},
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

@agent.on_interval(period=60)  # Periodic simulations (e.g., ongoing monitoring)
async def periodic_sim(ctx: Context):
    try:
        sim_output, _ = run_hardhat_simulation("default_fork")
        ctx.logger.info(f"Periodic sim: {sim_output}")
    except Exception as e:
        ctx.logger.error(f"Periodic sim failed: {e}")

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
    if msg.type == 'simulation':
        try:
            is_exploit = 'exploit' in msg.query.lower()
            sim_output, gas_usage = run_hardhat_simulation(msg.query, is_exploit)
            # Analyze... (reuse logic)
            sim_result = f"Sim results: {sim_output} gas: {gas_usage}"
            await ctx.send(sender, TaskResult(result=sim_result, query_id=msg.query_id))
            ctx.logger.info(f"Sent TaskResult for query_id {msg.query_id}")
            
            # Update MeTTa
            metta.run(f'!(add-atom &self (sim-result "{sim_result}"))')
            ctx.logger.info("Updated MeTTa knowledge")
        except Exception as e:
            ctx.logger.error(f"Task processing failed: {e}")

@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()