"""
Database configuration - SUPABASE ONLY
NO LOCAL DATABASE - All operations use Supabase REST API
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration - REQUIRED
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def validate_supabase_config():
    """
    Validate that Supabase is properly configured.
    This application REQUIRES Supabase - no local database support.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "❌ SUPABASE_URL and SUPABASE_KEY must be set in environment variables.\n"
            "This application requires Supabase and does not support local databases.\n"
            "Please configure your Supabase credentials in .env file.\n"
            "Example:\n"
            "  SUPABASE_URL=https://xxxxx.supabase.co\n"
            "  SUPABASE_KEY=your-anon-key-here"
        )
    print("✅ Supabase configured - All data operations use Supabase REST API")
    return True

# Validate on import
validate_supabase_config()

# DEPRECATED: get_db() removed - use supabase_data from supabase_data_layer.py instead
# All endpoints must use Supabase REST API via supabase_data_layer.SupabaseDataLayer
