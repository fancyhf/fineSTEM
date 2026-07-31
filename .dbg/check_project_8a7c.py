#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import asyncio
import sys
sys.path.insert(0, 'apps/backend')

from app.db.database import async_session
from app.models.project import Project
from sqlalchemy import select

async def check():
    async with async_session() as session:
        # 查询 8a7c155e 开头的项目
        result = await session.execute(
            select(Project).where(Project.id.like('8a7c155e%'))
        )
        project = result.scalar_one_or_none()
        if project:
            print(f'项目 ID: {project.id}')
            print(f'名称: {project.name}')
            print(f'当前阶段: {project.current_stage}')
            print(f'作者 ID: {project.author_id}')
            return True
        else:
            print('未找到 8a7c155e 项目')
            return False

if __name__ == '__main__':
    found = asyncio.run(check())
    sys.exit(0 if found else 1)
