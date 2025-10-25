import os
from pathlib import Path

from uagents import Agent, Context


def _load_dotenv(path: str | Path | None = None, override: bool = False) -> None:
    """Load simple KEY=VALUE pairs from a .env file into os.environ.

    Behavior: do not override existing environment variables unless override=True.
    This is intentionally tiny so the example doesn't require extra dependencies.
    """
    p = Path(path) if path is not None else Path(__file__).parent / ".env"
    if not p.exists():
        return

    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        # strip surrounding quotes if present
        if (val.startswith('"') and val.endswith('"')) or (
            val.startswith("'") and val.endswith("'")
        ):
            val = val[1:-1]
        if override or key not in os.environ:
            os.environ[key] = val


# Load .env defaults (won't clobber real environment variables)
_load_dotenv()


AGENT_NAME = os.environ.get("UAGENT_NAME", "markov")
AGENT_SEED = os.environ.get("UAGENT_SEED")
AGENT_TYPE = os.environ.get("UAGENT_TYPE", "custom")
AGENT_NETWORK = os.environ.get("UAGENT_NETWORK", "testnet")
AGENT_ENDPOINT = os.environ.get(
    "UAGENT_ENDPOINT", "http://192.168.137.1:8000/submit"
)


agent = Agent(
    name=AGENT_NAME,
    seed=AGENT_SEED,
    mailbox=AGENT_TYPE == "custom",
    proxy=AGENT_TYPE == "proxy",
    endpoint=AGENT_ENDPOINT,
    network=AGENT_NETWORK,
    publish_agent_details=True,
)


@agent.on_event("startup")
async def handle_startup(ctx: Context):
    ctx.logger.info("Agent has started")


@agent.on_interval(period=10)
async def handle_periodic(ctx: Context):
    ctx.logger.info("Agent is still alive")


if __name__ == "__main__":
    agent.run()
