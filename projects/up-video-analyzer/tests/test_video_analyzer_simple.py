"""
UP 主视频内容分析器 - 自动化测试（使用系统 Chrome）
测试视频 URL 字幕提取功能
"""

import time
import sys
sys.path.insert(0, 'g:\\mediaProjects\\fineSTEM\\projects\\up-video-analyzer\\src')

from playwright.sync_api import sync_playwright


def test_video_analyzer():
    """测试视频分析器功能"""
    
    BASE_URL = "http://localhost:8501"
    TEST_VIDEO_URL = "https://www.bilibili.com/video/BV1cH4y1Z7HM/?spm_id_from=333.337.search-card.all.click&vd_source=ad236b930e655bdc87fa0b67763858b8"
    
    print("=" * 60)
    print("UP 主视频内容分析器 - 自动化测试")
    print("=" * 60)
    
    with sync_playwright() as p:
        # 使用系统已安装的 Chrome
        browser = p.chromium.launch(
            headless=False,
            slow_mo=100,
            executable_path="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        )
        
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        try:
            # 1. 测试页面加载
            print("\n[测试 1/5] 页面加载测试...")
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            
            title = page.title()
            print(f"  页面标题: {title}")
            
            # 检查页面内容
            content = page.content()
            if "UP 主视频内容分析器" in content or "视频内容分析器" in content:
                print("  ✅ 页面加载成功")
            else:
                print("  ⚠️ 页面标题可能不匹配，但页面已加载")
            
            # 2. 测试输入框
            print("\n[测试 2/5] 输入框测试...")
            
            # 先点击"粘贴视频链接"选项
            try:
                radio = page.locator("text=粘贴视频链接").first
                if radio.is_visible():
                    radio.click()
                    print("  ✅ 已选择「粘贴视频链接」选项")
                    time.sleep(1)
            except Exception as e:
                print(f"  ⚠️ 选择输入方式时出错: {e}")
            
            # 查找输入框
            input_selector = "input[type='text']"
            input_element = page.locator(input_selector).first
            
            if input_element.is_visible():
                # 检查宽度
                bbox = input_element.bounding_box()
                width = bbox['width']
                print(f"  输入框宽度: {width}px")
                
                if width > 400:
                    print("  ✅ 输入框已加宽")
                else:
                    print(f"  ⚠️ 输入框宽度 {width}px 可能未满足加宽要求")
                
                # 3. 输入视频 URL
                print("\n[测试 3/5] 视频 URL 输入测试...")
                input_element.fill(TEST_VIDEO_URL)
                input_value = input_element.input_value()
                
                if TEST_VIDEO_URL in input_value:
                    print(f"  ✅ URL 输入成功")
                    print(f"  输入内容: {input_value[:60]}...")
                else:
                    print(f"  ❌ URL 输入失败")
                
                # 4. 点击"下载视频提取"按钮
                print("\n[测试 4/5] 字幕提取测试...")
                print("  等待页面稳定...")
                time.sleep(2)
                
                # 查找"下载视频提取"按钮
                button_selectors = [
                    "button:has-text('下载视频提取')",
                    "button:has-text('提取')",
                    "button:has-text('分析')",
                    "button[kind='secondary']",
                    "button"
                ]
                
                download_btn = None
                for selector in button_selectors:
                    try:
                        btn = page.locator(selector).first
                        if btn.is_visible():
                            btn_text = btn.text_content()
                            print(f"  找到按钮: {btn_text}")
                            if '下载' in btn_text or '提取' in btn_text:
                                download_btn = btn
                                break
                    except:
                        continue
                
                if download_btn:
                    print("  点击「下载视频提取」按钮...")
                    download_btn.click()
                else:
                    print("  未找到特定按钮，尝试按回车...")
                    input_element.press("Enter")
                
                # 5. 等待处理结果
                print("\n[测试 5/5] 等待处理结果...")
                print("  视频下载和语音识别可能需要几分钟...")
                
                # 等待处理开始
                time.sleep(5)
                
                # 检查页面状态
                max_wait = 300  # 最多等待 5 分钟
                check_interval = 10
                total_wait = 0
                
                while total_wait < max_wait:
                    time.sleep(check_interval)
                    total_wait += check_interval
                    
                    current_content = page.content()
                    
                    # 检查成功状态
                    if "成功" in current_content and ("字幕" in current_content or "识别" in current_content):
                        print(f"  ✅ 字幕提取成功！用时 {total_wait} 秒")
                        
                        # 尝试获取字幕内容预览
                        try:
                            # 查找可能包含字幕内容的元素
                            text_areas = page.locator("textarea, .stTextArea textarea").all()
                            if text_areas:
                                subtitle_preview = text_areas[0].input_value()[:200]
                                print(f"  字幕预览: {subtitle_preview}...")
                        except:
                            pass
                        
                        break
                    
                    # 检查错误状态
                    elif "失败" in current_content or "error" in current_content.lower():
                        print(f"  ❌ 处理失败，用时 {total_wait} 秒")
                        
                        # 尝试获取错误信息
                        try:
                            error_elements = page.locator("text=失败, text=error, text=出错, text=错误").all()
                            for elem in error_elements:
                                if elem.is_visible():
                                    print(f"  错误信息: {elem.text_content()}")
                        except:
                            pass
                        
                        break
                    
                    # 检查处理中状态
                    elif "下载" in current_content or "识别" in current_content or "处理" in current_content:
                        print(f"  ⏳ 处理中... 已等待 {total_wait} 秒")
                    else:
                        print(f"  ⏳ 等待中... 已等待 {total_wait} 秒")
                
                else:
                    print(f"  ⚠️ 等待超时（{max_wait}秒），请手动检查结果")
                
            else:
                print("  ❌ 未找到输入框")
            
            # 截图保存
            screenshot_path = f"g:/mediaProjects/fineSTEM/projects/up-video-analyzer/tests/screenshot_final_{int(time.time())}.png"
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"\n📸 截图已保存: {screenshot_path}")
            
        except Exception as e:
            print(f"\n❌ 测试过程中出错: {e}")
            import traceback
            traceback.print_exc()
            
            # 出错时也截图
            try:
                screenshot_path = f"g:/mediaProjects/fineSTEM/projects/up-video-analyzer/tests/screenshot_error_{int(time.time())}.png"
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"📸 错误截图已保存: {screenshot_path}")
            except:
                pass
        
        finally:
            context.close()
            browser.close()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


