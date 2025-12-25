@echo off
REM Tencent Lighthouse 服务器 Nginx 根路径修复脚本
REM 用于 Windows 环境执行

echo ==========================================
echo    Nginx 根路径修复
echo ==========================================
echo.

REM 配置
set SERVER_IP=43.140.204.127
set SCP=pscp.exe

echo [1/4] 上传 nginx-root.conf...
%SCP% server/nginx-root.conf root@%SERVER_IP%:/root/

if errorlevel neq 0 (
    echo [ERROR] 上传失败
    pause
    exit /b 1
)
echo [OK] nginx-root.conf 已上传

echo.
echo [2/4] 上传 fix-root-path.sh...
%SCP% server/fix-root-path.sh root@%SERVER_IP%:/root/

if errorlevel neq 0 (
    echo [ERROR] 上传失败
    pause
    exit /b 1
)
echo [OK] fix-root-path.sh 已上传

echo.
echo [3/4] 在服务器上执行修复脚本...
plink.exe -batch -ssh root@%SERVER_IP% "cd /root && chmod +x fix-root-path.sh && ./fix-root-path.sh"

echo.
echo ==========================================
echo         修复完成！
echo ==========================================
echo.
echo 访问地址：
echo   - 项目列表: http://%SERVER_IP%/
echo   - fineSTEM:  http://%SERVER_IP%/fineSTEM
echo   - project2:  http://%SERVER_IP%/project2
echo   - project3:  http://%SERVER_IP%/project3
echo.
pause
