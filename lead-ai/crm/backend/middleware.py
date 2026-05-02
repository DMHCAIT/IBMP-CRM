"""
FastAPI Middleware for Logging and Error Handling
Comprehensive request/response logging and error tracking
"""

import time
import traceback
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from logger_config import logger
from exceptions import CRMException, to_http_exception


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all API requests and responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = f"{int(time.time() * 1000)}"
        
        # Start timer
        start_time = time.time()
        
        # Extract request details
        client_host = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params)
        
        # Log incoming request
        logger.info(
            f"➡️  {method} {path}",
            extra={
                "api_request": True,
                "request_id": request_id,
                "method": method,
                "path": path,
                "client": client_host,
                "query_params": query_params,
            }
        )
        
        # Add request_id to request state
        request.state.request_id = request_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Log response
            logger.info(
                f"⬅️  {method} {path} - {response.status_code} ({duration_ms}ms)",
                extra={
                    "api_request": True,
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "performance": True,
                }
            )
            
            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms}ms"
            
            return response
            
        except Exception as exc:
            # Calculate duration
            duration = time.time() - start_time
            duration_ms = round(duration * 1000, 2)
            
            # Log error
            logger.error(
                f"❌ {method} {path} - ERROR ({duration_ms}ms): {str(exc)}",
                extra={
                    "api_request": True,
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                    "duration_ms": duration_ms,
                }
            )
            
            # Re-raise to be handled by error handler
            raise


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for centralized error handling"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
            
        except CRMException as exc:
            # Log custom CRM exceptions
            logger.warning(
                f"⚠️  CRM Error: {exc.error_code} - {exc.message}",
                extra={
                    "error_code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details,
                    "path": request.url.path,
                }
            )
            
            # Convert to HTTP exception
            http_exc = to_http_exception(exc)
            return JSONResponse(
                status_code=http_exc.status_code,
                content=http_exc.detail,
            )
            
        except ValueError as exc:
            # Validation errors
            logger.warning(f"⚠️  Validation Error: {str(exc)}", extra={"path": request.url.path})
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "error": "VALIDATION_ERROR",
                    "message": str(exc),
                }
            )
            
        except PermissionError as exc:
            # Permission errors
            logger.warning(f"⚠️  Permission Error: {str(exc)}", extra={"path": request.url.path})
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "PERMISSION_DENIED",
                    "message": str(exc),
                }
            )
            
        except Exception as exc:
            # Unexpected errors
            request_id = getattr(request.state, "request_id", "unknown")
            error_trace = traceback.format_exc()
            
            logger.error(
                f"💥 Unhandled Exception: {type(exc).__name__}",
                extra={
                    "request_id": request_id,
                    "path": request.url.path,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                    "traceback": error_trace,
                }
            )

            # Surface response validation details in logs for easier debugging.
            if type(exc).__name__ == "ResponseValidationError":
                try:
                    details = getattr(exc, "errors", lambda: [])()
                except Exception:
                    details = str(exc)
                logger.error(
                    "💥 ResponseValidationError details: {}",
                    details,
                    extra={
                        "request_id": request_id,
                        "path": request.url.path,
                    },
                )
            
            # Return generic error (don't expose internal details)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": request_id,
                }
            )


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for monitoring slow requests"""
    
    SLOW_REQUEST_THRESHOLD = 1.0  # seconds
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        
        # Log slow requests
        if duration > self.SLOW_REQUEST_THRESHOLD:
            logger.warning(
                f"🐌 Slow Request: {request.method} {request.url.path} took {duration:.2f}s",
                extra={
                    "performance": True,
                    "slow_request": True,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_seconds": round(duration, 2),
                }
            )
        
        return response
