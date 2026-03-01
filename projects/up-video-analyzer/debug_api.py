"""
调试 B 站 API 返回数据
查看完整的 API 响应
"""

import requests
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.bilibili.com'
}

# 测试视频
bvid = "BV1tnBmYEExK"

# 1. 获取视频信息
print("=" * 60)
print("1. 获取视频信息")
print("=" * 60)
info_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
print(f"URL: {info_url}")
response = requests.get(info_url, headers=headers)
data = response.json()
print(f"Code: {data.get('code')}")
print(f"Message: {data.get('message')}")

if data.get('code') == 0:
    video_data = data['data']
    aid = video_data['aid']
    cid = video_data['cid']
    title = video_data['title']
    print(f"标题: {title}")
    print(f"AID: {aid}")
    print(f"CID: {cid}")
    
    # 2. 获取字幕信息
    print("\n" + "=" * 60)
    print("2. 获取字幕信息")
    print("=" * 60)
    
    # 尝试多个 API
    apis = [
        f"https://api.bilibili.com/x/player/v2?aid={aid}&cid={cid}",
        f"https://api.bilibili.com/x/player.so?id=cid:{cid}",
        f"https://api.bilibili.com/x/player/wbi/v2?aid={aid}&cid={cid}",
    ]
    
    for api_url in apis:
        print(f"\n尝试: {api_url}")
        try:
            resp = requests.get(api_url, headers=headers, timeout=10)
            resp_data = resp.json()
            print(f"Code: {resp_data.get('code')}")
            print(f"Message: {resp_data.get('message')}")
            
            if resp_data.get('code') == 0:
                print("完整数据:")
                print(json.dumps(resp_data.get('data', {}), ensure_ascii=False, indent=2)[:2000])
                
                # 检查字幕
                data_obj = resp_data.get('data', {})
                subtitle = data_obj.get('subtitle', {})
                print(f"\nsubtitle 字段: {subtitle}")
                
                if subtitle:
                    subtitles = subtitle.get('subtitles', []) or subtitle.get('list', [])
                    print(f"字幕列表: {subtitles}")
        except Exception as e:
            print(f"错误: {e}")
