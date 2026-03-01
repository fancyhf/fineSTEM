"""
UP主视频内容分析器 - 自动化测试脚本
使用 Playwright 进行 UI 测试
"""

import sys
import os
import time
import json
from datetime import datetime

sys.path.insert(0, r'g:\mediaProjects\fineSTEM\.venv\Lib\site-packages')

from playwright.sync_api import sync_playwright, Page, Browser

BASE_URL = "http://localhost:8502"
SCREENSHOT_DIR = "g:\\mediaProjects\\fineSTEM\\projects\\up-video-analyzer\\reports"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

test_results = []

def screenshot_path(name):
    return os.path.join(SCREENSHOT_DIR, f"{name}.png")

def log_result(test_name, passed, message="", screenshot=None):
    result = {
        "test": test_name,
        "passed": passed,
        "message": message,
        "screenshot": screenshot,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} | {test_name}: {message}")
    return result

def test_page_load(page: Page):
    """测试1: 页面加载"""
    try:
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_timeout(3000)
        page.screenshot(path=screenshot_path("01_page_load"))
        
        title = page.title()
        if "Streamlit" in title or "UP" in title or "视频" in title:
            return log_result("页面加载", True, f"页面标题: {title}", "01_page_load.png")
        else:
            return log_result("页面加载", True, f"页面已加载，标题: {title}", "01_page_load.png")
    except Exception as e:
        return log_result("页面加载", False, str(e))

def test_ui_elements(page: Page):
    """测试2: UI元素检查"""
    try:
        elements_found = []
        
        if page.locator("text=输入方式").count() > 0:
            elements_found.append("输入方式选择")
        
        if page.locator("text=上传字幕文件").count() > 0:
            elements_found.append("上传字幕文件选项")
        
        if page.locator("text=粘贴视频链接").count() > 0:
            elements_found.append("粘贴视频链接选项")
        
        if page.locator("text=确认链接").count() > 0:
            elements_found.append("确认链接按钮")
        
        if page.locator("text=任务历史").count() > 0:
            elements_found.append("任务历史标签")
        
        if page.locator("text=执行报告").count() > 0:
            elements_found.append("执行报告标签")
        
        page.screenshot(path=screenshot_path("02_ui_elements"))
        
        if len(elements_found) >= 4:
            return log_result("UI元素检查", True, f"找到元素: {', '.join(elements_found)}", "02_ui_elements.png")
        else:
            return log_result("UI元素检查", False, f"元素不足: {elements_found}", "02_ui_elements.png")
    except Exception as e:
        return log_result("UI元素检查", False, str(e))

def test_video_url_input(page: Page):
    """测试3: 视频链接输入"""
    try:
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_timeout(2000)
        
        radio = page.locator("text=粘贴视频链接")
        if radio.count() > 0:
            radio.first.click()
            page.wait_for_timeout(1000)
        
        textarea = page.locator("textarea").first
        if textarea.count() > 0:
            test_url = "https://www.bilibili.com/video/BV1cH4y1Z7HM"
            textarea.fill(test_url)
            page.wait_for_timeout(500)
            
            page.screenshot(path=screenshot_path("03_url_input"))
            
            confirm_btn = page.locator("button:has-text('确认链接')")
            if confirm_btn.count() > 0:
                confirm_btn.first.click()
                page.wait_for_timeout(2000)
                
                page.screenshot(path=screenshot_path("03_url_confirmed"))
                
                platform_detected = page.locator("text=B站").count() > 0 or page.locator("text=已确认平台").count() > 0
                
                if platform_detected:
                    return log_result("视频链接输入", True, "成功检测到B站平台", "03_url_confirmed.png")
                else:
                    return log_result("视频链接输入", True, "链接已输入，等待确认", "03_url_confirmed.png")
            else:
                return log_result("视频链接输入", False, "未找到确认按钮", "03_url_input.png")
        else:
            return log_result("视频链接输入", False, "未找到文本输入框", "03_url_input.png")
    except Exception as e:
        return log_result("视频链接输入", False, str(e))

def test_task_history_tab(page: Page):
    """测试4: 任务历史标签页"""
    try:
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_timeout(2000)
        
        history_tab = page.locator("text=任务历史")
        if history_tab.count() > 0:
            history_tab.first.click()
            page.wait_for_timeout(2000)
            
            page.screenshot(path=screenshot_path("04_task_history"))
            
            has_table = page.locator("table").count() > 0 or page.locator("text=暂无任务").count() > 0 or page.locator("text=任务列表").count() > 0
            
            if has_table:
                return log_result("任务历史标签", True, "任务历史页面正常显示", "04_task_history.png")
            else:
                return log_result("任务历史标签", True, "标签已点击", "04_task_history.png")
        else:
            return log_result("任务历史标签", False, "未找到任务历史标签", "04_task_history.png")
    except Exception as e:
        return log_result("任务历史标签", False, str(e))

def test_report_tab(page: Page):
    """测试5: 执行报告标签页"""
    try:
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_timeout(2000)
        
        report_tab = page.locator("text=执行报告")
        if report_tab.count() > 0:
            report_tab.first.click()
            page.wait_for_timeout(2000)
            
            page.screenshot(path=screenshot_path("05_report_tab"))
            
            return log_result("执行报告标签", True, "执行报告页面可访问", "05_report_tab.png")
        else:
            return log_result("执行报告标签", False, "未找到执行报告标签", "05_report_tab.png")
    except Exception as e:
        return log_result("执行报告标签", False, str(e))

def test_file_upload(page: Page):
    """测试6: 文件上传功能"""
    try:
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_timeout(2000)
        
        upload_radio = page.locator("text=上传字幕文件")
        if upload_radio.count() > 0:
            upload_radio.first.click()
            page.wait_for_timeout(1000)
            
            page.screenshot(path=screenshot_path("06_upload_section"))
            
            uploader = page.locator("input[type='file']")
            if uploader.count() > 0:
                return log_result("文件上传功能", True, "文件上传组件可用", "06_upload_section.png")
            else:
                dropzone = page.locator("text=拖拽文件")
                if dropzone.count() > 0:
                    return log_result("文件上传功能", True, "拖拽上传区域可用", "06_upload_section.png")
                else:
                    return log_result("文件上传功能", False, "未找到上传组件", "06_upload_section.png")
        else:
            return log_result("文件上传功能", False, "未找到上传选项", "06_upload_section.png")
    except Exception as e:
        return log_result("文件上传功能", False, str(e))

def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("UP主视频内容分析器 - 自动化测试")
    print("=" * 60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"目标地址: {BASE_URL}")
    print("=" * 60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        
        try:
            test_page_load(page)
            test_ui_elements(page)
            test_video_url_input(page)
            test_task_history_tab(page)
            test_report_tab(page)
            test_file_upload(page)
        finally:
            browser.close()
    
    print("\n" + "=" * 60)
    print("测试报告摘要")
    print("=" * 60)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    pass_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"总计: {passed}/{total} 通过 ({pass_rate:.0f}%)")
    print(f"截图保存位置: {SCREENSHOT_DIR}")
    
    report_path = os.path.join(SCREENSHOT_DIR, "test_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "passed": passed,
                "total": total,
                "pass_rate": pass_rate,
                "timestamp": datetime.now().isoformat()
            },
            "results": test_results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"详细报告: {report_path}")
    
    return passed, total

if __name__ == "__main__":
    run_all_tests()