def test_api_directly():
    """直接测试 API 功能"""
    print("\n" + "=" * 60)
    print("直接测试视频字幕提取 API")
    print("=" * 60)
    
    TEST_VIDEO_URL = "https://www.bilibili.com/video/BV1cH4y1Z7HM/?spm_id_from=333.337.search-card.all.click&vd_source=ad236b930e655bdc87fa0b67763858b8"
    
    try:
        from video_to_subtitle import extract_subtitle_from_video
        
        print(f"\n测试视频 URL: {TEST_VIDEO_URL}")
        print("开始提取字幕...\n")
        
        content, message = extract_subtitle_from_video(TEST_VIDEO_URL)
        
        print(f"\n结果消息: {message}")
        
        if content:
            print(f"\n✅ 成功提取字幕！")
            print(f"字幕长度: {len(content)} 字符")
            print(f"\n字幕预览（前500字符）:")
            print("-" * 60)
            print(content[:500])
            print("-" * 60)
            return True
        else:
            print(f"\n❌ 未能提取字幕")
            return False
            
    except Exception as e:
        print(f"\n❌ API 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="视频分析器自动化测试")
    parser.add_argument("--api-only", action="store_true", help="仅测试 API")
    parser.add_argument("--ui-only", action="store_true", help="仅测试 UI")
    
    args = parser.parse_args()
    
    if args.api_only:
        test_api_directly()
    elif args.ui_only:
        test_video_analyzer()
    else:
        # 先测试 API
        api_success = test_api_directly()
        
        # 再测试 UI
        print("\n" + "=" * 60)
        print("接下来进行 UI 自动化测试...")
        print("=" * 60)
        time.sleep(2)
        
        test_video_analyzer()
