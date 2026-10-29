import asyncio
import os
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.core.rbac import RoleName, ROLE_PERMISSIONS
from app.core.security import get_password_hash
from app.models.base import Base
import app.models
from app.models.role import Role
from app.models.user import User


async def seed():
    print(f"Connecting to {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized.")

    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        # Check if roles already exist
        res = await session.execute(select(Role))
        existing_roles = {r.name: r for r in res.scalars().all()}

        for role_name in RoleName:
            if role_name.value not in existing_roles:
                role = Role(
                    id=uuid.uuid4(),
                    name=role_name.value,
                    description=f"System {role_name.value} role",
                    is_system_role=True,
                    permissions=[p.value for p in ROLE_PERMISSIONS.get(role_name, set())],
                )
                session.add(role)
                existing_roles[role_name.value] = role
                print(f"Seeded role: {role_name.value}")

        await session.commit()

        # Check if test admin user exists
        admin_email = "admin@airesearchflow.org"
        admin_res = await session.execute(select(User).where(User.email == admin_email))
        admin = admin_res.scalars().first()

        if not admin:
            admin_role = existing_roles[RoleName.ADMINISTRATOR.value]
            admin_user = User(
                id=uuid.uuid4(),
                email=admin_email,
                hashed_password=get_password_hash("AdminPassword123!"),
                full_name="System Administrator",
                global_role_id=admin_role.id,
                is_active=True,
                is_verified=True,
                mfa_enabled=False,
            )
            session.add(admin_user)
            await session.commit()
            print(f"Created default admin account: {admin_email} / AdminPassword123!")
        else:
            print("Default admin account already exists.")

    await engine.dispose()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())

