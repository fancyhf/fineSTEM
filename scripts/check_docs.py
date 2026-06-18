"""检查趣味小测验项目的阶段文档存储位置"""
import sqlite3
import json

conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

PROJECT_ID = 'f2a11545-2b53-488d-8c38-7048f3adc801'

# 1. 项目基本信息
cur.execute("SELECT id, name, mode, current_stage, description FROM projects WHERE id = ?", (PROJECT_ID,))
project = cur.fetchone()
print('=== 项目 ===')
print(f'  id={project[0]}, name={project[1]}, mode={project[2]}, stage={project[3]}')
print(f'  desc={project[4]}')

# 2. skill_state
cur.execute("SELECT * FROM skill_states WHERE project_id = ?", (PROJECT_ID,))
state = cur.fetchone()
if state:
    cols = [d[0] for d in cur.description]
    print('\n=== skill_states 字段 ===')
    for c, v in zip(cols, state):
        if isinstance(v, str) and len(v) > 100:
            print(f'  {c}: {v[:100]}...')
        elif v is not None:
            print(f'  {c}: {v}')

# 3. achievement_cards
cur.execute("SELECT * FROM achievement_cards WHERE project_id = ?", (PROJECT_ID,))
card = cur.fetchone()
print(f'\n=== achievement_cards ===')
print(f'  exists: {card is not None}')

conn.close()
