import sqlite3
c = sqlite3.connect(r'D:\data\finestem\finestem.db')
print('Admin-owned projects:')
for row in c.execute("select id, name from projects where author_id='f0de5d15-72af-4b88-8809-0cec992007cb' limit 5"):
    print(row)
