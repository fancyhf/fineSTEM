import sqlite3
conn = sqlite3.connect('D:/data/finestem/test_finestem.db')
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables in test DB:", tables)
if 'users' in tables:
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    print(f"users table exists, row count: {count}")
else:
    print("users table NOT found")
conn.close()
