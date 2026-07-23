@echo off
chcp 65001
cls
echo ========================================
echo AI 自动续接功能 - 完整测试套件
echo ========================================
echo.
echo 本脚本将运行：
echo   1. 后端单元测试（截断检测）
echo   2. 后端集成测试（短代码）
echo   3. 后端集成测试（长代码 + 续接）
echo   4. 后端集成测试（超长代码 + 多次续接）
echo.
echo 预计总耗时：10-15 分钟
echo.
pause

echo.
echo [1/4] 运行截断检测测试...
echo ----------------------------------------
cd apps/backend
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_truncation_detection -v
if errorlevel 1 goto error

echo.
echo [2/4] 运行短代码生成测试（约 1 分钟）...
echo ----------------------------------------
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_short_code_no_truncation -v --timeout=120
if errorlevel 1 goto error

echo.
echo [3/4] 运行长代码自动续接测试（约 3 分钟）...
echo ----------------------------------------
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_long_code_auto_continue -v --timeout=300
if errorlevel 1 goto error

echo.
echo [4/4] 运行超长代码多次续接测试（约 8 分钟）...
echo ----------------------------------------
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_ultra_long_code_multiple_continues -v --timeout=600
if errorlevel 1 goto error

echo.
echo ========================================
echo ✅ 所有测试通过！
echo ========================================
goto end

:error
echo.
echo ========================================
echo ❌ 测试失败！
echo ========================================
echo 请查看上方错误信息
pause
exit /b 1

:end
echo.
echo 测试完成！
pause
