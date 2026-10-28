from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from app.core.config import settings
from app.core.exceptions import DatabaseNotAvailableError

# Configure Async Engine
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}

if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DATABASE_POOL_SIZE,
        "max_overflow": settings.DATABASE_MAX_OVERFLOW,
        "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
        "pool_pre_ping": True,
    })
    # Supabase connection pooler support (port 6543 / pooler.supabase.com)
    if "pooler.supabase.com" in settings.DATABASE_URL or ":6543" in settings.DATABASE_URL:
        engine_kwargs["connect_args"] = {
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
        }

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides an asynchronous database session.
    Commits automatically on success, rolls back on exception,
    and fails explicitly if database is unreachable.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except OperationalError as exc:
            await session.rollback()
            raise DatabaseNotAvailableError(
                message=f"Database operational failure: {str(exc)}"
            ) from exc
        except SQLAlchemyError:
            await session.rollback()
            raise
        finally:
            await session.close()
