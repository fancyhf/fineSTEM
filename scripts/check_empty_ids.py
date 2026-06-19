import sqlite3
conn = sqlite3.connect(r'D:\data\finestem\finestem.db')
cur = conn.cursor()

# Find projects with empty or null id
cur.execute("SELECT id, name, created_at FROM projects WHERE id = '' OR id IS NULL")
rows = cur.fetchall()
print(f"Projects with empty ID: {len(rows)}")
for r in rows:
    print(f"  id='{r[0]}' name='{r[1]}' created={r[2]}")

# Also find the Fork project
cur.execute("SELECT id, name, created_at FROM projects WHERE name LIKE '%Fork%'")
rows = cur.fetchall()
print(f"\nFork projects: {len(rows)}")
for r in rows:
    print(f"  id='{r[0]}' name='{r[1]}' created={r[2]}")

conn.close()
