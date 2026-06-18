"""获取项目ID"""
import sqlite3
conn = sqlite3.connect("D:/data/finestem/finestem.db")
cur = conn.cursor()
cur.execute("SELECT id FROM projects WHERE name LIKE '%测试已完成无成果卡%' AND is_deleted=0")
row = cur.fetchone()
print(row[0] if row else "not found")
conn.close()
