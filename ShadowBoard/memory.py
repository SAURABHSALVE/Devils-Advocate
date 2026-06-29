import os
from supermemory import Supermemory
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_api_key = os.getenv("SUPERMEMORY_API_KEY", "").strip()
client = Supermemory(api_key=_api_key) if _api_key else None

CONTAINER = "shadow_board"


def save_debate_memory(user_id, question, votes, moderator_summary, board_type):
    if not client:
        return
    try:
        vote_text = ', '.join([f'{agent}: {vote}' for agent, vote in votes.items()])
        content = f"Board Debate on: {question}\nBoard Type: {board_type}\nVotes: {vote_text}\nKey Findings: {moderator_summary[:1000]}"

        client.add(
            content=content,
            container_tag=CONTAINER,
            metadata={"user_id": user_id}
        )
        print("Supermemory: debate saved")
    except Exception as e:
        print(f"Supermemory save error: {e}")


def get_relevant_memories(user_id, question):
    if not client:
        return ""
    try:
        results = client.search.memories(
            q=question,
            container_tag=CONTAINER,
            filters={
                "AND": [
                    {"key": "user_id", "value": user_id}
                ]}
        )

        if results and results.results:
            memories = []
            for r in results.results[:5]:
                text = r.memory if hasattr(r, 'memory') and r.memory else str(r)
                memories.append(text)
            return "\n---\n".join(memories)
        return ""
    except Exception as e:
        print(f"Supermemory search error: {e}")
        return ""
