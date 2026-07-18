import asyncio
import httpx

async def test_chat():
    async with httpx.AsyncClient() as client:
        # 测试项目 b686df08-6655-4edb-a3a5-955f3244abe1
        project_id = 'b686df08-6655-4edb-a3a5-955f3244abe1'
        
        # 先获取项目信息
        resp = await client.get(f'http://localhost:8000/api/projects/{project_id}')
        print(f'Project status: {resp.status_code}')
        if resp.status_code == 200:
            data = resp.json()
            print(f'Project name: {data.get("data", {}).get("name", "unknown")}')
            print(f'Current stage: {data.get("data", {}).get("current_stage", "unknown")}')
        
        # 获取 workspace
        resp = await client.get(f'http://localhost:8000/api/projects/{project_id}/workspace')
        print(f'Workspace status: {resp.status_code}')
        if resp.status_code == 200:
            data = resp.json()
            workspace = data.get('data', {}).get('workspace', {})
            code = workspace.get('code', '')
            print(f'Code length: {len(code)}')
            if 'MVP' in code or '最小' in code or 'fineSTEM MVP' in code:
                print('WARNING: MVP template still in workspace!')
            else:
                print('OK: No MVP template in workspace')
                print(f'Code preview: {code[:200]}...')

asyncio.run(test_chat())
