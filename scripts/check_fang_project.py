"""检查 fang 用户和趣味小测验项目"""
import sqlite3

DB = r"D:\data\finestem\finestem.db"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 1. fang 用户
cursor.execute("SELECT id, name, email, role FROM users WHERE email LIKE '%fang%' OR name LIKE '%fang%'")
users = cursor.fetchall()
print("fang 用户:")
for u in users:
    print(f"  id={u['id']} name={u['name']} email={u['email']} role={u['role']}")

# 2. 趣味小测验项目 (fang)
fang_id = users[0]['id'] if users else None
cursor.execute("SELECT id, name, author_id, mode FROM projects WHERE author_id = ?", (fang_id,))
fang_projects = cursor.fetchall()
print(f"\nfang 的项目 ({len(fang_projects)}):")
for p in fang_projects:
    print(f"  id={p['id']} name={p['name']} mode={p['mode']}")

# 3. 趣味小测验
cursor.execute("SELECT * FROM projects WHERE name LIKE '%趣味%' OR name LIKE '%quiz%' OR name LIKE '%科学%'")
quiz_projects = cursor.fetchall()
print(f"\n'趣味小测验' 相关 ({len(quiz_projects)}):")
for p in quiz_projects:
    print(f"  id={p['id']} name={p['name']} author={p['author_id']}")

# 4. 所有用户
cursor.execute("SELECT id, name, email FROM users")
print("\n所有用户:")
for u in cursor.fetchall():
    print(f"  id={u['id']} name={u['name']} email={u['email']}")

# 5. 成果卡
cursor.execute("SELECT project_id, title FROM achievement_cards")
cards = cursor.fetchall()
print(f"\n成果卡数量: {len(cards)}")
for c in cards[:5]:
    print(f"  project_id={c['project_id'][:20]}... title={c['title']}")

conn.close()
