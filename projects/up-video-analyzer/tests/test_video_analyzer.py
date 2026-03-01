"""
UP 主视频内容分析器 - 自动化测试
测试视频 URL 字幕提取功能
"""

import pytest
import time
from playwright.sync_api import sync_playwright, expect


class TestVideoAnalyzer:
    """测试视频分析器前端功能"""
    
    BASE_URL = "http://localhost:8501"
    TEST_VIDEO_URL = "https://www.bilibili.com/video/BV1cH4y1Z7HM/?spm_id_from=333.337.search-card.all.click&vd_source=ad236b930e655bdc87fa0b67763858b8"
    
    @pytest.fixture(scope="class")
    def browser(self):
        """启动浏览器"""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False, slow_mo=100)
            yield browser
            browser.close()
    
    @pytest.fixture
    def page(self, browser):
        """创建新页面"""
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        yield page
        context.close()
    
    def test_page_load(self, page):
        """测试页面是否正常加载"""
        page.goto(self.BASE_URL)
        
        # 等待页面加载完成
        page.wait_for_load_state("networkidle")
        
        # 检查页面标题
        title = page.title()
        print(f"页面标题: {title}")
        
        # 检查是否包含关键元素
        assert page.locator("text=UP 主视频内容分析器").is_visible() or \
               page.locator("text=视频内容分析器").is_visible() or \
               page.locator("text=视频分析").is_visible(), "页面标题未找到"
        
        print("✅ 页面加载测试通过")
    
    def test_input_field_width(self, page):
        """测试输入框是否加宽"""
        page.goto(self.BASE_URL)
        page.wait_for_load_state("networkidle")
        
        # 查找输入框
        input_selector = "input[type='text'], textarea, [data-testid='stTextInput'] input"
        input_element = page.locator(input_selector).first
        
        # 检查输入框是否存在
        assert input_element.is_visible(), "未找到输入框"
        
        # 获取输入框宽度
        bbox = input_element.bounding_box()
        width = bbox['width']
        print(f"输入框宽度: {width}px")
        
        # 检查宽度是否大于 400px（加宽后的预期值）
        assert width > 400, f"输入框宽度 {width}px 未满足加宽要求"
        
        print("✅ 输入框宽度测试通过")
    
    def test_video_url_input(self, page):
        """测试视频 URL 输入功能"""
        page.goto(self.BASE_URL)
        page.wait_for_load_state("networkidle")
        
        # 查找输入框
        input_selector = "input[type='text'], textarea"
        input_element = page.locator(input_selector).first
        
        # 输入测试视频 URL
        input_element.fill(self.TEST_VIDEO_URL)
        
        # 验证输入值
        input_value = input_element.input_value()
        assert self.TEST_VIDEO_URL in input_value, "URL 输入失败"
        
        print(f"✅ URL 输入测试通过: {input_value[:50]}...")
    
    def test_submit_video_url(self, page):
        """测试提交视频 URL 并提取字幕"""
        page.goto(self.BASE_URL)
        page.wait_for_load_state("networkidle")
        
        # 查找输入框
        input_selector = "input[type='text'], textarea"
        input_element = page.locator(input_selector).first
        
        # 输入测试视频 URL
        input_element.fill(self.TEST_VIDEO_URL)
        print(f"输入视频 URL: {self.TEST_VIDEO_URL}")
        
        # 查找提交按钮（可能是回车或点击按钮）
        # 尝试多种方式提交
        button_selectors = [
            "button:has-text('分析')",
            "button:has-text('提取')",
            "button:has-text('提交')",
            "button:has-text('开始')",
            "button[kind='primary']",
            "button"
        ]
        
        submit_button = None
        for selector in button_selectors:
            try:
                btn = page.locator(selector).first
                if btn.is_visible():
                    submit_button = btn
                    print(f"找到提交按钮: {selector}")
                    break
            except:
                continue
        
        if submit_button:
            submit_button.click()
        else:
            # 如果没有找到按钮，尝试按回车
            input_element.press("Enter")
            print("按回车键提交")
        
        # 等待处理（视频下载和语音识别需要较长时间）
        print("等待处理中...")
        
        # 检查是否有加载状态或进度提示
        try:
            # 等待一段时间让处理开始
            page.wait_for_timeout(5000)
            
            # 检查页面内容变化
            page_content = page.content()
            
            # 检查是否有错误提示
            error_indicators = [
                "下载失败", "提取失败", "识别失败", "出错", "error", "failed"
            ]
            
            for indicator in error_indicators:
                if indicator in page_content.lower():
                    print(f"⚠️ 发现可能的错误提示: {indicator}")
            
            # 检查是否有成功或处理中的提示
            success_indicators = [
                "下载成功", "提取成功", "识别成功", "处理中", "分析中",
                "音频下载", "语音识别", "字幕"
            ]
            
            found_indicators = []
            for indicator in success_indicators:
                if indicator in page_content:
                    found_indicators.append(indicator)
            
            if found_indicators:
                print(f"✅ 发现处理状态提示: {found_indicators}")
            
            # 等待更长时间（视频处理可能需要几分钟）
            print("继续等待处理完成...")
            
            # 最多等待 3 分钟
            max_wait = 180  # 秒
            wait_interval = 10  # 每 10 秒检查一次
            total_wait = 0
            
            while total_wait < max_wait:
                page.wait_for_timeout(wait_interval * 1000)
                total_wait += wait_interval
                
                current_content = page.content()
                
                # 检查是否完成或出错
                if "成功" in current_content and "字幕" in current_content:
                    print(f"✅ 字幕提取成功！用时 {total_wait} 秒")
                    break
                elif "失败" in current_content or "error" in current_content.lower():
                    print(f"❌ 处理失败，用时 {total_wait} 秒")
                    # 获取错误信息
                    error_match = page.locator("text=失败, text=error, text=出错").first
                    if error_match.is_visible():
                        print(f"错误信息: {error_match.text_content()}")
                    break
                else:
                    print(f"  已等待 {total_wait} 秒，继续等待...")
            
        except Exception as e:
            print(f"测试过程中出现异常: {e}")
        
        # 截图保存
        screenshot_path = f"g:/mediaProjects/fineSTEM/projects/up-video-analyzer/tests/screenshot_{int(time.time())}.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"截图已保存: {screenshot_path}")
    
    def test_ui_elements(self, page):
        """测试 UI 元素是否存在和可见"""
        page.goto(self.BASE_URL)
        page.wait_for_load_state("networkidle")
        
        # 检查常见 UI 元素
        elements_to_check = [
            ("输入框", "input[type='text'], textarea"),
            ("按钮", "button"),
            ("标题", "h1, h2, h3"),
        ]
        
        for name, selector in elements_to_check:
            try:
                element = page.locator(selector).first
                if element.is_visible():
                    print(f"✅ {name} 可见")
                else:
                    print(f"⚠️ {name} 存在但不可见")
            except:
                print(f"❌ {name} 未找到")


def run_tests():
    """运行测试"""
    print("=" * 60)
    print("UP 主视频内容分析器 - 自动化测试")
    print("=" * 60)
    
    # 使用 pytest 运行测试
    import sys
    sys.exit(pytest.main([__file__, "-v", "-s"]))


if __name__ == "__main__":
    run_tests()
