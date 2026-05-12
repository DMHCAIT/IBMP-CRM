"""
Caching System for Performance Optimization
Implements multi-layer caching: in-memory (TTL) + Redis for distributed caching
"""

from typing import Optional, Any, Callable
from functools import wraps
import hashlib
import json
import time
from cachetools import TTLCache, LRUCache
from logger_config import logger

# ============================================================================
# IN-MEMORY CACHE (Fast, per-instance)
# ============================================================================

# Different caches for different data types with appropriate TTLs
LEAD_CACHE = TTLCache(maxsize=1000, ttl=300)  # 5 minutes
COURSE_CACHE = TTLCache(maxsize=200, ttl=3600)  # 1 hour (courses rarely change)
USER_CACHE = TTLCache(maxsize=500, ttl=600)  # 10 minutes
STATS_CACHE = TTLCache(maxsize=100, ttl=60)  # 1 minute (stats change frequently)
ML_SCORE_CACHE = LRUCache(maxsize=500)  # LRU for ML predictions (no TTL)


def get_cache_key(*args, **kwargs) -> str:
    """Generate a unique cache key from function arguments"""
    # Create a string representation of all arguments
    key_data = {
        "args": args,
        "kwargs": sorted(kwargs.items())
    }
    key_str = json.dumps(key_data, sort_keys=True, default=str)
    # Hash it for consistent key length
    return hashlib.md5(key_str.encode()).hexdigest()


def cache_result(cache: Any, key_prefix: str = ""):
    """
    Decorator to cache function results
    
    Usage:
        @cache_result(LEAD_CACHE, "lead")
        def get_lead(lead_id: str):
            # ... expensive operation
            return result
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{get_cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            if cache_key in cache:
                logger.debug(
                    f"🎯 Cache HIT: {func.__name__}",
                    extra={"cache_key": cache_key, "performance": True}
                )
                return cache[cache_key]
            
            # Cache miss - execute function
            logger.debug(
                f"❌ Cache MISS: {func.__name__}",
                extra={"cache_key": cache_key, "performance": True}
            )
            
            start_time = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Store in cache
            cache[cache_key] = result
            
            logger.debug(
                f"💾 Cached result: {func.__name__} ({duration*1000:.2f}ms)",
                extra={
                    "cache_key": cache_key,
                    "duration_ms": round(duration * 1000, 2),
                    "performance": True
                }
            )
            
            return result
        
        return wrapper
    return decorator


def cache_async_result(cache: Any, key_prefix: str = ""):
    """
    Decorator to cache async function results
    
    Usage:
        @cache_async_result(STATS_CACHE, "stats")
        async def get_stats():
            # ... expensive async operation
            return result
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{get_cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            if cache_key in cache:
                logger.debug(
                    f"🎯 Cache HIT: {func.__name__}",
                    extra={"cache_key": cache_key, "performance": True}
                )
                return cache[cache_key]
            
            # Cache miss - execute function
            logger.debug(
                f"❌ Cache MISS: {func.__name__}",
                extra={"cache_key": cache_key, "performance": True}
            )
            
            start_time = time.time()
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Store in cache
            cache[cache_key] = result
            
            logger.debug(
                f"💾 Cached async result: {func.__name__} ({duration*1000:.2f}ms)",
                extra={
                    "cache_key": cache_key,
                    "duration_ms": round(duration * 1000, 2),
                    "performance": True
                }
            )
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(cache: Any, key_prefix: Optional[str] = None):
    """
    Invalidate cache entries
    
    Args:
        cache: The cache to invalidate
        key_prefix: If provided, only invalidate keys with this prefix
    """
    if key_prefix:
        # Invalidate specific prefix
        keys_to_delete = [k for k in cache.keys() if k.startswith(key_prefix)]
        for key in keys_to_delete:
            del cache[key]
        logger.info(
            f"🗑️  Invalidated {len(keys_to_delete)} cache entries with prefix '{key_prefix}'",
            extra={"performance": True}
        )
    else:
        # Clear entire cache
        size = len(cache)
        cache.clear()
        logger.info(
            f"🗑️  Cleared entire cache ({size} entries)",
            extra={"performance": True}
        )


def get_cache_stats() -> dict:
    """Get statistics for all caches"""
    return {
        "lead_cache": {
            "size": len(LEAD_CACHE),
            "maxsize": LEAD_CACHE.maxsize,
            "ttl": 300,
        },
        "course_cache": {
            "size": len(COURSE_CACHE),
            "maxsize": COURSE_CACHE.maxsize,
            "ttl": 3600,
        },
        "user_cache": {
            "size": len(USER_CACHE),
            "maxsize": USER_CACHE.maxsize,
            "ttl": 600,
        },
        "stats_cache": {
            "size": len(STATS_CACHE),
            "maxsize": STATS_CACHE.maxsize,
            "ttl": 60,
        },
        "ml_score_cache": {
            "size": len(ML_SCORE_CACHE),
            "maxsize": ML_SCORE_CACHE.maxsize,
            "type": "LRU",
        },
    }


# ============================================================================
# CACHE WARMING (Pre-populate cache on startup)
# ============================================================================

async def warm_cache(db_session):
    """
    Warm up caches with frequently accessed data
    Called on application startup
    """
    logger.info("🔥 Warming up caches...", extra={"system": "cache"})
    
    try:
        # Check if using Supabase
        from supabase_client import supabase_manager
        
        if supabase_manager.client:
            # Use Supabase for cache warming
            logger.info("ℹ️  Cache warming with Supabase data", extra={"system": "cache"})
            
            # Warm up course cache
            courses_response = supabase_manager.client.table('courses').select('*').execute()
            courses_data = courses_response.data if courses_response.data else []
            for course in courses_data:
                cache_key = f"course:{course.get('id')}"
                COURSE_CACHE[cache_key] = course
            logger.info(f"✅ Warmed course cache: {len(courses_data)} entries", extra={"system": "cache"})
            
            # Warm up user cache
            users_response = supabase_manager.client.table('users').select('*').eq('is_active', True).execute()
            users_data = users_response.data if users_response.data else []
            for user in users_data:
                cache_key = f"user:{user.get('id')}"
                USER_CACHE[cache_key] = user
            logger.info(f"✅ Warmed user cache: {len(users_data)} entries", extra={"system": "cache"})
            
        else:
            # Fallback to SQLite
            from main import DBCourse, DBUser
            
            courses = db_session.query(DBCourse).all()
            for course in courses:
                cache_key = f"course:{course.id}"
                COURSE_CACHE[cache_key] = course
            logger.info(f"✅ Warmed course cache: {len(courses)} entries", extra={"system": "cache"})
            
            users = db_session.query(DBUser).filter(DBUser.is_active == True).all()
            for user in users:
                cache_key = f"user:{user.id}"
                USER_CACHE[cache_key] = user
            logger.info(f"✅ Warmed user cache: {len(users)} entries", extra={"system": "cache"})
        
        logger.info("🔥 Cache warming complete!", extra={"system": "cache"})
        
    except Exception as e:
        logger.error(f"❌ Cache warming failed: {e}", extra={"system": "cache"})


logger.info("💾 Caching system initialized", extra={"system": "cache"})
