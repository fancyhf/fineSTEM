# -*- coding: utf-8 -*-
"""冒烟：project_code_writer mode=append + project_code_reader"""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "backend"))

from app.services.tools import TOOL_REGISTRY


async def main():
    print("tool count:", len(TOOL_REGISTRY))
    assert "project_code_reader" in TOOL_REGISTRY, "reader not registered"
    writer = TOOL_REGISTRY["project_code_writer"]
    reader = TOOL_REGISTRY["project_code_reader"]
    # schema 检查
    w_schema = writer.parameters_schema
    assert "mode" in w_schema.get("properties", {}), "writer 缺 mode 参数"
    assert set(w_schema["properties"]["mode"]["enum"]) == {"replace", "append"}
    r_schema = reader.parameters_schema
    assert "project_id" in r_schema.get("properties", {})
    assert "filename" in r_schema.get("properties", {})
    assert "list_only" in r_schema.get("properties", {})
    print("schema OK: writer.mode + reader params")

    # 用真实项目 ID 做只读冒烟（reader 不写库）
    pid = "e9d9deda-68bd-40d0-a64a-8db9182ceb37"
    res = await reader.execute({"project_id": pid, "list_only": True})
    print("reader list_only:", res.success, str(res.data)[:300] if res.success else res.error)
    if res.success:
        res2 = await reader.execute({"project_id": pid})
        print("reader full:", res2.success, "keys:", list(res2.data.keys()) if res2.success else res2.error)


asyncio.run(main())
