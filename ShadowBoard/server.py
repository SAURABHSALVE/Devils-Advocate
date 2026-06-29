from fastapi import FastAPI, Depends, Query, HTTPException
app = FastAPI()
from pydantic import BaseModel
import uuid
import re
from pdf_generator import generate_strategy_brief_pdf, generate_comparison_pdf
from fastapi.responses import FileResponse
import json
from fastapi.responses import StreamingResponse
import time
from fastapi.middleware.cors import CORSMiddleware
from slack_notify import send_slack_notification
from agents_creation import parse_vote
import fitz
import docx
import io
from fastapi import UploadFile, File
from agents_creation import set_board_expertise
from supabase_db import (
    save_session, get_user_sessions, save_comparison,
    save_review, get_reviews, get_review_stats, delete_review, update_review, get_profile
)
from auth_middleware import get_current_user, get_optional_user
from memory import get_relevant_memories, save_debate_memory

from agents_creation import (
    run_research_cfo, run_research_cmo, run_research_legal,
    run_debate1_cfo, run_debate1_cmo, run_debate1_legal, run_debate1_da,
    run_debate2_cfo, run_debate2_cmo, run_debate2_legal, run_debate2_da,
    run_debate3_cfo, run_debate3_cmo, run_debate3_legal, run_debate3_da,
    run_moderator, run_fast_debate, run_comparative_analysis
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse_event(event_type, data):
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ── Request models ────────────────────────────────────────────────────────────

class SessionRequest(BaseModel):
    question: str
    context: str = ""
    board_type: str = "tech"

class HumanInput(BaseModel):
    human_ip: str
    target_agent: str = "all"

class ComparisonRequest(BaseModel):
    option_a: str
    option_b: str
    context: str = ""
    board_type: str = "tech"

class ReviewRequest(BaseModel):
    review_text: str
    rating: int = 5

    def validate_rating(self) -> int:
        return max(1, min(5, self.rating))

class ChatRequest(BaseModel):
    message: str
    history: list = []


sessions_info = {}
comparisons_info = {}


@app.get("/")
def home():
    return {"message": "Shadow Board API is running"}


def validate_question(question: str) -> str:
    if len(question) > 1000:
        question = question[:1000]
    blocked_phrases = [
        "ignore previous instructions",
        "ignore your instructions",
        "you are now",
        "forget your role",
        "system prompt",
        "reveal your prompt",
    ]
    lower = question.lower()
    for phrase in blocked_phrases:
        if phrase in lower:
            raise ValueError("Invalid input detected")
    return question


# ── Auth endpoints (Supabase handles the actual auth; these are helpers) ──────

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    profile = get_profile(current_user["user_id"])
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "name": profile.get("name") if profile else "",
    }


# ── Session endpoints ─────────────────────────────────────────────────────────

@app.post("/api/session/create")
def session_id_creation(
    request: SessionRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        question = validate_question(request.question)
    except ValueError:
        return {"error": "Invalid question"}

    session_id = str(uuid.uuid4())
    sessions_info[session_id] = {
        "question": question,
        "context": request.context,
        "board_type": request.board_type,
        "user_id": current_user["user_id"],
    }
    return {"session": session_id}


@app.get("/api/{session_id}/download_pdf")
def download_pdf(session_id: str, current_user: dict = Depends(get_current_user)):
    filepath = f"reports/strategy_brief_{session_id}.pdf"
    return FileResponse(filepath, filename="Shadow_Board_Strategy_Brief.pdf")


@app.post("/api/{session_id}/upload")
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    content = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".txt"):
        text = content.decode("utf-8")
    elif filename.endswith(".pdf"):
        doc = fitz.open(stream=content, filetype="pdf")
        text = "".join(page.get_text() for page in doc)
    elif filename.endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        text = ""

    sessions_info[session_id]["file_context"] = text
    return {"status": "uploaded", "characters": len(text)}


@app.get("/api/sessions/history")
def get_history(current_user: dict = Depends(get_current_user)):
    sessions = get_user_sessions(current_user["user_id"])
    return {"sessions": sessions}


# ── Main debate SSE ───────────────────────────────────────────────────────────

