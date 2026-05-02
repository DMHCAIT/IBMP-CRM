"""
Custom Exception Classes
Provides detailed error handling with proper HTTP status codes
"""

from typing import Optional, Any, Dict
from fastapi import HTTPException, status


class CRMException(Exception):
    """Base exception for CRM system"""
    
    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None
    ):
        self.message = message
        self.details = details or {}
        self.error_code = error_code
        super().__init__(self.message)


class AuthenticationError(CRMException):
    """Authentication related errors"""
    
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, error_code="AUTH_ERROR", **kwargs)


class AuthorizationError(CRMException):
    """Authorization/permission errors"""
    
    def __init__(self, message: str = "Insufficient permissions", **kwargs):
        super().__init__(message, error_code="AUTHZ_ERROR", **kwargs)


class ValidationError(CRMException):
    """Data validation errors"""
    
    def __init__(self, message: str = "Validation failed", **kwargs):
        super().__init__(message, error_code="VALIDATION_ERROR", **kwargs)


class NotFoundError(CRMException):
    """Resource not found errors"""
    
    def __init__(self, resource: str, identifier: Any, **kwargs):
        message = f"{resource} with identifier '{identifier}' not found"
        super().__init__(message, error_code="NOT_FOUND", **kwargs)


class DatabaseError(CRMException):
    """Database operation errors"""
    
    def __init__(self, message: str = "Database operation failed", **kwargs):
        super().__init__(message, error_code="DB_ERROR", **kwargs)


class ExternalServiceError(CRMException):
    """External API/service errors"""
    
    def __init__(
        self,
        service: str,
        message: str = "External service error",
        **kwargs
    ):
        super().__init__(
            f"{service}: {message}",
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service},
            **kwargs
        )


class BusinessLogicError(CRMException):
    """Business rule violation errors"""
    
    def __init__(self, message: str = "Business rule violation", **kwargs):
        super().__init__(message, error_code="BUSINESS_ERROR", **kwargs)


class RateLimitError(CRMException):
    """Rate limiting errors"""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs
    ):
        details = kwargs.get("details", {})
        if retry_after:
            details["retry_after"] = retry_after
        super().__init__(message, error_code="RATE_LIMIT", details=details, **kwargs)


class ConfigurationError(CRMException):
    """Configuration/setup errors"""
    
    def __init__(self, message: str = "Configuration error", **kwargs):
        super().__init__(message, error_code="CONFIG_ERROR", **kwargs)


# HTTP Exception converters
def to_http_exception(error: CRMException) -> HTTPException:
    """Convert CRM exception to FastAPI HTTPException"""
    
    status_mapping = {
        "AUTH_ERROR": status.HTTP_401_UNAUTHORIZED,
        "AUTHZ_ERROR": status.HTTP_403_FORBIDDEN,
        "VALIDATION_ERROR": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "DB_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "EXTERNAL_SERVICE_ERROR": status.HTTP_502_BAD_GATEWAY,
        "BUSINESS_ERROR": status.HTTP_400_BAD_REQUEST,
        "RATE_LIMIT": status.HTTP_429_TOO_MANY_REQUESTS,
        "CONFIG_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
    }
    
    status_code = status_mapping.get(error.error_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return HTTPException(
        status_code=status_code,
        detail={
            "error": error.error_code,
            "message": error.message,
            "details": error.details,
        }
    )
