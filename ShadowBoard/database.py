import os
import sqlite3
import uuid
import hashlib
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "shadowboard.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            question TEXT NOT NULL,
            context TEXT DEFAULT '',
            board_type TEXT DEFAULT 'tech',
            votes TEXT DEFAULT '{}',
            moderator_summary TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS comparisons (
            comparison_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            context TEXT DEFAULT '',
            board_type TEXT DEFAULT 'tech',
            votes_a TEXT DEFAULT '{}',
            votes_b TEXT DEFAULT '{}',
            comparison_summary TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    """)
    conn.commit()
    conn.close()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def signup_user(email, password, name):
    try:
        conn = get_db()
        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)",
            (user_id, email, _hash_password(password), name)
        )
        conn.commit()
        conn.close()
        return {"user_id": user_id, "email": email, "name": name}
    except sqlite3.IntegrityError:
        return None
    except Exception as e:
        print(f"Signup error: {e}")
        return None


def login_user(email, password):
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT user_id, email, name FROM users WHERE email = ? AND password_hash = ?",
            (email, _hash_password(password))
        ).fetchone()
        conn.close()
        if row:
            return {"user_id": row["user_id"], "email": row["email"], "name": row["name"]}
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None


def save_session(session_id, user_id, question, context, board_type, votes, moderator_summary):
    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO sessions (session_id, user_id, question, context, board_type, votes, moderator_summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, question, context, board_type, json.dumps(votes), moderator_summary[:2000])
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Save session error: {e}")


def get_user_sessions(user_id):
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        conn.close()
        results = []
        for row in rows:
            d = dict(row)
            d["votes"] = json.loads(d.get("votes", "{}"))
            results.append(d)
        return results
    except Exception as e:
        print(f"Get sessions error: {e}")
        return []


def get_session(session_id):
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        conn.close()
        if row:
            d = dict(row)
            d["votes"] = json.loads(d.get("votes", "{}"))
            return d
        return None
    except Exception as e:
        print(f"Get session error: {e}")
        return None


def save_comparison(comparison_id, user_id, option_a, option_b, context,
                    board_type, votes_a, votes_b, comparison_summary):
    """Save a scenario comparison session."""
    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO comparisons (comparison_id, user_id, option_a, option_b, context, board_type, votes_a, votes_b, comparison_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (comparison_id, user_id, option_a, option_b, context, board_type,
             json.dumps(votes_a), json.dumps(votes_b), comparison_summary[:3000])
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Save comparison error: {e}")


def save_review(review_id, reviewer_name, review_text, user_id=None, rating=0):
    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO reviews (review_id, user_id, reviewer_name, rating, review_text) VALUES (?, ?, ?, ?, ?)",
            (review_id, user_id, reviewer_name, rating, review_text[:2000])
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Save review error: {e}")


def get_reviews():
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT review_id, user_id, reviewer_name, review_text, created_at FROM reviews ORDER BY created_at DESC"
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Get reviews error: {e}")
        return []


