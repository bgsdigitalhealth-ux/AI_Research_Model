import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.role import Role
from app.models.organization import Organization
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .options(
                selectinload(User.global_role),
                selectinload(User.organization),
            )
            .where(User.email == email.lower().strip())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_id_with_relations(self, id: uuid.UUID) -> Optional[User]:
        stmt = (
            select(User)
            .options(
                selectinload(User.global_role),
                selectinload(User.organization),
            )
            .where(User.id == id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_role_by_name(self, name: str) -> Optional[Role]:
        stmt = select(Role).where(Role.name == name)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_organization_by_code(self, code: str) -> Optional[Organization]:
        stmt = select(Organization).where(Organization.code == code)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        stmt = (
            select(User)
            .options(
                selectinload(User.global_role),
                selectinload(User.organization),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
