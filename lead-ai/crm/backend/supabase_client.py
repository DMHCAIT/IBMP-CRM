"""
Database Integration Module - Supabase Cloud Database
"""

import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from logger_config import logger

# Load environment variables
load_dotenv()

class SupabaseManager:
    """Database manager - Supabase Cloud"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.client: Optional[Client] = None
        
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                logger.info("✅ Supabase client initialized successfully", extra={"system": "database"})
            except Exception as e:
                logger.error(f"❌ Failed to initialize Supabase client: {e}", extra={"system": "database"})
                self.client = None
        else:
            logger.warning("⚠️ SUPABASE_URL or SUPABASE_KEY not found", extra={"system": "database"})
    
    def get_client(self) -> Optional[Client]:
        """Get Supabase client instance"""
        return self.client
    
    async def test_connection(self) -> bool:
        """Test database connection"""
        if not self.client:
            return False
        try:
            # Simple test query
            response = self.client.table('leads').select("count", count='exact').limit(0).execute()
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}", extra={"system": "database"})
            return False
    
    def get_database_url(self) -> str:
        """Get database connection string"""
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            logger.info("✅ Using Supabase PostgreSQL database", extra={"system": "database"})
            return db_url
        else:
            logger.warning("⚠️ DATABASE_URL not found, falling back to SQLite", extra={"system": "database"})
            return "sqlite:///./crm_database.db"


# Global instance
supabase_manager = SupabaseManager()

logger.info("💾 Supabase database integration module loaded", extra={"system": "database"})
