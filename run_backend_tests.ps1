# AI 自动续接功能 - 后端测试运行脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI 自动续接功能 - 后端 API 测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location apps/backend

Write-Host "[1/4] 运行截断检测测试..." -ForegroundColor Yellow
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_truncation_detection -v

Write-Host ""
Write-Host "[2/4] 运行短代码生成测试..." -ForegroundColor Yellow
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_short_code_no_truncation -v --timeout=120

Write-Host ""
Write-Host "[3/4] 运行长代码自动续接测试..." -ForegroundColor Yellow
Write-Host "      （此测试需要约 2-3 分钟）" -ForegroundColor Gray
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_long_code_auto_continue -v --timeout=300

Write-Host ""
Write-Host "[4/4] 运行超长代码多次续接测试..." -ForegroundColor Yellow
Write-Host "      （此测试需要约 5-8 分钟）" -ForegroundColor Gray
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_ultra_long_code_multiple_continues -v --timeout=600

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "后端测试完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
