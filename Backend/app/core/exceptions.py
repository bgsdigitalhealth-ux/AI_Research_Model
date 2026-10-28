from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status_code,
            detail={
                "error_code": error_code,
                "message": message,
                "details": details or {},
            },
        )
        self.error_code = error_code
        self.message = message
        self.details = details or {}


class AuthenticationError(AppException):
    def __init__(self, message: str = "Invalid credentials or unauthenticated"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_FAILED",
            message=message,
        )


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Insufficient permissions for this operation"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
            message=message,
        )


class AccountDeactivatedError(AppException):
    def __init__(self, message: str = "Account is inactive or has been deactivated"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="ACCOUNT_INACTIVE",
            message=message,
        )


class EmailNotVerifiedError(AppException):
    def __init__(self, message: str = "Email address has not been verified"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="EMAIL_NOT_VERIFIED",
            message=message,
        )


class MfaRequiredError(AppException):
    def __init__(self, temp_token: str, message: str = "Multi-factor authentication required"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="MFA_REQUIRED",
            message=message,
            details={"temp_token": temp_token},
        )


class NotFoundError(AppException):
    def __init__(self, entity: str = "Resource", identifier: Optional[str] = None):
        msg = f"{entity} not found" if not identifier else f"{entity} with ID '{identifier}' not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            message=msg,
        )


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict detected"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message=message,
        )


class RateLimitExceededError(AppException):
    def __init__(self, retry_after_seconds: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            message=f"Too many authentication attempts. Please retry in {retry_after_seconds} seconds.",
            details={"retry_after_seconds": retry_after_seconds},
        )


class DatabaseNotAvailableError(AppException):
    def __init__(self, message: str = "Configured relational database is unreachable"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="DATABASE_UNAVAILABLE",
            message=message,
        )


class FileValidationError(AppException):
    def __init__(self, message: str = "File validation failed"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="FILE_VALIDATION_ERROR",
            message=message,
        )


class VersionImmutableError(AppException):
    def __init__(self, message: str = "Approved protocol version is immutable. Submit an amendment to create a new version."):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_IMMUTABLE",
            message=message,
        )


class GovernanceNotMetError(AppException):
    def __init__(self, message: str = "Required governance approval and consent framework metadata must be satisfied before enabling collection."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="GOVERNANCE_REQUIREMENTS_NOT_MET",
            message=message,
        )


class AIProviderNotConfiguredError(AppException):
    def __init__(self, message: str = "No approved AI provider is configured. Please configure an approved AI provider (e.g. GEMINI_API_KEY) or enter protocol details manually."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="AI_PROVIDER_NOT_CONFIGURED",
            message=message,
        )


class AIExecutionError(AppException):
    def __init__(self, message: str = "AI extraction processing failed"):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="AI_EXECUTION_ERROR",
            message=message,
        )


class InvalidQuestionnaireError(AppException):
    def __init__(self, message: str = "Questionnaire validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_QUESTIONNAIRE",
            message=message,
            details=details,
        )


class InvalidInputError(AppException):
    def __init__(self, message: str = "Invalid input parameters", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_INPUT",
            message=message,
            details=details,
        )

