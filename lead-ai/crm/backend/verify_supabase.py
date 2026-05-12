#!/usr/bin/env python3
"""
Run this script from your LOCAL machine or server to verify all 15 Supabase tables.
Usage: python3 verify_supabase.py
"""

import os, sys
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL or SUPABASE_KEY not set in .env")
    sys.exit(1)

try:
    from supabase import create_client
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"✅ Connected to: {SUPABASE_URL}\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

EXPECTED_TABLES = [
    "users", "leads", "notes", "activities",
    "hospitals", "courses", "counselors",
    "communication_history", "chat_messages",
    "sla_config", "decay_config", "decay_log",
    "wa_templates", "workflow_rules", "workflow_executions",
]

print(f"{'TABLE':<30} {'STATUS':<12} ROWS")
print("-" * 55)

found, missing = [], []
for table in EXPECTED_TABLES:
    try:
        r = client.table(table).select("*", count="exact").limit(0).execute()
        found.append(table)
        print(f"✅ {table:<28} EXISTS       {r.count}")
    except Exception as e:
        missing.append(table)
        print(f"❌ {table:<28} MISSING      ({e})")

print(f"\n{'='*55}")
print(f"Result: {len(found)}/15 tables OK, {len(missing)} missing")

if missing:
    print(f"\n⚠️  Missing tables: {', '.join(missing)}")
    print("   → Run supabase_setup.sql in Supabase SQL Editor to create them.")
else:
    print("\n✅ All 15 tables present and connected!")

# Check config tables have seed data
print("\n--- Config Check ---")
for cfg_table in ["sla_config", "decay_config"]:
    try:
        r = client.table(cfg_table).select("*").execute()
        if r.data:
            print(f"✅ {cfg_table}: seeded ({len(r.data)} row)")
        else:
            print(f"⚠️  {cfg_table}: EXISTS but EMPTY — run seed insert in supabase_setup.sql")
    except Exception as e:
        print(f"❌ {cfg_table}: {e}")

# Check users seeded
try:
    r = client.table("users").select("id, full_name, role").execute()
    print(f"✅ users: {len(r.data)} users seeded")
    for u in r.data[:3]:
        print(f"   - {u['full_name']} ({u['role']})")
    if len(r.data) > 3:
        print(f"   ... and {len(r.data)-3} more")
except Exception as e:
    print(f"❌ users check failed: {e}")

# Check courses seeded
try:
    r = client.table("courses").select("count", count="exact").limit(0).execute()
    status = "✅" if r.count >= 40 else "⚠️ "
    print(f"{status} courses: {r.count} courses seeded (expect 46)")
except Exception as e:
    print(f"❌ courses check failed: {e}")
