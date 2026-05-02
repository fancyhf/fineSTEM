text = '''<question type="single" title="你目前在读？">'''

markers = ["<question>", "【提问】", "[提问]", "::question::", "{{question}}"]
result = any(m in text.lower() for m in markers)
print(f'text: {text[:50]}')
print(f'markers: {markers}')
print(f'result: {result}')

# 检查每个 marker
for m in markers:
    print(f'  "{m}" in text: {m in text.lower()}')
