import pyotp
from app.core.config import settings


class MfaService:
    @staticmethod
    def generate_secret() -> str:
        """
        Generates a standard base32 TOTP secret.
        """
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(email: str, secret: str) -> str:
        """
        Constructs a standard OTPAuth URL for Google Authenticator / 1Password.
        """
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=settings.MFA_ISSUER_NAME)

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        """
        Validates a 6-digit TOTP code allowing +/- 1 window (30 seconds drift).
        """
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)


mfa_service = MfaService()
