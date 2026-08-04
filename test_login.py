"""
测试登录功能 - Playwright 有头模式
"""
from playwright.sync_api import sync_playwright
import time

def test_login():
    with sync_playwright() as p:
        # 启动浏览器（有头模式）
        browser = p.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        try:
            # 访问前端页面
            print("正在访问 http://localhost:5184...")
            page.goto('http://localhost:5184', timeout=30000)
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            # 截图查看初始状态
            page.screenshot(path='test_login_step1_initial.png')
            print("已截图: test_login_step1_initial.png")
            
            # 查找登录按钮或链接
            print("查找登录入口...")
            
            # 可能的登录按钮文本
            login_selectors = [
                'button:has-text("登录")',
                'a:has-text("登录")',
                'button:has-text("Login")',
                'a:has-text("Login")',
                '[data-testid="login"]',
                '.login-button',
                '#login',
            ]
            
            login_found = False
            for selector in login_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        print(f"找到登录按钮: {selector}")
                        page.locator(selector).first.click()
                        login_found = True
                        break
                except:
                    continue
            
            if not login_found:
                print("未找到标准登录按钮，检查页面内容...")
                print("页面标题:", page.title())
                print("页面URL:", page.url)
                # 输出页面文本内容前500字符
                content = page.content()
                print("页面内容片段:", content[:500])
            
            time.sleep(2)
            page.screenshot(path='test_login_step2_after_click.png')
            print("已截图: test_login_step2_after_click.png")
            
            # 查找登录表单
            print("查找登录表单...")
            
            # 尝试多种可能的输入框选择器
            email_selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="邮箱"]',
                'input[placeholder*="Email"]',
                '#email',
                '.email-input',
            ]
            
            password_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[placeholder*="密码"]',
                'input[placeholder*="Password"]',
                '#password',
                '.password-input',
            ]
            
            email_input = None
            for selector in email_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        email_input = page.locator(selector).first
                        print(f"找到邮箱输入框: {selector}")
                        break
                except:
                    continue
            
            password_input = None
            for selector in password_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        password_input = page.locator(selector).first
                        print(f"找到密码输入框: {selector}")
                        break
                except:
                    continue
            
            if email_input and password_input:
                # 填写登录信息
                print("填写登录信息...")
                email_input.fill('2749959@qq.com')
                time.sleep(0.5)
                password_input.fill('750714hf')
                time.sleep(0.5)
                
                page.screenshot(path='test_login_step3_filled.png')
                print("已截图: test_login_step3_filled.png")
                
                # 查找提交按钮
                submit_selectors = [
                    'button[type="submit"]',
                    'button:has-text("登录")',
                    'button:has-text("Login")',
                    '.submit-button',
                    '#submit',
                ]
                
                for selector in submit_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            print(f"找到提交按钮: {selector}")
                            page.locator(selector).first.click()
                            break
                    except:
                        continue
                
                # 等待响应
                time.sleep(3)
                page.screenshot(path='test_login_step4_after_submit.png')
                print("已截图: test_login_step4_after_submit.png")
                
                # 检查是否登录成功
                print("检查登录结果...")
                print("当前URL:", page.url)
                print("页面标题:", page.title())
                
                # 检查是否有错误信息
                error_selectors = [
                    '.error',
                    '.error-message',
                    '[role="alert"]',
                    '.toast-error',
                ]
                
                for selector in error_selectors:
                    try:
                        if page.locator(selector).count() > 0:
                            error_text = page.locator(selector).first.text_content()
                            print(f"发现错误信息 ({selector}): {error_text}")
                    except:
                        pass
                        
            else:
                print("未找到登录表单")
                if not email_input:
                    print("- 未找到邮箱输入框")
                if not password_input:
                    print("- 未找到密码输入框")
            
            # 保持浏览器打开一段时间以便查看
            print("\n测试完成，10秒后关闭浏览器...")
            time.sleep(10)
            
        except Exception as e:
            print(f"测试出错: {e}")
            page.screenshot(path='test_login_error.png')
            print("已截图: test_login_error.png")
            time.sleep(5)
            
        finally:
            browser.close()

if __name__ == '__main__':
    test_login()
