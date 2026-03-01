"""
使用 Playwright 浏览器自动化提取 B 站字幕
这个方法不需要复杂的 API 签名，直接模拟用户访问
"""

from playwright.sync_api import sync_playwright
import json
import time
import re
from typing import Optional, Tuple


def extract_bilibili_subtitle_browser(url: str) -> Tuple[Optional[str], str]:
    """
    使用浏览器访问 B 站并提取字幕
    """
    try:
        with sync_playwright() as p:
            # 启动浏览器
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            page = context.new_page()
            
            # 访问视频页面
            print(f"正在访问：{url}")
            page.goto(url, wait_until='networkidle')
            
            # 等待页面加载
            time.sleep(3)
            
            # 尝试查找字幕按钮
            try:
                # 点击字幕按钮（如果存在）
                page.click('button:has-text("字幕")', timeout=2000)
                time.sleep(1)
            except:
                pass
            
            # 获取页面中的字幕文本
            subtitle_text = page.evaluate('''() => {
                // 尝试从页面中查找字幕
                const subtitleElements = document.querySelectorAll('.bpx-player-subtitle-panel-content');
                if (subtitleElements.length > 0) {
                    return Array.from(subtitleElements).map(el => el.textContent).join('\\n');
                }
                
                // 尝试从视频中提取
                const video = document.querySelector('video');
                if (video && video.textTracks && video.textTracks.length > 0) {
                    // 需要等待字幕加载
                    return '视频有字幕轨道，但需要特殊方式提取';
                }
                
                // 尝试从简介中提取
                const desc = document.querySelector('.video-desc');
                if (desc) {
                    return '简介：' + desc.textContent;
                }
                
                return null;
            }''')
            
            browser.close()
            
            if subtitle_text:
                if len(subtitle_text) > 50:
                    return subtitle_text, f"✅ 成功提取字幕\n共 {len(subtitle_text)} 字符"
                else:
                    return None, "❌ 该视频没有可用的字幕"
            else:
                return None, "❌ 该视频没有字幕"
                
    except Exception as e:
        return None, f"❌ 提取失败：{str(e)}"


if __name__ == "__main__":
    test_url = "https://www.bilibili.com/video/BV1CizeBPEf1/"
    content, message = extract_bilibili_subtitle_browser(test_url)
    print(f"\n{message}")
    if content:
        print(f"\n内容预览：{content[:500]}")
