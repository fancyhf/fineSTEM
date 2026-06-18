"""重置 fang 用户的密码为 test123"""
import sys
sys.path.insert(0, r"g:\mediaProjects\fineSTEM\apps\backend")

from app.api.auth import get_password_hash
import sqlite3

new_hash = get_password_hash("test123")
print(f"New hash: {new_hash}")

conn = sqlite3.connect(r"D:\data\finestem\finestem.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, email, name, hashed_password FROM users WHERE id='27fb2e88-bf95-4c98-b33b-688891d40f43'")
r = cur.fetchone()
if r:
    print(f"User: id={r['id']}, email={r['email']}, name={r['name']}")
    cur.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (new_hash, r['id']))
    conn.commit()
    print("Password updated!")
else:
    print("User not found")
conn.close()
