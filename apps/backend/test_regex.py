import re

text = '''<question type="single" title="你目前在读？">
  <option id="option_1" label="初一">刚开始接触编程或项目学习</option>
  <option id="option_2" label="初二">有一定基础，想挑战新项目</option>
</question>'''

pattern = r'<question[^>]*>(.*?)</question>'
match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
print(f'question match: {match is not None}')

if match:
    raw = match.group(1).strip()
    print(f'raw: {raw[:100]}')

    opt_pattern = r'<option\s+id=["\']([^"\']*)["\'][^>]*>(.*?)</option>'
    options = list(re.finditer(opt_pattern, raw, re.DOTALL | re.IGNORECASE))
    print(f'options found: {len(options)}')
    for om in options:
        print(f'  id={om.group(1)}, body={om.group(2)[:50]}')
