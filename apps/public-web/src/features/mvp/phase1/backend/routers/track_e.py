from fastapi import APIRouter
import json
from datetime import datetime
import random

router = APIRouter(prefix="/track-e", tags=["Track E"])

@router.get("/dataset/mock")
async def get_mock_dataset():
    """
    返回用于 '动态条形图 (Bar Chart Race)' 可视化的模拟数据。
    场景: 编程语言流行度 (2000-2023)
    结构: 基于系列的 (兼容 ECharts 标准数据集)
    """
    timeline = [str(year) for year in range(2000, 2024)]
    categories = ["Python", "JavaScript", "Java", "C++", "C#", "PHP", "Go", "Rust"]
    
    # 初始化当前值
    current_values = {lang: random.randint(100, 500) for lang in categories}
    
    # 初始化系列结构: { "Python": [val2000, val2001...], ... }
    series_map = {lang: [] for lang in categories}
    
    for year in timeline:
        # 模拟每种语言在当年的增长/下降
        for lang in categories:
            # 随机增长因子逻辑
            if lang == "Python":
                # Python 起步缓慢，在 2012 年后爆发 (AI/大数据时代)
                if int(year) < 2012:
                    growth = random.uniform(1.05, 1.15)
                else:
                    growth = random.uniform(1.15, 1.35)
            elif lang == "JavaScript":
                # 持续稳定增长 (Web 时代)
                growth = random.uniform(1.1, 1.25)
            elif lang == "Rust":
                # 后期才存在/流行
                if int(year) < 2015:
                    growth = 1.0 # 保持平稳或理想情况下为 0，但这里保持简单
                    current_values[lang] = max(current_values[lang], 10) # 保持低位
                else:
                    growth = random.uniform(1.3, 1.5) # 爆发
            elif lang == "Go":
                 if int(year) < 2010:
                    current_values[lang] = max(current_values[lang], 20)
                    growth = 1.0
                 else:
                    growth = random.uniform(1.2, 1.4)
            elif lang == "PHP":
                # 早期爆发，随后相对于其他语言停滞/下降
                if int(year) < 2010:
                    growth = random.uniform(1.1, 1.2)
                else:
                    growth = random.uniform(0.95, 1.05)
            elif lang == "Java":
                # 稳定的企业级巨头
                growth = random.uniform(1.05, 1.15)
            else:
                # C++, C#
                growth = random.uniform(1.0, 1.15)
                
            # 应用增长
            current_values[lang] = int(current_values[lang] * growth)
            
            # 添加到系列
            series_map[lang].append(current_values[lang])

    # 转换为前端期望的列表格式: [{name: "Python", data: [...]}, ...]
    series_list = [
        {"name": lang, "data": series_map[lang]}
        for lang in categories
    ]

    return {
        "meta": {
            "title": "编程语言流行度演变",
            "subTitle": "由 FineSTEM 后端生成的模拟数据",
            "source": "模拟引擎",
            "updateTime": datetime.utcnow().isoformat()
        },
        "timeline": timeline,
        "categories": categories,
        "series": series_list
    }
