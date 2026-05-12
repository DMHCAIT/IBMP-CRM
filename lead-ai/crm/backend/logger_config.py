"""
Structured Logging Configuration
Implements comprehensive logging with rotation, JSON formatting, and multiple sinks
"""

import os
import sys
from pathlib import Path
from loguru import logger
from datetime import datetime

# Remove default logger
logger.remove()

# Create logs directory
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# diagnose=True dumps local variable values into tracebacks which can expose
# secrets and PII.  Only enable it when explicitly running in DEBUG mode.
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_DEBUG_MODE = _LOG_LEVEL == "DEBUG"

# Console logging - colorized and formatted
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=_LOG_LEVEL,
    colorize=True,
    backtrace=True,
    diagnose=_DEBUG_MODE,
)

# File logging - rotated, INFO by default (DEBUG only in debug mode)
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level=_LOG_LEVEL,
    rotation="10 MB",
    retention="30 days",
    compression="zip",
    backtrace=True,
    diagnose=_DEBUG_MODE,  # Never expose locals in production
    enqueue=True,
)

# Error logging - separate file for errors only
logger.add(
    LOG_DIR / "errors.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="ERROR",
    rotation="5 MB",
    retention="60 days",
    compression="zip",
    backtrace=True,
    diagnose=False,  # Never expose locals for errors (most sensitive traces)
    enqueue=True,
)

# JSON logging - for machine parsing
logger.add(
    LOG_DIR / "app.json",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message} | {extra}",
    level="INFO",
    rotation="20 MB",
    retention="14 days",
    serialize=True,  # Output as JSON
    enqueue=True,
)

# Performance logging - separate file for performance metrics
logger.add(
    LOG_DIR / "performance.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {message}",
    level="INFO",
    rotation="5 MB",
    retention="7 days",
    filter=lambda record: "performance" in record["extra"],
    enqueue=True,
)

# API request logging
logger.add(
    LOG_DIR / "api_requests.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {message}",
    level="INFO",
    rotation="10 MB",
    retention="14 days",
    filter=lambda record: "api_request" in record["extra"],
    enqueue=True,
)

# Database query logging
logger.add(
    LOG_DIR / "database.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {message}",
    level="DEBUG",
    rotation="5 MB",
    retention="7 days",
    filter=lambda record: "database" in record["extra"],
    enqueue=True,
)


def get_logger(name: str = __name__):
    """Get a logger instance with the given name"""
    return logger.bind(logger_name=name)


# Log startup
logger.info("📝 Logging system initialized", extra={"system": "logging"})
logger.info(f"📁 Log directory: {LOG_DIR.absolute()}", extra={"system": "logging"})
