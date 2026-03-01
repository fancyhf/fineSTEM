"""
UP 主视频内容分析器 - 前端 API 测试
直接测试后端功能，无需浏览器
"""

import sys
import time
sys.path.insert(0, 'g:\\mediaProjects\\fineSTEM\\projects\\up-video-analyzer\\src')


def test_subtitle_extraction():
    """测试字幕提取功能"""
    
    test_cases = [
        {
            "name": "B站视频 - 都什么年代，谁还打传统白骨精",
            "url": "https://www.bilibili.com/video/BV1cH4y1Z7HM/?spm_id_from=333.337.search-card.all.click&vd_source=ad236b930e655bdc87fa0b67763858b8",
            "expected_platform": "B站"
        }
    ]
    
    print("=" * 70)
    print("UP 主视频内容分析器 - 字幕提取功能测试")
    print("=" * 70)
    
    from video_to_subtitle import extract_subtitle_from_video
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[测试 {i}/{len(test_cases)}] {test_case['name']}")
        print("-" * 70)
        print(f"URL: {test_case['url']}")
        print(f"预期平台: {test_case['expected_platform']}")
        print()
        
        start_time = time.time()
        
        try:
            content, message = extract_subtitle_from_video(test_case['url'])
            elapsed_time = time.time() - start_time
            
            print(f"处理时间: {elapsed_time:.2f} 秒")
            print(f"结果消息: {message}")
            
            if content:
                print(f"✅ 测试通过 - 成功提取字幕")
                print(f"字幕长度: {len(content)} 字符")
                print(f"\n字幕预览（前300字符）:")
                print("-" * 70)
                print(content[:300])
                print("-" * 70)
                
                results.append({
                    "name": test_case['name'],
                    "status": "PASS",
                    "message": message,
                    "content_length": len(content),
                    "time": elapsed_time
                })
            else:
                print(f"❌ 测试失败 - 未能提取字幕")
                results.append({
                    "name": test_case['name'],
                    "status": "FAIL",
                    "message": message,
                    "content_length": 0,
                    "time": elapsed_time
                })
                
        except Exception as e:
            elapsed_time = time.time() - start_time
            print(f"❌ 测试异常: {e}")
            import traceback
            traceback.print_exc()
            
            results.append({
                "name": test_case['name'],
                "status": "ERROR",
                "message": str(e),
                "content_length": 0,
                "time": elapsed_time
            })
    
    # 打印测试总结
    print("\n" + "=" * 70)
    print("测试总结")
    print("=" * 70)
    
    passed = sum(1 for r in results if r['status'] == 'PASS')
    failed = sum(1 for r in results if r['status'] == 'FAIL')
    errors = sum(1 for r in results if r['status'] == 'ERROR')
    
    print(f"总测试数: {len(results)}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"错误: {errors}")
    print()
    
    for r in results:
        status_icon = "✅" if r['status'] == 'PASS' else "❌" if r['status'] == 'FAIL' else "💥"
        print(f"{status_icon} {r['name']}")
        print(f"   状态: {r['status']}")
        print(f"   消息: {r['message']}")
        if r['content_length'] > 0:
            print(f"   字幕长度: {r['content_length']} 字符")
        print(f"   用时: {r['time']:.2f} 秒")
        print()
    
    return all(r['status'] == 'PASS' for r in results)


def test_yt_dlp():
    """测试 yt-dlp 是否正常工作"""
    print("=" * 70)
    print("yt-dlp 功能测试")
    print("=" * 70)
    
    import subprocess
    import sys
    import os
    
    # 添加项目 libs 目录到 Python 路径
    project_root = 'g:\\mediaProjects\\fineSTEM\\projects\\up-video-analyzer'
    libs_path = os.path.join(project_root, 'libs')
    if libs_path not in sys.path:
        sys.path.insert(0, libs_path)
    
    try:
        # 尝试导入 yt_dlp 模块
        import yt_dlp
        version = yt_dlp.version.__version__
        print(f"✅ yt-dlp 已安装")
        print(f"版本: {version}")
        return True
            
    except Exception as e:
        print(f"❌ yt-dlp 检查异常: {e}")
        return False


def test_siliconflow_api():
    """测试 SiliconFlow API 连接"""
    print("\n" + "=" * 70)
    print("SiliconFlow API 连接测试")
    print("=" * 70)
    
    import requests
    
    SILICONFLOW_API_KEY = "sk-mqyhprbiobyydcqxtvbipknsfkdeqtndoucaqjkduvcdespg"
    SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
    
    try:
        # 测试 API 连接
        url = f"{SILICONFLOW_BASE_URL}/models"
        headers = {
            "Authorization": f"Bearer {SILICONFLOW_API_KEY}"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            print("✅ SiliconFlow API 连接成功")
            data = response.json()
            models = data.get('data', [])
            
            # 查找 SenseVoice 模型
            sensevoice_models = [m for m in models if 'SenseVoice' in m.get('id', '')]
            if sensevoice_models:
                print(f"✅ 找到 SenseVoice 模型:")
                for m in sensevoice_models:
                    print(f"   - {m.get('id')}")
            else:
                print("⚠️ 未找到 SenseVoice 模型，但 API 连接正常")
            
            return True
        else:
            print(f"❌ API 连接失败: {response.status_code}")
            print(f"响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ API 连接异常: {e}")
        return False


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 70)
    print("UP 主视频内容分析器 - 完整测试套件")
    print("=" * 70)
    print()
    
    # 测试 1: yt-dlp
    yt_dlp_ok = test_yt_dlp()
    
    # 测试 2: SiliconFlow API
    api_ok = test_siliconflow_api()
    
    # 测试 3: 字幕提取
    if yt_dlp_ok and api_ok:
        subtitle_ok = test_subtitle_extraction()
    else:
        print("\n⚠️ 跳过字幕提取测试（依赖项检查失败）")
        subtitle_ok = False
    
    # 最终总结
    print("\n" + "=" * 70)
    print("最终测试报告")
    print("=" * 70)
    
    print(f"yt-dlp 检查: {'✅ 通过' if yt_dlp_ok else '❌ 失败'}")
    print(f"SiliconFlow API: {'✅ 通过' if api_ok else '❌ 失败'}")
    print(f"字幕提取功能: {'✅ 通过' if subtitle_ok else '❌ 失败'}")
    
    all_passed = yt_dlp_ok and api_ok and subtitle_ok
    
    print()
    if all_passed:
        print("🎉 所有测试通过！系统工作正常。")
    else:
        print("⚠️ 部分测试失败，请检查配置和依赖项。")
    
    return all_passed


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
