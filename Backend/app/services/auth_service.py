import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.exceptions import (
    AuthenticationError,
    AccountDeactivatedError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    MfaRequiredError,
)
from app.core.rate_limiter import auth_rate_limiter
from app.core.security import (
    get_password_hash,
    verify_password,
    hash_token,
    generate_secure_random_token,
    create_access_token,
    create_refresh_token,
    decode_access_token,
)
from app.core.rbac import RoleName
from app.models.user import User
from app.models.role import Role
from app.repositories.user_repository import UserRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.study_repository import StudyMembershipRepository
from app.repositories.audit_repository import AuditRepository
from app.services.mfa_service import mfa_service
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.session_repo = SessionRepository(session)
        self.token_repo = TokenRepository(session)
        self.study_repo = StudyMembershipRepository(session)
        self.audit_repo = AuditRepository(session)

    async def register(
        self,
        payload: RegisterRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str]:
        """
        Registers a new research user account.
        Returns: (User, raw_verification_token)
        """
        # 1. Check if email already registered
        existing = await self.user_repo.get_by_email(payload.email)
        if existing:
            await self.audit_repo.log_event(
                event_type="auth.register_conflict",
                status="failure",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"email": payload.email},
            )
            raise ConflictError(f"Email '{payload.email}' is already registered")

        # 2. Assign requested role or default to researcher
        role_name = payload.role_name or RoleName.RESEARCHER.value
        role = await self.user_repo.get_role_by_name(role_name)
        if not role:
            # Fallback to researcher role
            role = await self.user_repo.get_role_by_name(RoleName.RESEARCHER.value)
            if not role:
                raise NotFoundError("Default system role 'researcher' not configured in database")

        # 3. Handle organization assignment if code supplied
        org_id = None
        if payload.organization_code:
            org = await self.user_repo.get_organization_by_code(payload.organization_code)
            if not org or not org.is_active:
                raise NotFoundError(f"Valid active organization with code '{payload.organization_code}' not found")
            org_id = org.id

        # 4. Hash password and persist user
        hashed_pw = get_password_hash(payload.password)
        new_user = await self.user_repo.create(
            email=payload.email.lower().strip(),
            hashed_password=hashed_pw,
            full_name=payload.full_name.strip(),
            phone_number=payload.phone_number,
            organization_id=org_id,
            global_role_id=role.id,
            is_active=True,
            is_verified=False,
            mfa_enabled=False,
        )

        # 5. Generate email verification token
        raw_token, token_hash = generate_secure_random_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
        await self.token_repo.create(
            user_id=new_user.id,
            token_hash=token_hash,
            token_type="email_verification",
            expires_at=expires_at,
            is_used=False,
        )

        # 6. Audit Log
        await self.audit_repo.log_event(
            event_type="auth.register",
            status="success",
            user_id=new_user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": new_user.email, "role": role.name},
        )

        # Eagerly load relations for response
        user_with_relations = await self.user_repo.get_by_id_with_relations(new_user.id)
        return user_with_relations or new_user, raw_token

    async def login(
        self,
        payload: LoginRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TokenResponse:
        """
        Authenticates user with email, password, and optional MFA code.
        Returns: TokenResponse containing access and refresh tokens.
        """
        rate_key = f"{ip_address or 'unknown'}_{payload.email.lower()}"
        auth_rate_limiter.check_rate_limit(rate_key)

        # 1. Fetch user by email
        user = await self.user_repo.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.hashed_password):
            auth_rate_limiter.record_attempt(rate_key)
            await self.audit_repo.log_event(
                event_type="auth.login_failed",
                status="failure",
                user_id=user.id if user else None,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"email": payload.email, "reason": "invalid_credentials"},
            )
            raise AuthenticationError("Invalid email or password")

        # 2. Check account status
        if not user.is_active or user.deactivated_at is not None:
            await self.audit_repo.log_event(
                event_type="auth.login_blocked",
                status="failure",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "account_deactivated"},
            )
            raise AccountDeactivatedError("Account is inactive or has been deactivated. Please contact an administrator.")

        # 3. Check MFA if enabled
        if user.mfa_enabled:
            if not payload.mfa_code:
                # Issue short-lived temp token for MFA stage
                temp_token = create_access_token(
                    subject=str(user.id),
                    global_role=user.global_role.name,
                    extra_claims={"stage": "mfa_challenge"},
                    expires_delta=timedelta(minutes=5),
                )
                raise MfaRequiredError(temp_token=temp_token)

            # Verify MFA code
            if not user.mfa_secret or not mfa_service.verify_code(user.mfa_secret, payload.mfa_code):
                auth_rate_limiter.record_attempt(rate_key)
                await self.audit_repo.log_event(
                    event_type="auth.mfa_failed",
                    status="failure",
                    user_id=user.id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"email": payload.email},
                )
                raise AuthenticationError("Invalid multi-factor authentication code")

        # 4. Clear rate-limit attempts on success
        auth_rate_limiter.clear(rate_key)

        # 5. Fetch study roles
        memberships = await self.study_repo.list_user_study_memberships(user.id)
        study_roles = {str(m.study_id): m.role.name for m in memberships}

        # 6. Issue access token and refresh token
        access_token = create_access_token(
            subject=str(user.id),
            global_role=user.global_role.name,
            study_roles=study_roles,
        )
        raw_refresh, refresh_hash, refresh_expires_at = create_refresh_token(subject=str(user.id))

        # 7. Persist session in database
        await self.session_repo.create(
            user_id=user.id,
            token_hash=refresh_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=refresh_expires_at,
            is_revoked=False,
            last_used_at=datetime.now(timezone.utc),
        )

        # 8. Update last login timestamp
        await self.user_repo.update(
            user.id,
            last_login_at=datetime.now(timezone.utc),
        )

        # 9. Audit Log
        await self.audit_repo.log_event(
            event_type="auth.login",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": user.email, "role": user.global_role.name},
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    async def refresh_session(
        self,
        raw_refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TokenResponse:
        """
        Validates refresh token against database, rotates token, and returns new token pair.
        """
        token_hash = hash_token(raw_refresh_token)
        session = await self.session_repo.get_active_by_hash(token_hash)
        if not session or session.is_revoked:
            await self.audit_repo.log_event(
                event_type="auth.refresh_failed",
                status="failure",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "session_invalid_or_revoked"},
            )
            raise AuthenticationError("Invalid or expired session token")

        user = session.user
        if not user.is_active:
            raise AccountDeactivatedError("Account is inactive")

        # Rotate refresh token: revoke current session
        await self.session_repo.revoke_session_by_hash(token_hash)

        # Create new tokens
        memberships = await self.study_repo.list_user_study_memberships(user.id)
        study_roles = {str(m.study_id): m.role.name for m in memberships}

        new_access_token = create_access_token(
            subject=str(user.id),
            global_role=user.global_role.name,
            study_roles=study_roles,
        )
        new_raw_refresh, new_refresh_hash, new_refresh_expires = create_refresh_token(subject=str(user.id))

        await self.session_repo.create(
            user_id=user.id,
            token_hash=new_refresh_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=new_refresh_expires,
            is_revoked=False,
            last_used_at=datetime.now(timezone.utc),
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    async def logout(
        self,
        raw_refresh_token: str,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Revokes the active refresh session in the database.
        """
        token_hash = hash_token(raw_refresh_token)
        revoked = await self.session_repo.revoke_session_by_hash(token_hash)

        await self.audit_repo.log_event(
            event_type="auth.logout",
            status="success" if revoked else "failure",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return revoked

    async def verify_email(
        self,
        raw_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Validates email verification token and marks user verified.
        """
        token_hash = hash_token(raw_token)
        token_record = await self.token_repo.get_valid_token(token_hash, "email_verification")
        if not token_record:
            raise AuthenticationError("Invalid or expired verification token")

        # Mark token used & mark user verified
        await self.token_repo.mark_used(token_record.id)
        await self.user_repo.update(token_record.user_id, is_verified=True)

        await self.audit_repo.log_event(
            event_type="auth.verify_email",
            status="success",
            user_id=token_record.user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return True

    async def resend_verification(
        self,
        email: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[str]:
        """
        Generates and stores a new verification token for the user.
        Returns: raw token string (for email dispatch or test inspection).
        """
        user = await self.user_repo.get_by_email(email)
        if not user:
            # Prevent email enumeration: return None silently
            return None

        if user.is_verified:
            return None

        # Invalidate existing tokens
        await self.token_repo.invalidate_previous_tokens(user.id, "email_verification")

        # Create new token
        raw_token, token_hash = generate_secure_random_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
        await self.token_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            token_type="email_verification",
            expires_at=expires_at,
            is_used=False,
        )

        await self.audit_repo.log_event(
            event_type="auth.resend_verification",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return raw_token

    async def request_password_reset(
        self,
        email: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[str]:
        """
        Initiates password reset workflow.
        Returns: raw token string.
        """
        user = await self.user_repo.get_by_email(email)
        if not user or not user.is_active:
            # Prevent email enumeration
            return None

        # Invalidate prior reset tokens
        await self.token_repo.invalidate_previous_tokens(user.id, "password_reset")

        raw_token, token_hash = generate_secure_random_token()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
        await self.token_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            token_type="password_reset",
            expires_at=expires_at,
            is_used=False,
        )

        await self.audit_repo.log_event(
            event_type="auth.password_reset_request",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return raw_token

    async def confirm_password_reset(
        self,
        raw_token: str,
        new_password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Verifies reset token, updates password hash, and revokes all active sessions.
        """
        token_hash = hash_token(raw_token)
        token_record = await self.token_repo.get_valid_token(token_hash, "password_reset")
        if not token_record:
            raise AuthenticationError("Invalid or expired password reset token")

        # Update password hash
        new_hashed = get_password_hash(new_password)
        await self.user_repo.update(token_record.user_id, hashed_password=new_hashed)

        # Mark reset token as used
        await self.token_repo.mark_used(token_record.id)

        # Revoke all existing sessions for security
        await self.session_repo.revoke_all_user_sessions(token_record.user_id)

        await self.audit_repo.log_event(
            event_type="auth.password_reset_confirm",
            status="success",
            user_id=token_record.user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return True

    async def change_password(
        self,
        user_id: uuid.UUID,
        current_password: str,
        new_password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Changes password for an authenticated user.
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user or not verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Incorrect current password")

        new_hashed = get_password_hash(new_password)
        await self.user_repo.update(user.id, hashed_password=new_hashed)

        # Revoke sessions except the current one (or revoke all)
        await self.session_repo.revoke_all_user_sessions(user.id)

        await self.audit_repo.log_event(
            event_type="auth.change_password",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return True

    async def setup_mfa(self, user: User) -> Tuple[str, str]:
        """
        Generates MFA secret and otpauth provisioning URI.
        """
        secret = mfa_service.generate_secret()
        # Save temporary secret on user (not enabled until verified)
        await self.user_repo.update(user.id, mfa_secret=secret)
        uri = mfa_service.get_provisioning_uri(user.email, secret)
        return secret, uri

    async def verify_and_enable_mfa(
        self,
        user: User,
        code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Verifies code against temporary secret and permanently enables MFA.
        """
        if not user.mfa_secret or not mfa_service.verify_code(user.mfa_secret, code):
            raise AuthenticationError("Invalid MFA verification code")

        await self.user_repo.update(user.id, mfa_enabled=True)
        await self.audit_repo.log_event(
            event_type="auth.mfa_enabled",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return True

    async def disable_mfa(
        self,
        user: User,
        code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        Verifies code and disables MFA.
        """
        if not user.mfa_enabled or not user.mfa_secret:
            raise AuthenticationError("MFA is not enabled on this account")

        if not mfa_service.verify_code(user.mfa_secret, code):
            raise AuthenticationError("Invalid MFA verification code")

        await self.user_repo.update(user.id, mfa_enabled=False, mfa_secret=None)
        await self.audit_repo.log_event(
            event_type="auth.mfa_disabled",
            status="success",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return True
