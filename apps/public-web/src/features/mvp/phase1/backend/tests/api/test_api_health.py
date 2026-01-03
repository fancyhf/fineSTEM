import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(api_client: AsyncClient):
    """
    测试 /health 端点，确保服务正常运行。
    """
    response = await api_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
