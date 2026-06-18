import sqlite3
conn = sqlite3.connect(r"D:\data\finestem\finestem.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT id, email, name FROM users WHERE id='27fb2e88-bf95-4c98-b33b-688891d40f43'")
r = cur.fetchone()
if r:
    print(f"User: id={r['id']}, email={r['email']}, name={r['name']}")
else:
    print("User not found by id")
    cur.execute("SELECT id, email, name FROM users LIMIT 10")
    for r in cur.fetchall():
        print(f"  {r['id'][:12]}... | {r['email']} | {r['name']}")
conn.close()
