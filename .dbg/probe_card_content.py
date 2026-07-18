import sqlite3, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = sqlite3.connect(r'D:\data\finestem\finestem.db')
print('=== achievement card f2a11545 ===')
for row in c.execute("select id, title, one_liner, problem_solved, method_used, reflection, screenshots, capability_tags from achievement_cards where project_id='f2a11545-2b53-488d-8c38-7048f3adc801'"):
    cols = ['id','title','one_liner','problem_solved','method_used','reflection','screenshots','capability_tags']
    txt = ''
    for i, col in enumerate(cols):
        val = row[i]
        s = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
        txt += f'\n--- {col} ---\n{s[:600] if s else "(empty)"}\n'
    # search for image references
    print(txt)
    print('\n=== image.png / image refs in card ===')
    for kw in ['image.png', 'image', 'png', '截图', '图片']:
        if kw in txt:
            print(f'  FOUND keyword: {kw}')
print('\n=== evidence (all types, last 10) ===')
for row in c.execute("select id, type, title, content_url, substr(content,1,150) from evidence where project_id='f2a11545-2b53-488d-8c38-7048f3adc801' order by created_at desc limit 10"):
    print(row)
