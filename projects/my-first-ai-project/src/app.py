from flask import Flask, render_template, request, jsonify, redirect, url_for
import json
import os
import random
import requests
from bs4 import BeautifulSoup
import re

# 获取当前文件所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 项目根目录
PROJECT_DIR = os.path.dirname(BASE_DIR)

app = Flask(__name__, 
            template_folder=os.path.join(PROJECT_DIR, 'templates'),
            static_folder=os.path.join(PROJECT_DIR, 'static'))
app.config['SECRET_KEY'] = '文学天团-secret-key-2026'

DATA_FILE = os.path.join(PROJECT_DIR, 'data', 'poetry_data.json')

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return get_default_data()

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_default_data():
    return {
        "poetry": [
            {
                "id": 1,
                "title": "静夜思",
                "author": "李白",
                "dynasty": "唐",
                "content": "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
                "category": "唐诗",
                "is_favorite": False,
                "image_url": ""
            },
            {
                "id": 2,
                "title": "春晓",
                "author": "孟浩然",
                "dynasty": "唐",
                "content": "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。",
                "category": "唐诗",
                "is_favorite": False,
                "image_url": ""
            },
            {
                "id": 3,
                "title": "登鹳雀楼",
                "author": "王之涣",
                "dynasty": "唐",
                "content": "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
                "category": "唐诗",
                "is_favorite": False,
                "image_url": ""
            }
        ],
        "categories": ["唐诗", "宋词", "元曲", "文学常识"]
    }

@app.route('/')
def index():
    data = load_data()
    search_query = request.args.get('search', '')
    category_filter = request.args.get('category', 'all')
    
    filtered_poetry = data['poetry']
    
    if search_query:
        filtered_poetry = [p for p in filtered_poetry 
                         if search_query.lower() in p['title'].lower() 
                         or search_query.lower() in p['author'].lower()
                         or search_query.lower() in p['content'].lower()]
    
    if category_filter != 'all':
        filtered_poetry = [p for p in filtered_poetry if p['category'] == category_filter]
    
    return render_template('index.html', 
                         poetry=filtered_poetry,
                         categories=data['categories'],
                         current_category=category_filter,
                         search_query=search_query)

@app.route('/add', methods=['GET', 'POST'])
def add_poetry():
    if request.method == 'POST':
        data = load_data()
        new_id = max([p['id'] for p in data['poetry']], default=0) + 1
        
        new_poetry = {
            'id': new_id,
            'title': request.form.get('title', ''),
            'author': request.form.get('author', ''),
            'dynasty': request.form.get('dynasty', ''),
            'content': request.form.get('content', ''),
            'category': request.form.get('category', '文学常识'),
            'is_favorite': False,
            'image_url': ''
        }
        
        data['poetry'].append(new_poetry)
        save_data(data)
        
        return redirect(url_for('index'))
    
    data = load_data()
    return render_template('add.html', categories=data['categories'])