@app.get("/api/{session_id}/agents_research")
def agents_research(session_id: str, current_user: dict = Depends(get_current_user)):
    session = sessions_info[session_id]
    question = session["question"]
    context = session.get("context", "")
    board_type = session.get("board_type", "tech")
    set_board_expertise(board_type)
    file_context = session.get("file_context", "")
    user_id = current_user["user_id"]

    past_insights = ""
    try:
        past_insights = get_relevant_memories(user_id, question)
    except Exception as e:
        print(f"Memory retrieval error: {e}")

    full_question = question
    if context:
        full_question += f"\n\nCOMPANY CONTEXT: {context}"
    if file_context:
        full_question += f"\n\nUPLOADED DOCUMENT:\n{file_context[:3000]}"
    if past_insights:
        full_question += (
            f"\n\nINSTITUTIONAL MEMORY (past board decisions):\n{past_insights}"
            "\n\nUse these past board insights to inform your analysis."
        )

    def generate():
        yield "retry: 120000\n\n"
        yield sse_event("phase", {"phase": "research"})

        def hb():
            return sse_event("heartbeat", {"ts": time.time()})

        try:
            yield hb()
            yield sse_event("agent_start", {"agent": "CFO", "action": "researching financial data"})
            task_cfo = run_research_cfo(full_question)
            yield sse_event("agent_message", {"agent": "CFO", "phase": "research", "text": task_cfo.output.raw})

            yield hb()
            yield sse_event("agent_start", {"agent": "CMO", "action": "researching market data"})
            task_cmo = run_research_cmo(full_question)
            yield sse_event("agent_message", {"agent": "CMO", "phase": "research", "text": task_cmo.output.raw})

            yield hb()
            yield sse_event("agent_start", {"agent": "Legal", "action": "researching regulations"})
            task_legal = run_research_legal(full_question)
            yield sse_event("agent_message", {"agent": "Legal", "phase": "research", "text": task_legal.output.raw})
        except Exception as e:
            yield sse_event("error", {"message": f"Agent research failed: {str(e)}"})
            return

        # ── Round 1 ──
        yield sse_event("phase", {"phase": "debate", "round": 1})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "preparing opening statement"})
        debate_cfo = run_debate1_cfo(full_question, task_cfo, task_cmo, task_legal)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 1, "text": debate_cfo.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "preparing opening statement"})
        debate_cmo = run_debate1_cmo(full_question, task_cfo, task_cmo, task_legal, debate_cfo)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 1, "text": debate_cmo.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "preparing opening statement"})
        debate_legal = run_debate1_legal(full_question, task_cfo, task_cmo, task_legal, debate_cfo, debate_cmo)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 1, "text": debate_legal.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "preparing challenges"})
        debate_da = run_debate1_da(full_question, task_cfo, task_cmo, task_legal, debate_cfo, debate_cmo, debate_legal)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 1, "text": debate_da.output.raw})

        # ── HITL pause ──
        yield sse_event("pause", {"round": 1, "prompt": "Ask the board a question"})
        elapsed = 0
        while "human_input" not in sessions_info[session_id]:
            yield sse_event("heartbeat", {"waiting": True})
            time.sleep(2)
            elapsed += 2
            if elapsed >= 300:
                break
        human_input = sessions_info[session_id].pop("human_input", "")
        target_agent = sessions_info[session_id].pop("target_agent", "all")

        if target_agent == "all" or not human_input:
            cfo_input = cmo_input = legal_input = da_input = human_input
        else:
            direct = f"The human decision-maker has DIRECTLY CHALLENGED YOU: '{human_input}'. Respond to this challenge FIRST."
            observe = f"The human challenged the {target_agent} with: '{human_input}'. Consider their exchange and adjust your position if needed."
            cfo_input = direct if target_agent == "CFO" else observe
            cmo_input = direct if target_agent == "CMO" else observe
            legal_input = direct if target_agent == "Legal" else observe
            da_input = direct if target_agent == "Devils Advocate" else observe

        # ── Round 2 ──
        yield sse_event("resume", {"message": "Debate continuing"})
        yield sse_event("phase", {"phase": "debate", "round": 2})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "preparing rebuttal"})
        debate_cfo_2 = run_debate2_cfo(full_question, debate_cfo, debate_cmo, debate_legal, debate_da, cfo_input)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 2, "text": debate_cfo_2.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "preparing rebuttal"})
        debate_cmo_2 = run_debate2_cmo(full_question, debate_cfo, debate_cmo, debate_legal, debate_da, debate_cfo_2, cmo_input)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 2, "text": debate_cmo_2.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "preparing rebuttal"})
        debate_legal_2 = run_debate2_legal(full_question, debate_cfo, debate_cmo, debate_legal, debate_da, debate_cfo_2, debate_cmo_2, legal_input)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 2, "text": debate_legal_2.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "preparing final challenge"})
        debate_da_2 = run_debate2_da(full_question, debate_cfo, debate_cmo, debate_legal, debate_da, debate_cfo_2, debate_cmo_2, debate_legal_2, da_input)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 2, "text": debate_da_2.output.raw})

        # ── Round 3 ──
        yield sse_event("phase", {"phase": "debate", "round": 3})
        all_context_r3 = [debate_cfo, debate_cmo, debate_legal, debate_da,
                          debate_cfo_2, debate_cmo_2, debate_legal_2, debate_da_2]

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "final position"})
        debate_cfo_3 = run_debate3_cfo(full_question, all_context_r3)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "final", "round": 3, "text": debate_cfo_3.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "final position"})
        debate_cmo_3 = run_debate3_cmo(full_question, all_context_r3 + [debate_cfo_3])
        yield sse_event("agent_message", {"agent": "CMO", "phase": "final", "round": 3, "text": debate_cmo_3.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "final position"})
        debate_legal_3 = run_debate3_legal(full_question, all_context_r3 + [debate_cfo_3, debate_cmo_3])
        yield sse_event("agent_message", {"agent": "Legal", "phase": "final", "round": 3, "text": debate_legal_3.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "final challenge"})
        debate_da_3 = run_debate3_da(full_question, all_context_r3 + [debate_cfo_3, debate_cmo_3, debate_legal_3])
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "final", "round": 3, "text": debate_da_3.output.raw})

        # ── Synthesis ──
        yield sse_event("phase", {"phase": "synthesis"})
        all_context_mod = all_context_r3 + [debate_cfo_3, debate_cmo_3, debate_legal_3, debate_da_3]

        yield hb()
        yield sse_event("agent_start", {"agent": "Moderator", "action": "synthesizing debate"})
        moderator_task = run_moderator(full_question, all_context_mod)
        yield sse_event("agent_message", {"agent": "Moderator", "phase": "synthesis", "text": moderator_task.output.raw})

        generate_strategy_brief_pdf(full_question, moderator_task.output.raw, session_id)
        yield sse_event("brief_ready", {"download_url": f"/api/{session_id}/download_pdf"})

        votes = {
            "CFO": parse_vote(debate_cfo_3),
            "CMO": parse_vote(debate_cmo_3),
            "Legal": parse_vote(debate_legal_3),
            "Devils Advocate": parse_vote(debate_da_3),
        }
        send_slack_notification(question, votes, moderator_task.output.raw)

        save_session(
            session_id=session_id,
            user_id=user_id,
            question=question,
            context=context,
            board_type=board_type,
            votes=votes,
            moderator_summary=moderator_task.output.raw[:2000],
        )

        try:
            save_debate_memory(user_id, question, votes, moderator_task.output.raw, board_type)
        except Exception as e:
            print(f"Supermemory save error: {e}")

        yield sse_event("complete", {"message": "Shadow Board session complete"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/{session_id}/human_input")
def human_input_endpoint(
    session_id: str,
    request: HumanInput,
    current_user: dict = Depends(get_current_user),
):
    sessions_info[session_id]["human_input"] = request.human_ip
    sessions_info[session_id]["target_agent"] = request.target_agent
    return {"status": "received"}


# ── Reviews ───────────────────────────────────────────────────────────────────

@app.get("/api/reviews")
def list_reviews(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    result = get_reviews(limit=limit, offset=offset)
    stats = get_review_stats()
    return {"reviews": result["reviews"], "total": result["total"], "stats": stats}


@app.post("/api/reviews")
def create_review(
    request: ReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    if not request.review_text.strip():
        raise HTTPException(status_code=400, detail="Review text cannot be empty")
    rating = max(1, min(5, request.rating))
    review_id = str(uuid.uuid4())
    profile = get_profile(current_user["user_id"])
    reviewer_name = (profile or {}).get("name") or current_user["email"].split("@")[0]
    save_review(review_id, reviewer_name, request.review_text.strip(), current_user["user_id"], rating)
    result = get_reviews(limit=1, offset=0)
    created = next((r for r in result["reviews"] if r["review_id"] == review_id), None)
    return {"status": "success", "review": created or {
        "review_id": review_id,
        "reviewer_name": reviewer_name,
        "review_text": request.review_text.strip(),
        "rating": rating,
        "helpful_count": 0,
        "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }}


class ReviewUpdateRequest(BaseModel):
    review_text: str
    rating: int = 5


@app.delete("/api/reviews/{review_id}")
def remove_review(review_id: str, current_user: dict = Depends(get_current_user)):
    deleted = delete_review(review_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Review not found or not yours")
    return {"status": "deleted"}


@app.patch("/api/reviews/{review_id}")
def edit_review(
    review_id: str,
    request: ReviewUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not request.review_text.strip():
        raise HTTPException(status_code=400, detail="Review text cannot be empty")
    updated = update_review(
        review_id,
        current_user["user_id"],
        request.review_text.strip(),
        max(1, min(5, request.rating)),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Review not found or not yours")
    return {"status": "updated", "review": updated}


# ── Scenario comparison ───────────────────────────────────────────────────────

@app.post("/api/comparison/create")
def create_comparison(
    request: ComparisonRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        option_a = validate_question(request.option_a)
        option_b = validate_question(request.option_b)
    except ValueError:
        return {"error": "Invalid question detected"}

    comparison_id = str(uuid.uuid4())
    comparisons_info[comparison_id] = {
        "option_a": option_a,
        "option_b": option_b,
        "context": request.context,
        "board_type": request.board_type,
        "user_id": current_user["user_id"],
    }
    return {"comparison_id": comparison_id}


@app.get("/api/{comparison_id}/compare")
def run_comparison(
    comparison_id: str,
    current_user: dict = Depends(get_current_user),
):
    comparison = comparisons_info[comparison_id]
    option_a = comparison["option_a"]
    option_b = comparison["option_b"]
    context = comparison.get("context", "")
    board_type = comparison.get("board_type", "tech")
    user_id = current_user["user_id"]

    set_board_expertise(board_type)

    full_a = option_a + (f"\n\nCOMPANY CONTEXT: {context}" if context else "")
    full_b = option_b + (f"\n\nCOMPANY CONTEXT: {context}" if context else "")

    try:
        mem_a = get_relevant_memories(user_id, option_a) if user_id else ""
        mem_b = get_relevant_memories(user_id, option_b) if user_id else ""
        if mem_a:
            full_a += f"\n\nINSTITUTIONAL MEMORY:\n{mem_a}"
        if mem_b:
            full_b += f"\n\nINSTITUTIONAL MEMORY:\n{mem_b}"
    except Exception as e:
        print(f"Memory retrieval error: {e}")

    def generate():
        yield "retry: 120000\n\n"
        yield sse_event("comparison_status", {"scenario": "A", "status": "starting", "label": option_a})
        yield sse_event("comparison_status", {"scenario": "B", "status": "starting", "label": option_b})
        yield sse_event("phase", {"phase": "scenario_a_research", "scenario": "A"})
        yield sse_event("phase", {"phase": "scenario_b_research", "scenario": "B"})

        def hb():
            return sse_event("heartbeat", {"ts": time.time()})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "researching Option A", "scenario": "A"})
        task_cfo_a = run_research_cfo(full_a)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "research", "scenario": "A", "text": task_cfo_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "researching Option B", "scenario": "B"})
        task_cfo_b = run_research_cfo(full_b)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "research", "scenario": "B", "text": task_cfo_b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "researching market data for Option A", "scenario": "A"})
        task_cmo_a = run_research_cmo(full_a)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "research", "scenario": "A", "text": task_cmo_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "researching market data for Option B", "scenario": "B"})
        task_cmo_b = run_research_cmo(full_b)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "research", "scenario": "B", "text": task_cmo_b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "researching regulations for Option A", "scenario": "A"})
        task_legal_a = run_research_legal(full_a)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "research", "scenario": "A", "text": task_legal_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "researching regulations for Option B", "scenario": "B"})
        task_legal_b = run_research_legal(full_b)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "research", "scenario": "B", "text": task_legal_b.output.raw})

        yield sse_event("phase", {"phase": "scenario_a_debate1", "scenario": "A", "round": 1})
        yield sse_event("phase", {"phase": "scenario_b_debate1", "scenario": "B", "round": 1})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "opening statement for Option A", "scenario": "A"})
        debate_cfo_a = run_debate1_cfo(full_a, task_cfo_a, task_cmo_a, task_legal_a)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 1, "scenario": "A", "text": debate_cfo_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "opening statement for Option B", "scenario": "B"})
        debate_cfo_b = run_debate1_cfo(full_b, task_cfo_b, task_cmo_b, task_legal_b)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 1, "scenario": "B", "text": debate_cfo_b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "opening statement for Option A", "scenario": "A"})
        debate_cmo_a = run_debate1_cmo(full_a, task_cfo_a, task_cmo_a, task_legal_a, debate_cfo_a)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 1, "scenario": "A", "text": debate_cmo_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "opening statement for Option B", "scenario": "B"})
        debate_cmo_b = run_debate1_cmo(full_b, task_cfo_b, task_cmo_b, task_legal_b, debate_cfo_b)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 1, "scenario": "B", "text": debate_cmo_b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "opening statement for Option A", "scenario": "A"})
        debate_legal_a = run_debate1_legal(full_a, task_cfo_a, task_cmo_a, task_legal_a, debate_cfo_a, debate_cmo_a)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 1, "scenario": "A", "text": debate_legal_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "opening statement for Option B", "scenario": "B"})
        debate_legal_b = run_debate1_legal(full_b, task_cfo_b, task_cmo_b, task_legal_b, debate_cfo_b, debate_cmo_b)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 1, "scenario": "B", "text": debate_legal_b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "challenges for Option A", "scenario": "A"})
        debate_da_a = run_debate1_da(full_a, task_cfo_a, task_cmo_a, task_legal_a, debate_cfo_a, debate_cmo_a, debate_legal_a)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 1, "scenario": "A", "text": debate_da_a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "challenges for Option B", "scenario": "B"})
        debate_da_b = run_debate1_da(full_b, task_cfo_b, task_cmo_b, task_legal_b, debate_cfo_b, debate_cmo_b, debate_legal_b)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 1, "scenario": "B", "text": debate_da_b.output.raw})

        # ── HITL ──
        yield sse_event("pause", {"round": 1, "scenario": "BOTH", "prompt": "Both options have completed Round 1. Share your thoughts."})
        elapsed = 0
        while "human_input" not in comparisons_info[comparison_id]:
            yield sse_event("heartbeat", {"waiting": True})
            time.sleep(2)
            elapsed += 2
            if elapsed >= 300:
                break

        human_input = comparisons_info[comparison_id].pop("human_input", "")
        target_agent = comparisons_info[comparison_id].pop("target_agent", "all")
        yield sse_event("resume", {"message": "Debate continuing for both options"})

        if target_agent == "all" or not human_input:
            cfo_input = cmo_input = legal_input = da_input = human_input
        else:
            direct = f"The human decision-maker has DIRECTLY CHALLENGED YOU: '{human_input}'. Respond FIRST."
            observe = f"The human challenged the {target_agent} with: '{human_input}'. Adjust if needed."
            cfo_input = direct if target_agent == "CFO" else observe
            cmo_input = direct if target_agent == "CMO" else observe
            legal_input = direct if target_agent == "Legal" else observe
            da_input = direct if target_agent == "Devils Advocate" else observe

        # ── Round 2 ──
        yield sse_event("phase", {"phase": "scenario_a_debate2", "scenario": "A", "round": 2})
        yield sse_event("phase", {"phase": "scenario_b_debate2", "scenario": "B", "round": 2})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "rebuttal for Option A", "scenario": "A"})
        debate_cfo_2a = run_debate2_cfo(full_a, debate_cfo_a, debate_cmo_a, debate_legal_a, debate_da_a, cfo_input)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 2, "scenario": "A", "text": debate_cfo_2a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "rebuttal for Option B", "scenario": "B"})
        debate_cfo_2b = run_debate2_cfo(full_b, debate_cfo_b, debate_cmo_b, debate_legal_b, debate_da_b, cfo_input)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "debate", "round": 2, "scenario": "B", "text": debate_cfo_2b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "rebuttal for Option A", "scenario": "A"})
        debate_cmo_2a = run_debate2_cmo(full_a, debate_cfo_a, debate_cmo_a, debate_legal_a, debate_da_a, debate_cfo_2a, cmo_input)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 2, "scenario": "A", "text": debate_cmo_2a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "rebuttal for Option B", "scenario": "B"})
        debate_cmo_2b = run_debate2_cmo(full_b, debate_cfo_b, debate_cmo_b, debate_legal_b, debate_da_b, debate_cfo_2b, cmo_input)
        yield sse_event("agent_message", {"agent": "CMO", "phase": "debate", "round": 2, "scenario": "B", "text": debate_cmo_2b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "rebuttal for Option A", "scenario": "A"})
        debate_legal_2a = run_debate2_legal(full_a, debate_cfo_a, debate_cmo_a, debate_legal_a, debate_da_a, debate_cfo_2a, debate_cmo_2a, legal_input)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 2, "scenario": "A", "text": debate_legal_2a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "rebuttal for Option B", "scenario": "B"})
        debate_legal_2b = run_debate2_legal(full_b, debate_cfo_b, debate_cmo_b, debate_legal_b, debate_da_b, debate_cfo_2b, debate_cmo_2b, legal_input)
        yield sse_event("agent_message", {"agent": "Legal", "phase": "debate", "round": 2, "scenario": "B", "text": debate_legal_2b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "final challenge for Option A", "scenario": "A"})
        debate_da_2a = run_debate2_da(full_a, debate_cfo_a, debate_cmo_a, debate_legal_a, debate_da_a, debate_cfo_2a, debate_cmo_2a, debate_legal_2a, da_input)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 2, "scenario": "A", "text": debate_da_2a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "final challenge for Option B", "scenario": "B"})
        debate_da_2b = run_debate2_da(full_b, debate_cfo_b, debate_cmo_b, debate_legal_b, debate_da_b, debate_cfo_2b, debate_cmo_2b, debate_legal_2b, da_input)
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "debate", "round": 2, "scenario": "B", "text": debate_da_2b.output.raw})

        # ── Round 3 ──
        yield sse_event("phase", {"phase": "scenario_a_debate3", "scenario": "A", "round": 3})
        yield sse_event("phase", {"phase": "scenario_b_debate3", "scenario": "B", "round": 3})

        all_r3_a = [debate_cfo_a, debate_cmo_a, debate_legal_a, debate_da_a, debate_cfo_2a, debate_cmo_2a, debate_legal_2a, debate_da_2a]
        all_r3_b = [debate_cfo_b, debate_cmo_b, debate_legal_b, debate_da_b, debate_cfo_2b, debate_cmo_2b, debate_legal_2b, debate_da_2b]

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "final position on Option A", "scenario": "A"})
        debate_cfo_3a = run_debate3_cfo(full_a, all_r3_a)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "final", "round": 3, "scenario": "A", "text": debate_cfo_3a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CFO", "action": "final position on Option B", "scenario": "B"})
        debate_cfo_3b = run_debate3_cfo(full_b, all_r3_b)
        yield sse_event("agent_message", {"agent": "CFO", "phase": "final", "round": 3, "scenario": "B", "text": debate_cfo_3b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "final position on Option A", "scenario": "A"})
        debate_cmo_3a = run_debate3_cmo(full_a, all_r3_a + [debate_cfo_3a])
        yield sse_event("agent_message", {"agent": "CMO", "phase": "final", "round": 3, "scenario": "A", "text": debate_cmo_3a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "CMO", "action": "final position on Option B", "scenario": "B"})
        debate_cmo_3b = run_debate3_cmo(full_b, all_r3_b + [debate_cfo_3b])
        yield sse_event("agent_message", {"agent": "CMO", "phase": "final", "round": 3, "scenario": "B", "text": debate_cmo_3b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "final position on Option A", "scenario": "A"})
        debate_legal_3a = run_debate3_legal(full_a, all_r3_a + [debate_cfo_3a, debate_cmo_3a])
        yield sse_event("agent_message", {"agent": "Legal", "phase": "final", "round": 3, "scenario": "A", "text": debate_legal_3a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Legal", "action": "final position on Option B", "scenario": "B"})
        debate_legal_3b = run_debate3_legal(full_b, all_r3_b + [debate_cfo_3b, debate_cmo_3b])
        yield sse_event("agent_message", {"agent": "Legal", "phase": "final", "round": 3, "scenario": "B", "text": debate_legal_3b.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "final challenge on Option A", "scenario": "A"})
        debate_da_3a = run_debate3_da(full_a, all_r3_a + [debate_cfo_3a, debate_cmo_3a, debate_legal_3a])
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "final", "round": 3, "scenario": "A", "text": debate_da_3a.output.raw})

        yield hb()
        yield sse_event("agent_start", {"agent": "Devils Advocate", "action": "final challenge on Option B", "scenario": "B"})
        debate_da_3b = run_debate3_da(full_b, all_r3_b + [debate_cfo_3b, debate_cmo_3b, debate_legal_3b])
        yield sse_event("agent_message", {"agent": "Devils Advocate", "phase": "final", "round": 3, "scenario": "B", "text": debate_da_3b.output.raw})

        # ── Moderator ──
        yield sse_event("phase", {"phase": "scenario_a_synthesis", "scenario": "A"})
        all_mod_a = all_r3_a + [debate_cfo_3a, debate_cmo_3a, debate_legal_3a, debate_da_3a]
        yield hb()
        yield sse_event("agent_start", {"agent": "Moderator", "action": "synthesizing Option A debate", "scenario": "A"})
        moderator_a = run_moderator(full_a, all_mod_a)
        yield sse_event("agent_message", {"agent": "Moderator", "phase": "synthesis", "scenario": "A", "text": moderator_a.output.raw})

        votes_a = {"CFO": parse_vote(debate_cfo_3a), "CMO": parse_vote(debate_cmo_3a), "Legal": parse_vote(debate_legal_3a), "Devils Advocate": parse_vote(debate_da_3a)}
        yield sse_event("comparison_status", {"scenario": "A", "status": "complete", "votes": votes_a})

        yield sse_event("phase", {"phase": "scenario_b_synthesis", "scenario": "B"})
        all_mod_b = all_r3_b + [debate_cfo_3b, debate_cmo_3b, debate_legal_3b, debate_da_3b]
        yield hb()
        yield sse_event("agent_start", {"agent": "Moderator", "action": "synthesizing Option B debate", "scenario": "B"})
        moderator_b = run_moderator(full_b, all_mod_b)
        yield sse_event("agent_message", {"agent": "Moderator", "phase": "synthesis", "scenario": "B", "text": moderator_b.output.raw})

        votes_b = {"CFO": parse_vote(debate_cfo_3b), "CMO": parse_vote(debate_cmo_3b), "Legal": parse_vote(debate_legal_3b), "Devils Advocate": parse_vote(debate_da_3b)}
        yield sse_event("comparison_status", {"scenario": "B", "status": "complete", "votes": votes_b})

        result_a = {"moderator": moderator_a.output.raw, "votes": votes_a}
        result_b = {"moderator": moderator_b.output.raw, "votes": votes_b}

        yield sse_event("phase", {"phase": "comparative_analysis"})
        yield sse_event("agent_start", {"agent": "Comparison Analyst", "action": "generating comparative analysis"})

        comparison_task = run_comparative_analysis(
            question_context=f"{option_a} vs {option_b}" + (f"\nContext: {context}" if context else ""),
            option_a_label=option_a[:80],
            option_b_label=option_b[:80],
            moderator_a_text=result_a["moderator"],
            moderator_b_text=result_b["moderator"],
            votes_a=result_a["votes"],
            votes_b=result_b["votes"],
        )
        comparison_text = comparison_task.output.raw
        yield sse_event("agent_message", {"agent": "Comparison Analyst", "phase": "comparative_analysis", "text": comparison_text})

        generate_comparison_pdf(
            option_a=option_a, option_b=option_b,
            result_a={"moderator": moderator_a.output.raw, "votes": votes_a,
                      "research": {"CFO": task_cfo_a.output.raw, "CMO": task_cmo_a.output.raw, "Legal": task_legal_a.output.raw},
                      "debate_r1": {"CFO": debate_cfo_a.output.raw, "CMO": debate_cmo_a.output.raw, "Legal": debate_legal_a.output.raw, "Devils Advocate": debate_da_a.output.raw},
                      "debate_r2": {"CFO": debate_cfo_2a.output.raw, "CMO": debate_cmo_2a.output.raw, "Legal": debate_legal_2a.output.raw, "Devils Advocate": debate_da_2a.output.raw},
                      "final_positions": {"CFO": debate_cfo_3a.output.raw, "CMO": debate_cmo_3a.output.raw, "Legal": debate_legal_3a.output.raw, "Devils Advocate": debate_da_3a.output.raw}},
            result_b={"moderator": moderator_b.output.raw, "votes": votes_b,
                      "research": {"CFO": task_cfo_b.output.raw, "CMO": task_cmo_b.output.raw, "Legal": task_legal_b.output.raw},
                      "debate_r1": {"CFO": debate_cfo_b.output.raw, "CMO": debate_cmo_b.output.raw, "Legal": debate_legal_b.output.raw, "Devils Advocate": debate_da_b.output.raw},
                      "debate_r2": {"CFO": debate_cfo_2b.output.raw, "CMO": debate_cmo_2b.output.raw, "Legal": debate_legal_2b.output.raw, "Devils Advocate": debate_da_2b.output.raw},
                      "final_positions": {"CFO": debate_cfo_3b.output.raw, "CMO": debate_cmo_3b.output.raw, "Legal": debate_legal_3b.output.raw, "Devils Advocate": debate_da_3b.output.raw}},
            comparison_text=comparison_text,
            comparison_id=comparison_id,
        )
        yield sse_event("brief_ready", {"download_url": f"/api/{comparison_id}/download_comparison_pdf"})

        save_comparison(
            comparison_id=comparison_id, user_id=user_id,
            option_a=option_a, option_b=option_b, context=context,
            board_type=board_type, votes_a=votes_a, votes_b=votes_b,
            comparison_summary=comparison_text[:3000],
        )

        try:
            save_debate_memory(user_id, option_a, votes_a, moderator_a.output.raw, board_type)
            save_debate_memory(user_id, option_b, votes_b, moderator_b.output.raw, board_type)
        except Exception as e:
            print(f"Supermemory save error: {e}")

        try:
            send_slack_notification(
                f"[COMPARISON] {option_a} vs {option_b}",
                {**{f"A-{k}": v for k, v in votes_a.items()}, **{f"B-{k}": v for k, v in votes_b.items()}},
                comparison_text,
            )
            yield sse_event("slack_sent", {"message": "Slack notification sent"})
        except Exception as e:
            print(f"Slack notification error: {e}")

        yield sse_event("complete", {"message": "Scenario comparison complete"})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/{comparison_id}/comparison_human_input")
