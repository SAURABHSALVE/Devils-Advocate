"""
Supabase database layer — replaces SQLite database.py for all persistence.
Uses the service-role key so RLS is bypassed server-side (safe: key is never
sent to the browser).
"""

import os
from functools import lru_cache
from supabase import create_client, Client


@lru_cache(maxsize=1)
def _client() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


# ── Sessions ──────────────────────────────────────────────────────────────────

def save_session(session_id: str, user_id: str, question: str, context: str,
                 board_type: str, votes: dict, moderator_summary: str) -> None:
    try:
        _client().table("sessions").insert({
            "session_id": session_id,
            "user_id": user_id,
            "question": question,
            "context": context,
            "board_type": board_type,
            "votes": votes,
            "moderator_summary": moderator_summary[:2000],
        }).execute()
    except Exception as e:
        print(f"[supabase_db] save_session error: {e}")


def get_user_sessions(user_id: str) -> list[dict]:
    try:
        resp = (
            _client()
            .table("sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[supabase_db] get_user_sessions error: {e}")
        return []


def get_session(session_id: str) -> dict | None:
    try:
        resp = (
            _client()
            .table("sessions")
            .select("*")
            .eq("session_id", session_id)
            .single()
            .execute()
        )
        return resp.data
    except Exception as e:
        print(f"[supabase_db] get_session error: {e}")
        return None


# ── Comparisons ───────────────────────────────────────────────────────────────

def save_comparison(comparison_id: str, user_id: str, option_a: str,
                    option_b: str, context: str, board_type: str,
                    votes_a: dict, votes_b: dict,
                    comparison_summary: str) -> None:
    try:
        _client().table("comparisons").insert({
            "comparison_id": comparison_id,
            "user_id": user_id,
            "option_a": option_a,
            "option_b": option_b,
            "context": context,
            "board_type": board_type,
            "votes_a": votes_a,
            "votes_b": votes_b,
            "comparison_summary": comparison_summary[:3000],
        }).execute()
    except Exception as e:
        print(f"[supabase_db] save_comparison error: {e}")


# ── Reviews ───────────────────────────────────────────────────────────────────

def save_review(review_id: str, reviewer_name: str, review_text: str,
                user_id: str | None = None, rating: int = 0) -> None:
    try:
        _client().table("reviews").insert({
            "review_id": review_id,
            "user_id": user_id,
            "reviewer_name": reviewer_name,
            "rating": max(0, min(5, rating)),
            "review_text": review_text[:2000],
        }).execute()
    except Exception as e:
        print(f"[supabase_db] save_review error: {e}")


def get_reviews() -> list[dict]:
    try:
        resp = (
            _client()
            .table("reviews")
            .select("review_id, user_id, reviewer_name, review_text, rating, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[supabase_db] get_reviews error: {e}")
        return []


# ── Profile ───────────────────────────────────────────────────────────────────

def get_profile(user_id: str) -> dict | None:
    try:
        resp = (
            _client()
            .table("profiles")
            .select("id, name, avatar_url, created_at")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return resp.data
    except Exception as e:
        print(f"[supabase_db] get_profile error: {e}")
        return None


def upsert_profile(user_id: str, name: str, avatar_url: str = "") -> None:
    try:
        _client().table("profiles").upsert({
            "id": user_id,
            "name": name,
            "avatar_url": avatar_url,
        }).execute()
    except Exception as e:
        print(f"[supabase_db] upsert_profile error: {e}")
