"""
调试 B 站 API 调用
"""

import requests
import json

# 测试视频 BV 号
bvid = "BV1CizeBPEf1"

print("=" * 60)
print("B 站 API 调试")
print("=" * 60)

# 1. 获取视频信息
print("\n1. 获取视频信息...")
url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.bilibili.com'
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    print(f"状态码：{response.status_code}")
    
    data = response.json()
    print(f"返回码：{data.get('code')}")
    
    if data.get('code') == 0:
        print(f"视频标题：{data['data']['title']}")
        print(f"视频 CID: {data['data']['cid']}")
        cid = data['data']['cid']
        
        # 2. 获取字幕列表
        print(f"\n2. 获取字幕列表 (CID: {cid})...")
        subtitle_url = f"https://api.bilibili.com/x/player/wbi/v2?cid={cid}"
        
        response2 = requests.get(subtitle_url, headers=headers, timeout=10)
        print(f"状态码：{response2.status_code}")
        
        data2 = response2.json()
        print(f"返回码：{data2.get('code')}")
        
        if data2.get('code') == 0:
            subtitle_info = data2['data'].get('subtitle', {})
            subtitles = subtitle_info.get('list', [])
            
            print(f"字幕数量：{len(subtitles)}")
            
            if subtitles:
                print("\n✅ 找到字幕！")
                for i, sub in enumerate(subtitles):
                    print(f"\n字幕 {i+1}:")
                    print(f"  语言：{sub.get('lan', 'N/A')}")
                    print(f"  标题：{sub.get('lan_doc', 'N/A')}")
                    print(f"  链接：{sub.get('subtitle_url', 'N/A')}")
            else:
                print("\n❌ 该视频没有字幕")
                print(f"完整返回：{json.dumps(data2, ensure_ascii=False, indent=2)}")
        else:
            print(f"获取字幕失败：{data2.get('message')}")
    else:
        print(f"获取视频信息失败：{data.get('message')}")
        
except Exception as e:
    print(f"错误：{e}")

print("\n" + "=" * 60)
