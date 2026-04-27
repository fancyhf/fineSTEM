# fineSTEM 后端 API

## 技术栈

- **框架**: FastAPI (Python 3.12+)
- **数据验证**: Pydantic
- **数据库**: SQLAlchemy + SQLite（持久化）
- **迁移管理**: Alembic
- **CORS**: 已配置允许前端访问

## 目录结构

```
backend/
├── app/
│   ├── api/            # API 路由
│   │   ├── demos.py
│   │   └── projects.py
│   ├── core/           # 核心配置
│   │   └── config.py
│   ├── schemas/        # 数据模型
│   │   ├── demos.py
│   │   ├── projects.py
│   │   └── common.py
│   ├── db/            # 数据库层（ORM + 迁移）
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── memory.py
│   │   └── migrations/
│   └── services/       # 业务逻辑层
├── main.py            # 应用入口
└── requirements.txt
```

## API 规范

- **版本前缀**: `/api/v1`
- **资源复数**: `/demos`, `/projects`
- **响应格式**: `{"code": 200, "message": "成功", "data": {...}}`
- **字段命名**: camelCase

## 开发命令

```bash
# 安装依赖
pip install -r requirements.txt

# 启动开发服务
python main.py

# 执行数据库迁移
python -m alembic upgrade head

# 访问 API 文档
http://localhost:8000/docs  # Swagger UI
http://localhost:8000/redoc # ReDoc
```

---
version: 1.0.0
created_at: 2026-04-23
maintainer: AI Agent
