# Q-038 验证：GET /agent/scene-prompts 端点冒烟（TestClient，无需起服务）
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend'))
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
r = client.get('/api/v1/agent/scene-prompts')
print('status:', r.status_code)
body = r.json()
data = body.get('data') or {}
print('scenes:', sorted(data.keys()))
for key in ('问问题', '解释代码', '开始项目', '写报告'):
    assert key in data, f'missing scene: {key}'
assert '不要' in data['问问题'], '问问题场景缺少"不建项目"约束'
print('OK: 4 scenes present, QA constraint present, len(问问题)=', len(data['问问题']))
