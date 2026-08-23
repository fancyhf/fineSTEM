# 部署脚本目录

> 本目录保留历史部署脚本与配置模板。当前生产环境部署文档已统一归档至 `.trae/documents/技术与架构/香港生产环境部署文档_v1.0.0.md`，请以该文档为准。

## 目录内容

| 文件 | 说明 | 状态 |
|------|------|------|
| `windows_deploy.py` | Windows 环境自动化部署脚本 | 历史（开发用） |
| `manage_backend.bat` | Windows 后端启动脚本 | 历史 |
| `start_backend_windows.bat` | Windows 后端启动 | 历史 |
| `start_frontend_port80.py` | 前端 80 端口启动 | 历史 |
| `start_frontend_python.py` | 前端 Python 静态服务 | 历史 |
| `requirements_py38.txt` | Python 3.8 依赖（旧） | 历史 |
| `baotawin/` | 宝塔面板 Windows 部署脚本 | 废弃（已迁 Linux） |
| `finestem_index.html` | 静态首页模板 | 参考 |

## 生产环境（香港）

- 访问地址：https://wostemstudio.site
- 部署文档：`.trae/documents/技术与架构/香港生产环境部署文档_v1.0.0.md`
- 决策记录：`.trae/documents/adr/ADR-001-hk-deployment.md`

## 过时的英文报告

已归档至 `.trae/documents/archive/`（含 CLEANUP_REPORT、DEPLOYMENT_SUMMARY、windows_deployment_guide 等），不再维护。
