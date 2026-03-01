# Deployment Scripts & Guides

此目录包含用于服务器部署的脚本、配置文件及相关指南。

## 目录内容

- **baotawin/**: 宝塔面板 (Windows) 相关部署脚本。
- **windows_deploy.py**: Windows 环境下的自动化部署脚本。
- **complete_deployment_guide.md**: 完整的部署操作指南。
- **deployment_status.md**: 部署状态记录。

## 部署概览

fineSTEM 支持多种部署方式：
1. **本地开发**: 使用根目录的 `start_system.bat`。
2. **Docker 部署**: 根目录包含 `docker-compose.yml`，适用于 Linux 服务器（推荐）。
3. **Windows Server**: 使用本目录下的脚本进行部署。

详细配置请参考 `../deploysettings/` 目录下的文档。