def comparison_human_input_endpoint(
    comparison_id: str,
    request: HumanInput,
    current_user: dict = Depends(get_current_user),
):
    comparisons_info[comparison_id]["human_input"] = request.human_ip
    comparisons_info[comparison_id]["target_agent"] = request.target_agent
    return {"status": "received"}


@app.get("/api/{comparison_id}/download_comparison_pdf")
def download_comparison_pdf(comparison_id: str, current_user: dict = Depends(get_current_user)):
    filepath = f"reports/comparison_{comparison_id}.pdf"
    return FileResponse(filepath, filename="Shadow_Board_Scenario_Comparison.pdf")


# ── Speech-to-text ────────────────────────────────────────────────────────────

from openai import OpenAI
import os
import tempfile

@app.post("/api/speech-to-text")
async def speech_to_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return {"error": "OPENAI_API_KEY not configured"}

    content = await file.read()
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        client = OpenAI(api_key=openai_key)
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1", file=audio_file, language="en"
            )
        return {"text": transcript.text}
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.unlink(tmp_path)


# ── AIRIA chat proxy ──────────────────────────────────────────────────────────

AIRIA_EMBED_API = "https://embed-api.airia.ai"
AIRIA_PIPELINE_ID = os.getenv("AIRIA_PIPELINE_ID", "").strip()
AIRIA_WIDGET_API_KEY = os.getenv("AIRIA_WIDGET_API_KEY", "").strip()

@app.get("/api/airia-config")
def get_airia_config():
    return {"pipelineId": AIRIA_PIPELINE_ID, "apiKey": AIRIA_WIDGET_API_KEY, "apiUrl": AIRIA_EMBED_API}

@app.post("/api/chat")
def airia_chat(request: ChatRequest):
    import requests as http_requests

    messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in request.history]
    messages.append({"role": "user", "content": request.message})
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {AIRIA_WIDGET_API_KEY}", "X-API-Key": AIRIA_WIDGET_API_KEY}
    payload = {"model": AIRIA_PIPELINE_ID, "messages": messages}

    for url in [f"{AIRIA_EMBED_API}/v1/chat/completions", f"{AIRIA_EMBED_API}/api/v1/chat/completions"]:
        try:
            resp = http_requests.post(url, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                reply = data.get("choices", [{}])[0].get("message", {}).get("content") or data.get("result") or str(data)
                return {"reply": reply}
        except Exception:
            continue

    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": "You are a helpful AI assistant for the Shadow Board platform."}, *messages],
                max_tokens=500,
            )
            return {"reply": response.choices[0].message.content}
    except Exception as e:
        return {"reply": f"I'm having trouble connecting right now. ({str(e)[:100]})"}
