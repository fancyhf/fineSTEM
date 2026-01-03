import pytest
import pytest_asyncio
import os
import httpx
from typing import AsyncGenerator
import sys

# 将 backend 目录添加到 sys.path 以便导入 main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from main import app
except ImportError:
    app = None

# 默认基础 URL，可以通过环境变量覆盖
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_FRONTEND_URL = "http://localhost:5173"

def pytest_addoption(parser):
    parser.addoption(
        "--env", 
        action="store", 
        default="local", 
        help="Environment to test against: local or prod"
    )

@pytest.fixture(scope="session")
def env(request):
    return request.config.getoption("--env")

@pytest.fixture(scope="session")
def api_base_url(env):
    if env == "prod":
        return os.getenv("PROD_API_URL", "http://localhost:8000")
    return DEFAULT_API_URL

@pytest.fixture(scope="session")
def frontend_base_url(env):
    if env == "prod":
        return os.getenv("PROD_FRONTEND_URL", "http://localhost:5173")
    return DEFAULT_FRONTEND_URL

@pytest_asyncio.fixture
async def api_client(env, api_base_url) -> AsyncGenerator[httpx.AsyncClient, None]:
    if env == "local" and app:
        # 本地测试使用应用实例，无需启动服务器
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:
            yield client
    else:
        # 生产环境或无法导入 app 时，使用真实网络请求
        async with httpx.AsyncClient(base_url=api_base_url, timeout=30.0) as client:
            yield client

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, frontend_base_url):
    return {
        **browser_context_args,
        "base_url": frontend_base_url,
        "ignore_https_errors": True,
    }
