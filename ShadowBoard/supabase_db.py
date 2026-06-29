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
                user_id: str | None = None, rating: int = 5) -> None:
    try:
        _client().table("reviews").insert({
            "review_id": review_id,
            "user_id": user_id,
            "reviewer_name": reviewer_name,
            "rating": max(1, min(5, rating)),
            "review_text": review_text[:2000],
        }).execute()
    except Exception as e:
        print(f"[supabase_db] save_review error: {e}")


def get_reviews(limit: int = 10, offset: int = 0) -> dict:
    try:
        resp = (
            _client()
            .table("reviews")
            .select("review_id, user_id, reviewer_name, review_text, rating, helpful_count, created_at", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"reviews": resp.data or [], "total": resp.count or 0}
    except Exception as e:
        print(f"[supabase_db] get_reviews error: {e}")
        return {"reviews": [], "total": 0}


def delete_review(review_id: str, user_id: str) -> bool:
    try:
        resp = (
            _client()
            .table("reviews")
            .delete()
            .eq("review_id", review_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(resp.data)
    except Exception as e:
        print(f"[supabase_db] delete_review error: {e}")
        return False


def update_review(review_id: str, user_id: str, review_text: str, rating: int) -> dict | None:
    try:
        resp = (
            _client()
            .table("reviews")
            .update({
                "review_text": review_text[:2000],
                "rating": max(1, min(5, rating)),
            })
            .eq("review_id", review_id)
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"[supabase_db] update_review error: {e}")
        return None


def get_review_stats() -> dict:
    try:
        resp = (
            _client()
            .table("reviews")
            .select("rating")
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return {"avg_rating": 0.0, "total": 0, "distribution": {}}
        total = len(rows)
        avg = sum(r["rating"] for r in rows) / total
        distribution = {}
        for r in rows:
            key = str(r["rating"])
            distribution[key] = distribution.get(key, 0) + 1
        return {"avg_rating": round(avg, 1), "total": total, "distribution": distribution}
    except Exception as e:
        print(f"[supabase_db] get_review_stats error: {e}")
        return {"avg_rating": 0.0, "total": 0, "distribution": {}}


# ── Profile ───────────────────────────────────────────────────────────────────

def get_profile(user_id: str) -> dict | None:
    try:
        resp = (
            _client()
            .table("profiles")
            .select("id, name, email, created_at")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return resp.data
    except Exception as e:
        print(f"[supabase_db] get_profile error: {e}")
        return None


def upsert_profile(user_id: str, name: str) -> None:
    try:
        _client().table("profiles").upsert({
            "id": user_id,
            "name": name,
        }).execute()
    except Exception as e:
        print(f"[supabase_db] upsert_profile error: {e}")
