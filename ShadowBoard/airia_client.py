"""
AIRIA Platform Integration for Shadow Board
Calls the AIRIA pipeline API to run the Shadow Board agent.
"""
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

AIRIA_API_KEY = os.getenv("AIRIA_API_KEY", "").strip()
AIRIA_API_URL = os.getenv("AIRIA_API_URL", "https://api.airia.ai/v1/PipelineExecution/")


def call_airia_pipeline(user_input: str, async_output: bool = False) -> str:
    """
    Execute the Shadow Board agent pipeline on AIRIA.

    Args:
        user_input: The strategic question + context to analyze
        async_output: If True, returns immediately with a task ID

    Returns:
        The agent's response text
    """
    if not AIRIA_API_KEY:
        raise ValueError(
            "AIRIA_API_KEY not set. Add it to your .env file. "
            "Get your key from: AIRIA Dashboard > Settings > API Keys"
        )

    headers = {
        "X-API-Key": AIRIA_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "userInput": user_input,
        "asyncOutput": async_output,
    }

    response = requests.post(
        AIRIA_API_URL,
        headers=headers,
        data=json.dumps(payload),
        timeout=300,
    )
    response.raise_for_status()

    # Parse JSON response and extract actual text result
    try:
        data = response.json()
        result = data.get("result", "")
        # If result is a UUID (async reference), fetch the execution details
        if isinstance(result, str) and len(result) == 36 and result.count("-") == 4:
            # Result is a reference ID, not actual text — fetch execution log
            exec_id = data.get("executionId", "")
            if exec_id:
                exec_response = requests.get(
                    f"https://api.airia.ai/v1/PipelineExecution/{exec_id}",
                    headers=headers,
                    timeout=60,
                )
                if exec_response.status_code == 200:
                    exec_data = exec_response.json()
                    log_details = exec_data.get("logRecordDetails", {})
                    if not log_details.get("success", False):
                        raise ValueError(f"Pipeline failed: {log_details.get('exception', 'Unknown error')}")
            # If we still only have a UUID, the pipeline output format needs fixing in AIRIA
            return f"AIRIA Pipeline executed successfully (Execution: {exec_id}). " \
                   f"Note: Configure the Output node in AIRIA Agent Studio to return text content."
        return result
    except (json.JSONDecodeError, KeyError):
        return response.text


def run_shadow_board_via_airia(question: str, context: str = "", file_context: str = "") -> str:
    """
    Run the full Shadow Board simulation through AIRIA.
    Builds the prompt with question + context + file content,
    then sends it to the AIRIA pipeline.
    """
    prompt_parts = [f"Strategic Question: {question}"]

    if context.strip():
        prompt_parts.append(f"\nCOMPANY CONTEXT: {context}")

    if file_context.strip():
        prompt_parts.append(f"\nUPLOADED DOCUMENT:\n{file_context[:3000]}")

    full_prompt = "\n".join(prompt_parts)
    return call_airia_pipeline(full_prompt)


def test_airia_connection() -> dict:
    """
    Quick health check — sends a simple prompt to verify the API key works.
    Returns a dict with status and message.
    """
    try:
        result = call_airia_pipeline("Test: respond with 'AIRIA connection successful'")
        return {"status": "ok", "message": result[:200]}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"API request failed: {e}"}


if __name__ == "__main__":
    print("Testing AIRIA connection...")
    result = test_airia_connection()
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
