# src/main.py - 混合大乱斗小测验 (完整版)
import streamlit as st
import random

# ---------- 题库（科学+历史+常识 混合大乱斗） ----------
QUESTIONS = [
    {
        "question": "🌍 地球的卫星是什么？",
        "options": ["月球", "太阳", "火星", "金星"],
        "answer": "月球",
        "cat": "科学"
    },
    {
        "question": "💡 光在真空中的传播速度约为？",
        "options": ["3×10⁸ m/s", "3×10⁶ m/s", "3×10⁵ m/s", "3×10⁷ m/s"],
        "answer": "3×10⁸ m/s",
        "cat": "科学"
    },
    {
        "question": "🧪 水的化学式是？",
        "options": ["H₂O", "CO₂", "NaCl", "O₂"],
        "answer": "H₂O",
        "cat": "科学"
    },
    {
        "question": "📜 中国四大发明不包括以下哪项？",
        "options": ["造纸术", "火药", "指南针", "陶瓷"],
        "answer": "陶瓷",
        "cat": "历史"
    },
    {
        "question": "🏛️ 古代埃及的法老被埋葬在哪里？",
        "options": ["金字塔", "长城", "斗兽场", "神庙"],
        "answer": "金字塔",
        "cat": "历史"
    },
    {
        "question": "📅 一年有几个月？",
        "options": ["10", "12", "11", "13"],
        "answer": "12",
        "cat": "常识"
    },
    {
        "question": "🐋 以下哪种动物是哺乳动物？",
        "options": ["鲨鱼", "鲸鱼", "鳄鱼", "章鱼"],
        "answer": "鲸鱼",
        "cat": "常识"
    },
    {
        "question": "🍎 一天吃几个水果比较好？",
        "options": ["1-2个", "5-6个", "越多越好", "不用吃"],
        "answer": "1-2个",
        "cat": "常识"
    },
]

# ---------- 初始化状态 ----------
if "page" not in st.session_state:
    st.session_state.page = "start"
if "score" not in st.session_state:
    st.session_state.score = 0
if "current_q" not in st.session_state:
    st.session_state.current_q = 0
if "questions_pool" not in st.session_state:
    pool = random.sample(QUESTIONS, min(5, len(QUESTIONS)))
    st.session_state.questions_pool = pool
    st.session_state.total = len(pool)
if "total" not in st.session_state:
    st.session_state.total = len(st.session_state.questions_pool)

st.set_page_config(page_title="混合大乱斗测验", page_icon="🧪", layout="centered")

if st.session_state.page == "start":
    st.title("🧪 混合大乱斗小测验")
    st.markdown("---")
    st.markdown("### 科学 ⚛️ | 历史 📜 | 常识 🧠")
    st.markdown("每题4个选项，选完提交，看看你能对几题！")
    st.markdown("")
    if st.button("🚀 开始答题", use_container_width=True):
        st.session_state.page = "quiz"
        st.rerun()

elif st.session_state.page == "quiz":
    q_list = st.session_state.questions_pool
    idx = st.session_state.current_q
    q_data = q_list[idx]

    progress = (idx) / st.session_state.total
    st.progress(progress)

    col1, col2 = st.columns([3, 1])
    with col1:
        st.subheader(f"📝 第 {idx + 1} / {st.session_state.total} 题")
    with col2:
        st.caption(f"得分：{st.session_state.score}")

    st.markdown(f"**{q_data['question']}**")
    st.caption(f"类别：{q_data['cat']}")

    selected = st.radio("选择你的答案：", q_data["options"], key=f"q_{idx}", label_visibility="collapsed")

    if st.button("✅ 提交答案", use_container_width=True):
        if selected == q_data["answer"]:
            st.success(f"✅ 回答正确！")
            st.session_state.score += 1
        else:
            st.error(f"❌ 正确答案是：**{q_data['answer']}**")

        if idx < st.session_state.total - 1:
            st.session_state.current_q += 1
            st.rerun()
        else:
            st.session_state.page = "result"
            st.rerun()

elif st.session_state.page == "result":
    score = st.session_state.score
    total = st.session_state.total

    st.title("🎉 测验结束！")

    if score == total:
        st.markdown("### 🌟 满分！你是知识大王！")
        st.balloons()
    elif score >= total * 0.6:
        st.markdown("### 👍 不错！继续加油！")
        st.success(f"你答对了 {score}/{total} 题")
    else:
        st.markdown("### 💪 多看看书，下次一定更好！")
        st.warning(f"你答对了 {score}/{total} 题")

    st.markdown("---")
    st.markdown("**📋 答题回顾：**")
    for i, q in enumerate(st.session_state.questions_pool):
        st.write(f"  {i+1}. {q['question']} → 正确答案：**{q['answer']}**")

    st.markdown("---")
    if st.button("🔄 再来一次", use_container_width=True):
        keys_to_del = ["page", "score", "current_q", "questions_pool", "total"]
        for k in keys_to_del:
            if k in st.session_state:
                del st.session_state[k]
        st.rerun()
