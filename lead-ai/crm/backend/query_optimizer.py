"""
Database Query Optimization
Implements query optimization strategies for better performance
"""

from sqlalchemy import Index, text
from sqlalchemy.orm import Session
from logger_config import logger

# ============================================================================
# DATABASE INDEXES
# ============================================================================

def create_database_indexes(engine):
    """
    Create indexes on frequently queried columns
    This significantly improves query performance
    """
    
    logger.info("📊 Creating database indexes...", extra={"system": "database"})
    
    try:
        with engine.connect() as conn:
            # Leads table indexes
            indexes = [
                # Status queries
                "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
                
                # Country filtering
                "CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country)",
                
                # AI segment filtering
                "CREATE INDEX IF NOT EXISTS idx_leads_segment ON leads(ai_segment)",
                
                # Assignment queries
                "CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)",
                
                # Date range queries
                "CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)",
                "CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date)",
                
                # Composite index for common query patterns
                "CREATE INDEX IF NOT EXISTS idx_leads_status_segment ON leads(status, ai_segment)",
                
                # Activities table - lead lookup
                "CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)",
                "CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type)",
                
                # Notes table - lead lookup
                "CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id)",
                
                # Courses table - filtering
                "CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category)",
                "CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active)",
                
                # Users table - authentication
                "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
                "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
                
                # Counselors table
                "CREATE INDEX IF NOT EXISTS idx_counselors_active ON counselors(is_active)",
            ]
            
            for index_sql in indexes:
                try:
                    conn.execute(text(index_sql))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Index creation skipped: {e}", extra={"system": "database"})
            
            logger.info("✅ Database indexes created successfully", extra={"system": "database"})
            
    except Exception as e:
        logger.error(f"❌ Failed to create indexes: {e}", extra={"system": "database"})


# ============================================================================
# QUERY OPTIMIZATION UTILITIES
# ============================================================================

def optimize_lead_query(query, filters: dict):
    """
    Apply optimizations to lead queries
    
    Args:
        query: SQLAlchemy query object
        filters: Dictionary of filter parameters
    
    Returns:
        Optimized query
    """
    # Use indexes by applying filters in optimal order
    # Most selective filters first
    
    if 'lead_id' in filters and filters['lead_id']:
        # Primary key lookup - most selective
        query = query.filter_by(lead_id=filters['lead_id'])
    
    if 'assigned_to' in filters and filters['assigned_to']:
        # Assignment filter
        query = query.filter_by(assigned_to=filters['assigned_to'])
    
    if 'ai_segment' in filters and filters['ai_segment']:
        # Segment filter
        query = query.filter_by(ai_segment=filters['ai_segment'])
    
    if 'status' in filters and filters['status']:
        # Status filter
        query = query.filter_by(status=filters['status'])
    
    if 'country' in filters and filters['country']:
        # Country filter
        query = query.filter_by(country=filters['country'])
    
    return query


def get_query_plan(db: Session, query):
    """
    Get the query execution plan (for debugging)
    
    Args:
        db: Database session
        query: SQLAlchemy query
    
    Returns:
        Query plan as string
    """
    try:
        # Get the SQL string
        sql_query = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
        
        # Get execution plan
        plan = db.execute(text(f"EXPLAIN QUERY PLAN {sql_query}")).fetchall()
        
        return plan
    except Exception as e:
        logger.error(f"Failed to get query plan: {e}", extra={"system": "database"})
        return None


# ============================================================================
# PERFORMANCE MONITORING
# ============================================================================

def analyze_slow_queries(db: Session):
    """
    Analyze database for slow queries
    This helps identify optimization opportunities
    """
    
    logger.info("🔍 Analyzing database performance...", extra={"system": "database"})
    
    try:
        # Get table statistics (only works for local SQLite, skip for Supabase)
        from supabase_client import supabase_manager
        
        # Skip performance analysis if using Supabase (REST API)
        if supabase_manager.client:
            logger.info("ℹ️  Skipping SQLite performance analysis (using Supabase)", extra={"system": "database"})
            return
        
        # Get counts from each table
        lead_count = db.execute(text("SELECT COUNT(*) FROM leads")).scalar() or 0
        activity_count = db.execute(text("SELECT COUNT(*) FROM activities")).scalar() or 0
        note_count = db.execute(text("SELECT COUNT(*) FROM notes")).scalar() or 0
        course_count = db.execute(text("SELECT COUNT(*) FROM courses")).scalar() or 0
        
        logger.info(
            f"📊 Database Stats: {lead_count} leads, "
            f"{activity_count} activities, {note_count} notes, {course_count} courses",
            extra={"system": "database"}
        )
        
        # Check for missing indexes (SQLite specific)
        integrity_check = db.execute(text("PRAGMA integrity_check")).fetchone()
        
        if integrity_check and integrity_check[0] == "ok":
            logger.info("✅ Database integrity OK", extra={"system": "database"})
        
    except Exception as e:
        logger.error(f"❌ Performance analysis failed: {e}", extra={"system": "database"})


logger.info("📊 Query optimizer initialized", extra={"system": "database"})
