"""
Shared FastAPI dependencies - SUPABASE ONLY
NO LOCAL DATABASE SUPPORT
"""

from fastapi import HTTPException


def get_db():
    """
    DEPRECATED: This application uses Supabase only.
    
    This function exists for legacy compatibility but should not be used.
    All endpoints must use supabase_data from supabase_data_layer.py
    
    Raises HTTPException if called.
    """
    raise HTTPException(
        status_code=500,
        detail="Local database not supported. Use Supabase REST API via supabase_data_layer.py"
    )
