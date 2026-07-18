import sqlite3

c = sqlite3.connect(r'G:\mediaProjects\fineSTEM\apps\backend\data\fine_stem.db')
print('TABLES:')
for r in c.execute("select name from sqlite_master where type='table'"):
    print(r[0])
