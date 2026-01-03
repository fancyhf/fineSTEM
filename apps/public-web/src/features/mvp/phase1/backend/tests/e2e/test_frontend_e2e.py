from playwright.sync_api import Page, expect
import pytest
import re

def test_homepage_loads(page: Page):
    """
    测试首页是否能正常加载，标题是否包含 FineSTEM
    """
    page.goto("/")
    
    # 检查标题
    expect(page).to_have_title(re.compile("FineSTEM"))
    
    # 检查 H1 标题
    expect(page.locator("h1")).to_contain_text("FineSTEM")
    
    # 检查 Track 按钮是否存在
    expect(page.get_by_text("Track A: 物理反直觉")).to_be_visible()
    expect(page.get_by_text("Track E: 数据可视化")).to_be_visible()

def test_console_errors(page: Page):
    """
    测试页面加载时是否有控制台错误
    """
    console_errors = []
    
    def handle_console(msg):
        if msg.type == "error":
            # 过滤一些非致命的错误或已知警告（如果有）
            console_errors.append(msg.text)
            
    page.on("console", handle_console)
    
    page.goto("/")
    page.wait_for_load_state("networkidle")
    
    assert len(console_errors) == 0, f"发现控制台错误: {console_errors}"

def test_navigation_to_track_a(page: Page):
    """
    测试导航到 Track A 页面
    """
    page.goto("/")
    
    # 点击 Track A 按钮
    # 注意：按钮文本可能包含图标，使用部分文本匹配
    page.get_by_text("Track A: 物理反直觉").click()
    
    # 验证 URL 变化
    expect(page).to_have_url(re.compile("/track-a"))
    
    # 验证新页面内容 (根据 TrackA 页面内容调整，这里假设有标题或特定元素)
    # expect(page.locator("h2")).to_contain_text("Track A") # 示例
