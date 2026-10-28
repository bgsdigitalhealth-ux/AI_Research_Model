import os
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

TEST_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_suite.db"))
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test_secret_key_minimum_32_characters_long_for_security_testing"
os.environ["RATE_LIMIT_LOGIN_MAX_ATTEMPTS"] = "5"

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS = 5
from app.core.database import get_db
from app.core.rbac import ROLE_PERMISSIONS, RoleName
from app.core.security import get_password_hash, create_access_token
from app.main import app
from app.models.base import Base
from app.models.role import Role
from app.models.user import User


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed system roles metadata
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        for role_name in RoleName:
            role = Role(
                id=uuid.uuid4(),
                name=role_name.value,
                description=f"System {role_name.value} role",
                is_system_role=True,
                permissions=[p.value for p in ROLE_PERMISSIONS.get(role_name, set())],
            )
            session.add(role)
        await session.commit()

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_maker = async_sessionmaker(bind=db_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    session_maker = async_sessionmaker(bind=db_engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def researcher_user(db_session: AsyncSession) -> User:
    from sqlalchemy import select

    stmt = select(Role).where(Role.name == RoleName.RESEARCHER.value)
    result = await db_session.execute(stmt)
    role = result.scalars().first()

    user = User(
        id=uuid.uuid4(),
        email=f"researcher_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("StrongP@ssw0rd123"),
        full_name="Dr. Jane Researcher",
        global_role_id=role.id,
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def pi_user(db_session: AsyncSession) -> User:
    from sqlalchemy import select

    stmt = select(Role).where(Role.name == RoleName.PRINCIPAL_INVESTIGATOR.value)
    result = await db_session.execute(stmt)
    role = result.scalars().first()

    user = User(
        id=uuid.uuid4(),
        email=f"pi_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("LeadP@ssw0rd123"),
        full_name="Prof. Alan Turing (PI)",
        global_role_id=role.id,
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    from sqlalchemy import select

    stmt = select(Role).where(Role.name == RoleName.ADMINISTRATOR.value)
    result = await db_session.execute(stmt)
    role = result.scalars().first()

    user = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("AdminP@ssw0rd123"),
        full_name="System Administrator",
        global_role_id=role.id,
        is_active=True,
        is_verified=True,
        mfa_enabled=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def auth_headers():
    def _headers_for(user: User, role: str) -> dict:
        token = create_access_token(subject=str(user.id), global_role=role)
        return {"Authorization": f"Bearer {token}"}
    return _headers_for
