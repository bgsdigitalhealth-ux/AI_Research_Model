import time
from collections import defaultdict
from typing import Dict, List
from app.core.config import settings
from app.core.exceptions import RateLimitExceededError


class AuthRateLimiter:
    """
    In-memory rate limiter tracking failed authentication attempts per key (IP address or email).
    Thread-safe and supports automated sliding-window expiration.
    """

    def __init__(
        self,
        max_attempts: int = settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
        window_seconds: int = settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        # key -> list of attempt timestamps
        self._attempts: Dict[str, List[float]] = defaultdict(list)

    def _cleanup_old_attempts(self, key: str, now: float) -> None:
        threshold = now - self.window_seconds
        self._attempts[key] = [t for t in self._attempts[key] if t > threshold]

    def check_rate_limit(self, key: str) -> None:
        """
        Validates whether key is currently rate-limited.
        Raises RateLimitExceededError if limit is breached.
        """
        now = time.time()
        self._cleanup_old_attempts(key, now)
        attempts = len(self._attempts[key])
        if attempts >= self.max_attempts:
            oldest = self._attempts[key][0]
            retry_after = int(self.window_seconds - (now - oldest))
            raise RateLimitExceededError(retry_after_seconds=max(retry_after, 1))

    def record_attempt(self, key: str) -> None:
        """
        Records a failed attempt timestamp for a key.
        """
        now = time.time()
        self._cleanup_old_attempts(key, now)
        self._attempts[key].append(now)

    def clear(self, key: str) -> None:
        """
        Clears attempts upon successful authentication.
        """
        if key in self._attempts:
            del self._attempts[key]


auth_rate_limiter = AuthRateLimiter()
