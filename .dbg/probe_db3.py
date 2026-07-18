import sqlite3

c = sqlite3.connect(r'D:\data\finestem\finestem.db')
print('USERS:')
for row in c.execute('select id, email, name from users'):
    print(row)
print('PROJECT f2a11545:')
for row in c.execute("select id, author_id, name from projects where id='f2a11545-2b53-488d-8c38-7048f3adc801'"):
    print(row)
print('EVIDENCE screenshots:')
for row in c.execute("select id, project_id, type, title, content_url from evidence where project_id='f2a11545-2b53-488d-8c38-7048f3adc801' and type='screenshot'"):
    print(row)
print('ACHIEVEMENT:')
for row in c.execute("select id, project_id, screenshots from achievement_cards where project_id='f2a11545-2b53-488d-8c38-7048f3adc801'"):
    print(row)