def extract_poetry_from_web(url):
    """从网页提取诗词内容"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = response.apparent_encoding
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 尝试提取标题
        title = ""
        title_tags = soup.find(['h1', 'h2', 'h3', '.title', '.poem-title'])
        if title_tags:
            title = title_tags.get_text().strip()
        
        # 尝试提取作者
        author = ""
        author_patterns = ['作者', '诗人', '撰']
        for pattern in author_patterns:
            author_elem = soup.find(text=re.compile(pattern))
            if author_elem:
                parent = author_elem.parent
                author_text = parent.get_text()
                match = re.search(r'[作者诗人撰][:：]\s*([^\n]+)', author_text)
                if match:
                    author = match.group(1).strip()
                    break
        
        # 尝试提取内容
        content = ""
        # 查找包含诗句的段落
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text().strip()
            # 检查是否包含中文诗句特征
            if re.search(r'[，。！？；]', text) and len(text) > 10:
                content = text
                break
        
        # 如果找不到内容,尝试其他标签
        if not content:
            divs = soup.find_all('div')
            for div in divs:
                text = div.get_text().strip()
                if re.search(r'[，。！？；]', text) and len(text) > 10:
                    content = text
                    break
        
        return {
            'title': title or '未知标题',
            'author': author or '未知作者',
            'content': content or '未能提取到诗词内容',
            'dynasty': '未知朝代',
            'category': '唐诗'
        }
    except Exception as e:
        return {'error': str(e)}

@app.route('/import', methods=['GET', 'POST'])
def import_poetry():
    if request.method == 'POST':
        url = request.form.get('url', '')
        if not url:
            return jsonify({'success': False, 'message': '请输入网页链接'})
        
        result = extract_poetry_from_web(url)
        
        if 'error' in result:
            return jsonify({'success': False, 'message': f'导入失败: {result["error"]}'})
        
        # 保存到数据库
        data = load_data()
        new_id = max([p['id'] for p in data['poetry']], default=0) + 1
        
        new_poetry = {
            'id': new_id,
            'title': result['title'],
            'author': result['author'],
            'dynasty': result['dynasty'],
            'content': result['content'],
            'category': result['category'],
            'is_favorite': False,
            'image_url': '',
            'source_url': url
        }
        
        data['poetry'].append(new_poetry)
        save_data(data)
        
        return jsonify({
            'success': True, 
            'message': f'成功导入诗词《{result["title"]}》',
            'data': new_poetry
        })
    
    return render_template('import.html')

@app.route('/favorite/<int:poetry_id>')
def toggle_favorite(poetry_id):
    data = load_data()
    for poetry in data['poetry']:
        if poetry['id'] == poetry_id:
            poetry['is_favorite'] = not poetry['is_favorite']
            break
    save_data(data)
    return redirect(url_for('index'))

@app.route('/favorites')
def favorites():
    data = load_data()
    favorite_poetry = [p for p in data['poetry'] if p['is_favorite']]
    return render_template('index.html', 
                         poetry=favorite_poetry,
                         categories=data['categories'],
                         current_category='favorites',
                         search_query='',
                         is_favorites_view=True)

# 内置诗词库,用于自动搜集
POETRY_LIBRARY = [
    {
        "title": "望庐山瀑布",
        "author": "李白",
        "dynasty": "唐",
        "content": "日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。",
        "category": "唐诗"
    },
    {
        "title": "早发白帝城",
        "author": "李白",
        "dynasty": "唐",
        "content": "朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。",
        "category": "唐诗"
    },
    {
        "title": "送孟浩然之广陵",
        "author": "李白",
        "dynasty": "唐",
        "content": "故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。",
        "category": "唐诗"
    },
    {
        "title": "水调歌头",
        "author": "苏轼",
        "dynasty": "宋",
        "content": "明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。",
        "category": "宋词"
    },
    {
        "title": "念奴娇·赤壁怀古",
        "author": "苏轼",
        "dynasty": "宋",
        "content": "大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。乱石穿空，惊涛拍岸，卷起千堆雪。江山如画，一时多少豪杰。",
        "category": "宋词"
    },
    {
        "title": "天净沙·秋思",
        "author": "马致远",
        "dynasty": "元",
        "content": "枯藤老树昏鸦，小桥流水人家，古道西风瘦马。夕阳西下，断肠人在天涯。",
        "category": "元曲"
    },
    {
        "title": "咏鹅",
        "author": "骆宾王",
        "dynasty": "唐",
        "content": "鹅，鹅，鹅，曲项向天歌。白毛浮绿水，红掌拨清波。",
        "category": "唐诗"
    },
    {
        "title": "悯农",
        "author": "李绅",
        "dynasty": "唐",
        "content": "锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。",
        "category": "唐诗"
    }
]

@app.route('/api/auto_collect')
def auto_collect():
    try:
        data = load_data()
        existing_titles = {p['title'] for p in data['poetry']}
        
        added_count = 0
        for poem in POETRY_LIBRARY:
            if poem['title'] not in existing_titles:
                new_id = max([p['id'] for p in data['poetry']], default=0) + 1
                new_poetry = {
                    'id': new_id,
                    'title': poem['title'],
                    'author': poem['author'],
                    'dynasty': poem['dynasty'],
                    'content': poem['content'],
                    'category': poem['category'],
                    'is_favorite': False,
                    'image_url': '',
                    'source': '自动搜集'
                }
                data['poetry'].append(new_poetry)
                added_count += 1
        
        save_data(data)
        
        return jsonify({
            'success': True,
            'message': f'成功搜集到 {added_count} 首新诗词!',
            'added_count': added_count,
            'total_count': len(data['poetry'])
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'自动搜集失败: {str(e)}'
        })

# AI生成二次元漫画功能 - 使用SiliconFlow API
# SiliconFlow Configuration - 从环境变量或配置文件读取
import os

# 尝试从环境变量读取，如果没有则使用硬编码的key（仅用于开发测试）
SILICONFLOW_API_KEY = os.environ.get('SILICONFLOW_API_KEY', 'sk-mqyhprbiobyydcqxtvbipknsfkdeqtndoucaqjkduvcdespg')
SILICONFLOW_BASE_URL = os.environ.get('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn/v1')
# 使用图像生成模型 - FLUX.1-dev 是SiliconFlow上可用的模型
SILICONFLOW_IMAGE_MODEL = "black-forest-labs/FLUX.1-dev"

# 用于存储错误信息，方便调试
last_error_message = ""

def generate_anime_image(poetry_title, poetry_content):
    """
    为诗词生成二次元卡哇伊风格插画
    使用SiliconFlow API的图像生成模型
    """
    global last_error_message
    
    try:
        # 构建提示词 - 中文提示词更适合中国古诗词
        prompt = f"一幅可爱的二次元卡哇伊风格插画，描绘中国古诗《{poetry_title}》的意境。"
        prompt += f"诗句内容：{poetry_content[:30]}... "
        prompt += "风格：日系动漫，可爱萌系，柔和的粉色和淡紫色调，梦幻氛围，Q版人物，"
        prompt += "精致的背景，高清画质，温馨治愈"
        
        # 负面提示词 - 避免生成不希望的内容
        negative_prompt = "丑陋，变形，低质量，模糊，黑暗，恐怖，血腥，暴力，"
        negative_prompt += "写实风格，西方风格，过于复杂"
        
        print(f"正在调用SiliconFlow API生成图片...")
        print(f"API Key: {SILICONFLOW_API_KEY[:10]}...")
        print(f"模型: {SILICONFLOW_IMAGE_MODEL}")
        
        # 调用SiliconFlow图像生成API
        response = requests.post(
            f"{SILICONFLOW_BASE_URL}/images/generations",
            headers={
                "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": SILICONFLOW_IMAGE_MODEL,
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": 512,
                "height": 512,
                "num_inference_steps": 30,
                "guidance_scale": 7.5,
                "num_images_per_prompt": 1
            },
            timeout=120
        )
        
        print(f"API响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"API响应内容: {result}")
            
            # SiliconFlow返回的是base64编码的图片或URL
            if 'images' in result and len(result['images']) > 0:
                image_data = result['images'][0]
                # 如果是URL直接返回
                if isinstance(image_data, str) and image_data.startswith('http'):
                    last_error_message = ""
                    return image_data
                # 如果是base64,保存为文件并返回路径
                elif isinstance(image_data, dict) and 'url' in image_data:
                    last_error_message = ""
                    return image_data['url']
                elif isinstance(image_data, dict) and 'b64_json' in image_data:
                    # 处理base64编码的图片
                    import base64
                    from datetime import datetime
                    
                    # 创建images目录
                    images_dir = os.path.join(PROJECT_DIR, 'static', 'images')
                    os.makedirs(images_dir, exist_ok=True)
                    
                    # 生成文件名
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"poetry_{timestamp}.png"
                    filepath = os.path.join(images_dir, filename)
                    
                    # 保存图片
                    with open(filepath, 'wb') as f:
                        f.write(base64.b64decode(image_data['b64_json']))
                    
                    # 返回相对路径
                    last_error_message = ""
                    return f"/static/images/{filename}"
            
            last_error_message = f"API返回数据格式不正确: {result}"
            print(last_error_message)
            return ''
        else:
            last_error_message = f"API调用失败，状态码: {response.status_code}, 响应: {response.text}"
            print(last_error_message)
            return ''
        
    except Exception as e:
        last_error_message = f"生成图片异常: {str(e)}"
        print(last_error_message)
        import traceback
        traceback.print_exc()
        return ''

@app.route('/api/generate_image/<int:poetry_id>')
def generate_poetry_image(poetry_id):
    """为指定诗词生成二次元插画"""
    global last_error_message
    
    try:
        data = load_data()
        poetry = None
        for p in data['poetry']:
            if p['id'] == poetry_id:
                poetry = p
                break
        
        if not poetry:
            return jsonify({'success': False, 'message': '诗词不存在'})
        
        # 生成图片
        image_url = generate_anime_image(poetry['title'], poetry['content'])
        
        if image_url:
            # 保存图片URL
            poetry['image_url'] = image_url
            save_data(data)
            return jsonify({
                'success': True, 
                'message': '二次元插画生成成功!',
                'image_url': image_url
            })
        else:
            # 返回详细的错误信息
            error_msg = last_error_message if last_error_message else '生成图片失败，请检查API配置或网络连接'
            return jsonify({
                'success': False, 
                'message': f'生成失败: {error_msg}'
            })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'message': f'生成失败: {str(e)}'
        })

@app.route('/stats')
def stats():
    """数据统计页面 - 展示诗词库的统计信息"""
    data = load_data()
    poetry_list = data['poetry']
    
    # 统计1: 总数量
    total_count = len(poetry_list)
    
    # 统计2: 收藏数量
    favorite_count = len([p for p in poetry_list if p.get('is_favorite', False)])
    
    # 统计3: 各朝代数量 (使用字典)
    dynasty_count = {}
    for poem in poetry_list:
        dynasty = poem.get('dynasty', '未知')
        if dynasty in dynasty_count:
            dynasty_count[dynasty] += 1
        else:
            dynasty_count[dynasty] = 1
    
    # 统计4: 各分类数量
    category_count = {}
    for poem in poetry_list:
        category = poem.get('category', '未分类')
        if category in category_count:
            category_count[category] += 1
        else:
            category_count[category] = 1
    
    # 统计5: 有插画的数量
    image_count = len([p for p in poetry_list if p.get('image_url')])
    
    return render_template('stats.html',
                         total_count=total_count,
                         favorite_count=favorite_count,
                         dynasty_count=dynasty_count,
                         category_count=category_count,
                         image_count=image_count)

if __name__ == '__main__':
    data_dir = os.path.join(PROJECT_DIR, 'data')
    os.makedirs(data_dir, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        save_data(get_default_data())
    
    app.run(debug=True, port=5000)
