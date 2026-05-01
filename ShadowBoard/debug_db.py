# Debug script to find signup issue
import sqlite3
import os
import uuid
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "shadowboard.db")

def debug_signup(email, password, name):
    print(f"\n=== DEBUG SIGNUP ===")
    print(f"Email: {email}")
    print(f"DB Path: {DB_PATH}")
    print(f"DB Exists: {os.path.exists(DB_PATH)}")
    
    if not os.path.exists(DB_PATH):
        print("❌ Database file does not exist!")
        return None
    
    try:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        
        # Check table exists
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        table = cursor.fetchone()
        print(f"Users table exists: {table is not None}")
        
        if table is None:
            print("❌ Users table does not exist!")
            conn.close()
            return None
        
        # Check if email exists
        existing = conn.execute(
            "SELECT email FROM users WHERE email = ?", (email,)
        ).fetchone()
        print(f"Email exists in DB: {existing is not None}")
        if existing:
            print(f"   Found: {existing['email']}")
            conn.close()
            return None
        
        # Try to insert
        user_id = str(uuid.uuid4())
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        print(f"Attempting insert...")
        print(f"   user_id: {user_id}")
        print(f"   email: {email}")
        print(f"   password_hash: {password_hash[:20]}...")
        print(f"   name: {name}")
        
        conn.execute(
            "INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)",
            (user_id, email, password_hash, name)
        )
        conn.commit()
        
        # Verify insert
        verify = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        print(f"Insert verified: {verify is not None}")
        
        conn.close()
        return {"user_id": user_id, "email": email, "name": name}
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None


# Test with a unique email
if __name__ == "__main__":
    result = debug_signup("debug_test_123456@example.com", "Test@123", "Debug User")
    print(f"\nResult: {result}")