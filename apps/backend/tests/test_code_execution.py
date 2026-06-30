"""
代码执行模块测试

用途：验证多文件执行的路径保真与 Streamlit 工作区生命周期
维护者：AI Agent
links: .trae/documents/testing/
"""

from pathlib import Path
import shutil

import pytest

from app.api import code_execution as code_execution_api


def test_resolve_safe_relative_path_preserves_nested_directories():
    safe_path = code_execution_api._resolve_safe_relative_path("pkg\\helpers\\math_tool.py")
    assert safe_path == Path("pkg", "helpers", "math_tool.py")
    assert code_execution_api._resolve_safe_relative_path("../secret.py") is None


@pytest.mark.asyncio
async def test_execute_python_multifile_keeps_streamlit_workspace(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, Path] = {}

    async def fake_start_streamlit(app_path: str, workspace_dir: Path | None = None):
        captured["app_path"] = Path(app_path)
        if workspace_dir is not None:
            captured["workspace_dir"] = workspace_dir
        return code_execution_api.CodeExecuteResponse(
            success=True,
            output="Streamlit 服务已启动",
            exit_code=0,
            mode="streamlit",
            preview_url="http://localhost:8765",
        )

    monkeypatch.setattr(code_execution_api, "_start_streamlit_server_with_path", fake_start_streamlit)

    response = await code_execution_api._execute_python_multifile(
        main_code="import streamlit as st\nfrom pkg.helper import ping\nst.write(ping())",
        files=[
            {
                "name": "app.py",
                "language": "python",
                "content": "import streamlit as st\nfrom pkg.helper import ping\nst.write(ping())",
                "is_main": True,
            },
            {
                "name": "pkg/helper.py",
                "language": "python",
                "content": "def ping():\n    return 'ok'\n",
                "is_main": False,
            },
        ],
        timeout=5,
    )

    assert response.data.success is True
    assert captured["app_path"].exists()
    assert (captured["workspace_dir"] / "pkg" / "helper.py").exists()

    shutil.rmtree(captured["workspace_dir"], ignore_errors=True)
