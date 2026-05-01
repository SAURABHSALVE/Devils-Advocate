# Auth Test Script
# Run with: python test_auth.py

import requests
import json
import time
import uuid
import random
import string

BASE_URL = "http://127.0.0.1:8000"  # Change to your deployed URL

def generate_unique_email(prefix="test"):
    """Generate a truly unique email using timestamp + random string."""
    timestamp = int(time.time() * 1000)  # milliseconds
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{prefix}_{timestamp}_{random_suffix}@example.com"


def print_result(test_name, response, expected_status, expect_success=None):
    """Test result validator.
    
    Args:
        expect_success: True = expect "success" status, False = expect "error" status, None = don't check content
    """
    data = response.json()
    http_ok = response.status_code == expected_status
    
    # Check content expectation
    content_ok = True
    if expect_success is not None:
        if expect_success:
            content_ok = data.get("status") == "success"
        else:
            content_ok = data.get("status") == "error"
    
    passed = http_ok and content_ok
    status = "✅ PASS" if passed else "❌ FAIL"
    
    print(f"\n{status} | {test_name}")
    print(f"   HTTP Status: {response.status_code} (expected: {expected_status})")
    print(f"   Response: {data}")
    if expect_success is not None:
        expected_str = "success" if expect_success else "error"
        print(f"   Content: expect '{expected_str}', got '{data.get('status')}'")
    return passed


def test_signup_new_user():
    """Test 1: Signup with a new email (should succeed)"""
    print("\n" + "="*50)
    print("TEST 1: Signup with NEW email")
    print("="*50)
    
    payload = {
        "email": generate_unique_email("brandnew"),
        "password": "Test@123",
        "name": "Test User"
    }
    print(f"   Using email: {payload['email']}")
    
    response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
    return print_result("Signup new user", response, 200, expect_success=True)


def test_signup_existing_user():
    """Test 2: Signup with existing email (should fail)"""
    print("\n" + "="*50)
    print("TEST 2: Signup with EXISTING email")
    print("="*50)
    
    # First create a user
    email = generate_unique_email("existing")
    signup_payload = {
        "email": email,
        "password": "Test@123",
        "name": "Existing User"
    }
    print(f"   Using email: {email}")
    requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
    time.sleep(0.5)  # Small delay to ensure DB commit
    
    # Try to signup again with same email - should FAIL
    response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
    return print_result("Signup existing user (should fail)", response, 200, expect_success=False)


def test_login_valid():
    """Test 3: Login with valid credentials (should succeed)"""
    print("\n" + "="*50)
    print("TEST 3: Login with VALID credentials")
    print("="*50)
    
    # First signup
    email = generate_unique_email("valid")
    signup_payload = {
        "email": email,
        "password": "Test@123",
        "name": "Valid User"
    }
    print(f"   Using email: {email}")
    signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
    print(f"   Signup response: {signup_resp.json()}")
    time.sleep(0.5)  # Small delay to ensure DB commit
    
    # Now login
    login_payload = {
        "email": email,
        "password": "Test@123"
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    print(f"   Login response: {response.json()}")
    return print_result("Login valid credentials", response, 200, expect_success=True)


def test_login_invalid_password():
    """Test 4: Login with wrong password (should fail)"""
    print("\n" + "="*50)
    print("TEST 4: Login with WRONG password")
    print("="*50)
    
    # First signup
    email = generate_unique_email("wrongpass")
    signup_payload = {
        "email": email,
        "password": "CorrectPass@123",
        "name": "Wrong Pass User"
    }
    print(f"   Using email: {email}")
    requests.post(f"{BASE_URL}/api/auth/signup", json=signup_payload)
    time.sleep(0.5)
    
    # Login with wrong password - should FAIL
    login_payload = {
        "email": email,
        "password": "WrongPass@456"
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    return print_result("Login wrong password", response, 200, expect_success=False)


def test_login_nonexistent():
    """Test 5: Login with non-existent email (should fail)"""
    print("\n" + "="*50)
    print("TEST 5: Login with NON-EXISTENT email")
    print("="*50)
    
    email = generate_unique_email("nonexistent")
    print(f"   Using email: {email}")
    login_payload = {
        "email": email,
        "password": "AnyPassword@123"
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    return print_result("Login nonexistent user", response, 200, expect_success=False)


def test_signup_invalid_email():
    """Test 6: Signup with invalid email format"""
    print("\n" + "="*50)
    print("TEST 6: Signup with INVALID email format")
    print("="*50)
    
    # Use timestamp to make unique
    timestamp = int(time.time() * 1000)
    payload = {
        "email": f"not-an-email_{timestamp}",  # No @ symbol - invalid
        "password": "Test@123",
        "name": "Invalid Email User"
    }
    print(f"   Using email: {payload['email']}")
    response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
    data = response.json()
    
    print(f"\n   Status: {response.status_code}")
    print(f"   Response: {data}")
    
    # Now it should say "Invalid email format" instead of "Email already exists"
    if data.get("message") == "Invalid email format":
        print(f"   ✅ Correctly rejected invalid email format")
        return True
    else:
        print(f"   ❌ Should have said 'Invalid email format'")
        return False


def run_all_tests():
    print("\n" + "="*60)
    print("🧪 SHADOW BOARD AUTH TEST SUITE")
    print("="*60)
    
    results = []
    
    results.append(("Signup New User", test_signup_new_user()))
    results.append(("Signup Existing User", test_signup_existing_user()))
    results.append(("Login Valid", test_login_valid()))
    results.append(("Login Wrong Password", test_login_invalid_password()))
    results.append(("Login Non-existent", test_login_nonexistent()))
    results.append(("Signup Invalid Email", test_signup_invalid_email()))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status} | {name}")
    
    print(f"\n   Total: {passed}/{total} tests passed")
    print("="*60)
    
    # Analysis
    print("\n📋 ANALYSIS:")
    if passed == total:
        print("   ✅ All tests passed! Auth system is working correctly.")
    else:
        print("   ⚠️  Some tests failed. Check the results above.")
    
    return passed == total


if __name__ == "__main__":
    run_all_tests()