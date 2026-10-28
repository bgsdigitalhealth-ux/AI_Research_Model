from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, get_client_ip, get_user_agent
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.schemas.common import StandardResponse
from app.schemas.user import UserResponse, UserProfileUpdate
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    ChangePasswordRequest,
    MfaSetupResponse,
    MfaVerifyRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Sessions"])


@router.post(
    "/register",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new researcher or participant account",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    user, token = await auth_service.register(payload, ip, ua)
    return StandardResponse(
        success=True,
        message="Account registered successfully. Please verify your email.",
        data=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive access and refresh tokens",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    token_response = await auth_service.login(payload, ip, ua)
    return StandardResponse(
        success=True,
        message="Authentication successful",
        data=token_response,
    )


@router.post(
    "/refresh",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and obtain new access token",
)
async def refresh_token(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    token_response = await auth_service.refresh_session(payload.refresh_token, ip, ua)
    return StandardResponse(
        success=True,
        message="Session refreshed successfully",
        data=token_response,
    )


@router.post(
    "/logout",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Revoke session and log out",
)
async def logout(
    payload: RefreshTokenRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.logout(payload.refresh_token, current_user.id, ip, ua)
    return StandardResponse(
        success=True,
        message="Successfully logged out and session revoked",
        data=None,
    )


@router.get(
    "/me",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve authenticated user profile",
)
async def get_profile(
    current_user: User = Depends(get_current_user),
):
    return StandardResponse(
        success=True,
        message="Profile retrieved",
        data=UserResponse.model_validate(current_user),
    )


@router.patch(
    "/me",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Update authenticated user profile information",
)
async def update_profile(
    payload: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    user_service = UserService(db)
    updated = await user_service.update_user_profile(current_user.id, payload, ip, ua)
    return StandardResponse(
        success=True,
        message="Profile updated successfully",
        data=UserResponse.model_validate(updated),
    )


@router.post(
    "/verify-email",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Verify email using token received via email",
)
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.verify_email(payload.token, ip, ua)
    return StandardResponse(
        success=True,
        message="Email successfully verified",
        data=None,
    )


@router.post(
    "/resend-verification",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Request a new email verification token",
)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.resend_verification(payload.email, ip, ua)
    return StandardResponse(
        success=True,
        message="If an unverified account exists with that email, a verification link has been sent.",
        data=None,
    )


@router.post(
    "/password-reset/request",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Request password reset token",
)
async def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.request_password_reset(payload.email, ip, ua)
    return StandardResponse(
        success=True,
        message="If an active account exists with that email, a password reset link has been dispatched.",
        data=None,
    )


@router.post(
    "/password-reset/confirm",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Confirm password reset with token and new password",
)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.confirm_password_reset(payload.token, payload.new_password, ip, ua)
    return StandardResponse(
        success=True,
        message="Password has been reset successfully. Please log in with your new password.",
        data=None,
    )


@router.post(
    "/change-password",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Change password for current authenticated user",
)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.change_password(
        current_user.id, payload.current_password, payload.new_password, ip, ua
    )
    return StandardResponse(
        success=True,
        message="Password changed successfully. All other active sessions have been revoked.",
        data=None,
    )


@router.post(
    "/mfa/setup",
    response_model=StandardResponse[MfaSetupResponse],
    status_code=status.HTTP_200_OK,
    summary="Initiate Multi-Factor Authentication (TOTP) setup",
)
async def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    secret, uri = await auth_service.setup_mfa(current_user)
    return StandardResponse(
        success=True,
        message="MFA setup initiated. Verify code to activate.",
        data=MfaSetupResponse(secret=secret, provisioning_uri=uri),
    )


@router.post(
    "/mfa/verify",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Verify TOTP code and enable Multi-Factor Authentication",
)
async def verify_mfa(
    payload: MfaVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.verify_and_enable_mfa(current_user, payload.code, ip, ua)
    return StandardResponse(
        success=True,
        message="Multi-factor authentication successfully enabled",
        data=None,
    )


@router.post(
    "/mfa/disable",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Disable Multi-Factor Authentication with valid code",
)
async def disable_mfa(
    payload: MfaVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    auth_service = AuthService(db)
    await auth_service.disable_mfa(current_user, payload.code, ip, ua)
    return StandardResponse(
        success=True,
        message="Multi-factor authentication disabled",
        data=None,
    )


@router.post(
    "/deactivate",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Self-deactivate account",
)
async def deactivate_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    user_service = UserService(db)
    await user_service.deactivate_user(current_user.id, current_user, ip, ua)
    return StandardResponse(
        success=True,
        message="Account has been successfully deactivated",
        data=None,
    )
