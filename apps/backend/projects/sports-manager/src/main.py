import streamlit as st
from datetime import datetime, date

# ===== 运动小管家 v1.0 =====
# 活力橙主题 🟠 运动感十足

st.set_page_config(page_title="运动小管家", page_icon="🏃", layout="centered")

# 自定义样式 - 活力橙主题
st.markdown("""
<style>
    .main-header { text-align: center; font-size: 2.5rem; color: #FF6B00; font-weight: bold; margin-bottom: 0.5rem; }
    .sub-header { text-align: center; font-size: 1rem; color: #666; margin-bottom: 2rem; }
    .stat-card { background: #FFF3E6; border-radius: 15px; padding: 1rem; text-align: center; border: 1px solid #FFD9B3; }
    .stat-number { font-size: 2rem; font-weight: bold; color: #FF6B00; }
    .stat-label { font-size: 0.8rem; color: #888; }
    .task-item { background: white; border-radius: 10px; padding: 0.8rem 1rem; margin: 0.5rem 0; border: 1px solid #EEE; display: flex; align-items: center; }
    .task-done { background: #F0FFF0; border-color: #90EE90; text-decoration: line-through; color: #999; }
    .progress-bar { height: 20px; background: #EEE; border-radius: 10px; overflow: hidden; margin: 1rem 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #FF8C00, #FF6B00); border-radius: 10px; transition: width 0.5s; }
    .fire { font-size: 1.5rem; }
</style>
""", unsafe_allow_html=True)

# 初始化 session state
if "plans" not in st.session_state:
    st.session_state.plans = {}
if "today_date" not in st.session_state:
    st.session_state.today_date = str(date.today())

today = st.session_state.today_date

# ===== 页头 =====
st.markdown(f'<div class="main-header">🏃 运动小管家</div>', unsafe_allow_html=True)
st.markdown(f'<div class="sub-header">今日是 {today} · 动起来，更健康！🔥</div>', unsafe_allow_html=True)

# ===== 统计卡片 =====
total_plans = len(st.session_state.plans.get(today, []))
done_plans = sum(1 for p in st.session_state.plans.get(today, []) if p["done"])
progress = int((done_plans / total_plans * 100)) if total_plans > 0 else 0

col1, col2, col3 = st.columns(3)
with col1:
    st.markdown(f'<div class="stat-card"><div class="stat-number">{total_plans}</div><div class="stat-label">📋 今日计划</div></div>', unsafe_allow_html=True)
with col2:
    st.markdown(f'<div class="stat-card"><div class="stat-number">{done_plans}</div><div class="stat-label">✅ 已完成</div></div>', unsafe_allow_html=True)
with col3:
    st.markdown(f'<div class="stat-card"><div class="stat-number">{progress}%</div><div class="stat-label">📊 完成率</div></div>', unsafe_allow_html=True)

# ===== 进度条 =====
if total_plans > 0:
    st.markdown(f'<div class="progress-bar"><div class="progress-fill" style="width:{progress}%"></div></div>', unsafe_allow_html=True)

st.markdown("---")

# ===== 新增计划 =====
st.subheader("📝 新增运动计划")
col_a, col_b = st.columns([3, 1])
with col_a:
    new_plan = st.text_input("运动名称", placeholder="比如：跑步2公里、跳绳500个...", label_visibility="collapsed")
with col_b:
    if st.button("➕ 添加", use_container_width=True):
        if new_plan.strip():
            if today not in st.session_state.plans:
                st.session_state.plans[today] = []
            st.session_state.plans[today].append({"name": new_plan.strip(), "done": False})
            st.rerun()
        else:
            st.warning("请输入运动名称！")

st.markdown("---")

# ===== 今日计划列表 =====
st.subheader("📋 今日计划")
if today in st.session_state.plans and st.session_state.plans[today]:
    for i, plan in enumerate(st.session_state.plans[today]):
        done_class = "task-done" if plan["done"] else ""
        emoji = "✅" if plan["done"] else "⭕"
        btn_label = "✅ 已完成" if not plan["done"] else "↩️ 撤销"
        col_x, col_y, col_z = st.columns([0.5, 4, 1.5])
        with col_x:
            st.markdown(emoji)
        with col_y:
            st.markdown(f'<div class="task-item {done_class}">{plan["name"]}</div>', unsafe_allow_html=True)
        with col_z:
            if st.button(btn_label, key=f"btn_{i}", use_container_width=True):
                st.session_state.plans[today][i]["done"] = not plan["done"]
                st.rerun()
else:
    st.info("🎯 今天还没有运动计划，快添加一个吧！")

st.markdown("---")

# ===== 连续天数统计 =====
st.subheader("🔥 连续打卡天数")
sorted_dates = sorted(st.session_state.plans.keys(), reverse=True)
streak = 0
for d in sorted_dates:
    plans_today = st.session_state.plans[d]
    if plans_today and all(p["done"] for p in plans_today):
        streak += 1
    else:
        break

st.markdown(f'<div style="text-align:center;font-size:3rem;">{"🔥" * min(streak, 5)}</div>', unsafe_allow_html=True)
st.markdown(f'<div style="text-align:center;font-size:1.5rem;color:#FF6B00;font-weight:bold;">连续打卡 {streak} 天！</div>', unsafe_allow_html=True)

# ===== 页脚 =====
st.markdown("---")
st.caption("🏃 运动小管家 · 每天动一动，身体更健康！")
