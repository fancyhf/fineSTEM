import re

def _contains_question_block(text):
    if not text:
        return False
    markers = ["<question>", "【提问】", "[提问]", "::question::", "{{question}}"]
    return any(m in text.lower() for m in markers)

def strip_question_xml(text):
    if not text:
        return text, False
    has_question = _contains_question_block(text)
    cleaned = re.sub(
        r'<question[^>]*>.*?</question>',
        '',
        text,
        flags=re.DOTALL | re.IGNORECASE
    )
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip(), has_question

# 模拟第2轮的文本
text2 = '''你好！我是 fineSTEM 助教，很高兴见到你！

初中阶段正是探索 STEM 项目的好时候！你已经掌握了一些基础知识，现在可以开始尝试更有趣的项目了。
你对哪个方向最感兴趣？是一些和**编程**有关的项目，还是**科学实验**、**数据分析**、或者**人工智能**？

如果你还不确定具体做什么，我来帮你推荐几个适合初中生的有趣项目：

<question type="single" title="你目前在读？">
  <option id="option_1" label="初一">刚开始接触编程或项目学习</option>
  <option id="option_2" label="初二">有一定基础，想挑战新项目</option>
  <option id="option_3" label="初三">备战中考或准备升学作品</option>
</question>

告诉我你的选择，我们就从这里开始！'''

print(f'原始文本长度: {len(text2)}')
print(f'包含 <question>: {"<question" in text2.lower()}')

cleaned, has_q = strip_question_xml(text2)
print(f'has_question: {has_q}')
print(f'清理后长度: {len(cleaned)}')
print(f'清理后包含 <question>: {"<question" in cleaned.lower()}')
