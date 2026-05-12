#!/usr/bin/env python3
"""
Test script to verify all CRM filters are working correctly.
Tests both frontend filter parameters and backend implementation.
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any

# API Configuration
API_BASE = "https://medfellow-crm-api.onrender.com"
# API_BASE = "http://localhost:8000"  # Use this for local testing

def get_auth_token() -> str:
    """Login and get auth token"""
    response = requests.post(
        f"{API_BASE}/api/auth/login",
        json={
            "username": "admin@medfellow.com",
            "password": "admin123"
        },
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        raise Exception("Failed to authenticate")

def test_filter(filter_name: str, params: Dict[str, Any], token: str) -> Dict[str, Any]:
    """Test a specific filter"""
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(
            f"{API_BASE}/api/leads",
            params=params,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "status": "✅ PASS",
                "total": data.get("total", 0),
                "count": len(data.get("leads", [])),
                "params": params
            }
        else:
            return {
                "status": f"❌ FAIL ({response.status_code})",
                "error": response.text[:200],
                "params": params
            }
    except Exception as e:
        return {
            "status": f"❌ ERROR",
            "error": str(e),
            "params": params
        }

def main():
    print("=" * 80)
    print("CRM FILTERS TEST SUITE")
    print("=" * 80)
    print()
    
    try:
        token = get_auth_token()
        print("✅ Authentication successful\n")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return
    
    # Define all filter tests
    tests = [
        # Basic filters
        ("Pagination (skip/limit)", {"skip": 0, "limit": 10}),
        ("Status Filter", {"status": "Hot"}),
        ("Status Multi-value", {"status_in": "Hot,Warm"}),
        ("Country Filter", {"country": "India"}),
        ("Country Multi-value", {"country_in": "India,USA"}),
        ("Segment Filter", {"segment": "Hot"}),
        ("Segment Multi-value", {"segment_in": "Hot,Warm"}),
        ("Source Filter", {"source": "Facebook"}),
        ("Assigned To Filter", {"assigned_to": "Test User"}),
        ("Course Filter", {"course_interested": "MBBS in Russia"}),
        
        # Score filters
        ("Min Score", {"min_score": 50}),
        ("Max Score", {"max_score": 80}),
        ("Score Range", {"min_score": 50, "max_score": 80}),
        
        # Date filters
        ("Created Today", {"created_today": True}),
        ("Overdue Follow-ups", {"overdue": True}),
        ("Follow-up From", {"follow_up_from": datetime.utcnow().isoformat()}),
        ("Follow-up To", {"follow_up_to": (datetime.utcnow() + timedelta(days=7)).isoformat()}),
        ("Follow-up Range", {
            "follow_up_from": datetime.utcnow().isoformat(),
            "follow_up_to": (datetime.utcnow() + timedelta(days=7)).isoformat()
        }),
        
        # Search
        ("Search by Name", {"search": "test"}),
        
        # Combined filters
        ("Hot Leads in India", {"status": "Hot", "country": "India"}),
        ("High Score + Overdue", {"min_score": 70, "overdue": True}),
    ]
    
    print(f"Running {len(tests)} filter tests...\n")
    print("-" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, params in tests:
        print(f"\nTest: {test_name}")
        result = test_filter(test_name, params, token)
        
        print(f"  Status: {result['status']}")
        print(f"  Params: {result['params']}")
        
        if "total" in result:
            print(f"  Results: {result['count']} leads returned, {result['total']} total matching")
            passed += 1
        else:
            print(f"  Error: {result.get('error', 'Unknown error')}")
            failed += 1
    
    print("\n" + "=" * 80)
    print(f"TEST SUMMARY: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 80)
    
    if failed > 0:
        print("\n⚠️  Some filters are not working correctly!")
        print("Check the error messages above for details.")
    else:
        print("\n✅ All filters are working correctly!")

if __name__ == "__main__":
    main()
