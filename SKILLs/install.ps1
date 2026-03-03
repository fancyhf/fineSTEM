#!/usr/bin/env pwsh
# fineSTEM SKILLs 安装脚本 (Windows)
# 用法: .\install.ps1 [-Skill <skill-name>] [-Source <local|github|gitee>] [-Branch <branch>]

param(
    [Parameter(Mandatory=$false)]
    [string]$Skill = "",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "github", "gitee")]
    [string]$Source = "github",
    
    [Parameter(Mandatory=$false)]
    [string]$Branch = "main",
    
    [Parameter(Mandatory=$false)]
    [switch]$List,
    
    [Parameter(Mandatory=$false)]
    [switch]$Update,
    
    [Parameter(Mandatory=$false)]
    [switch]$Uninstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# 配置
$ScriptVersion = "1.0.0"
$TraeSkillsDir = Join-Path $env:USERPROFILE ".trae\skills"
$TempDir = Join-Path $env:TEMP "fineSTEM-skills"

# GitHub/Gitee 配置
$GitHubRepo = "https://github.com/your-org/fineSTEM.git"
$GiteeRepo = "https://gitee.com/your-org/fineSTEM.git"

# 颜色输出
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success($message) { Write-ColorOutput Green "[✓] $message" }
function Write-Info($message) { Write-ColorOutput Cyan "[ℹ] $message" }
function Write-Warning($message) { Write-ColorOutput Yellow "[!] $message" }
function Write-Error($message) { Write-ColorOutput Red "[✗] $message" }

# 显示标题
function Show-Header {
    Write-Output ""
    Write-Output "=========================================="
    Write-Output "  fineSTEM SKILLs 安装脚本 v$ScriptVersion"
    Write-Output "=========================================="
    Write-Output ""
}

# 显示帮助
function Show-Help {
    Write-Output "用法: .\install.ps1 [选项]"
    Write-Output ""
    Write-Output "选项:"
    Write-Output "  -Skill <name>      指定要安装的 Skill 名称"
    Write-Output "  -Source <source>   指定源: local, github, gitee (默认: github)"
    Write-Output "  -Branch <branch>   指定分支 (默认: main)"
    Write-Output "  -List              列出所有可用 Skills"
    Write-Output "  -Update            更新已安装的 Skill"
    Write-Output "  -Uninstall         卸载指定的 Skill"
    Write-Output "  -Force             强制安装，覆盖现有文件"
    Write-Output "  -Help              显示此帮助信息"
    Write-Output ""
    Write-Output "示例:"
    Write-Output "  .\install.ps1 -Skill stem-pbl-guide"
    Write-Output "  .\install.ps1 -Skill stem-pbl-guide -Source gitee"
    Write-Output "  .\install.ps1 -List"
    Write-Output "  .\install.ps1 -Skill stem-pbl-guide -Update"
    Write-Output "  .\install.ps1 -Skill stem-pbl-guide -Uninstall"
    Write-Output ""
}

# 检查管理员权限
function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 检查依赖
function Test-Dependencies {
    Write-Info "检查依赖..."
    
    # 检查 Git
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error "未找到 Git，请先安装 Git: https://git-scm.com/download/win"
        exit 1
    }
    
    Write-Success "依赖检查通过"
}

# 获取 Trae Skill 目录
function Get-TraeSkillsDir {
    $defaultDir = Join-Path $env:USERPROFILE ".trae\skills"
    
    if (Test-Path $defaultDir) {
        return $defaultDir
    }
    
    # 尝试其他可能的位置
    $possibleDirs = @(
        "$env:APPDATA\Trae\skills",
        "$env:LOCALAPPDATA\Trae\skills"
    )
    
    foreach ($dir in $possibleDirs) {
        if (Test-Path $dir) {
            return $dir
        }
    }
    
    # 如果都不存在，创建默认目录
    New-Item -ItemType Directory -Force -Path $defaultDir | Out-Null
    return $defaultDir
}

# 下载 Skill
function Download-Skill($skillName, $source, $branch) {
    Write-Info "下载 Skill: $skillName (来源: $source, 分支: $branch)"
    
    # 清理临时目录
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    
    $repoUrl = if ($source -eq "github") { $GitHubRepo } else { $GiteeRepo }
    
    try {
        # 使用 sparse checkout 只下载 SKILLs 目录
        Set-Location $TempDir
        git init | Out-Null
        git remote add origin $repoUrl
        git config core.sparseCheckout true
        "SKILLs/$skillName" | Out-File -FilePath ".git\info\sparse-checkout" -Encoding utf8
        git pull origin $branch 2>&1 | Out-Null
        
        $skillPath = Join-Path $TempDir "SKILLs\$skillName"
        if (!(Test-Path $skillPath)) {
            Write-Error "Skill '$skillName' 不存在"
            exit 1
        }
        
        Write-Success "下载完成"
        return $skillPath
    }
    catch {
        Write-Error "下载失败: $_"
        exit 1
    }
}

# 安装 Skill
function Install-Skill($skillName, $source, $branch, $force) {
    $traeDir = Get-TraeSkillsDir
    $targetPath = Join-Path $traeDir $skillName
    
    # 检查是否已存在
    if (Test-Path $targetPath) {
        if (!$force) {
            Write-Warning "Skill '$skillName' 已存在"
            $response = Read-Host "是否覆盖? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                Write-Info "安装已取消"
                return
            }
        }
        
        # 备份旧版本
        $backupPath = "$targetPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Write-Info "备份旧版本到: $backupPath"
        Move-Item -Path $targetPath -Destination $backupPath -Force
    }
    
    # 下载 Skill
    $skillPath = Download-Skill $skillName $source $branch
    
    # 复制到目标目录
    Write-Info "安装 Skill 到: $targetPath"
    Copy-Item -Path $skillPath -Destination $targetPath -Recurse -Force
    
    Write-Success "Skill '$skillName' 安装成功!"
    Write-Info "请重启 Trae IDE 以加载新 Skill"
    Write-Info "触发语: 查看 $targetPath\README.md"
}

# 列出可用 Skills
function List-Skills($source, $branch) {
    Write-Info "获取可用 Skills 列表..."
    
    # 清理临时目录
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    
    $repoUrl = if ($source -eq "github") { $GitHubRepo } else { $GiteeRepo }
    
    try {
        Set-Location $TempDir
        git init | Out-Null
        git remote add origin $repoUrl
        git config core.sparseCheckout true
        "SKILLs" | Out-File -FilePath ".git\info\sparse-checkout" -Encoding utf8
        git pull origin $branch 2>&1 | Out-Null
        
        $skillsDir = Join-Path $TempDir "SKILLs"
        $skills = Get-ChildItem -Path $skillsDir -Directory | Where-Object { 
            $_.Name -ne "templates" -and (Test-Path (Join-Path $_.FullName "SKILL.md"))
        }
        
        Write-Output ""
        Write-Output "可用 Skills:"
        Write-Output "------------"
        
        foreach ($skill in $skills) {
            $readmePath = Join-Path $skill.FullName "README.md"
            $description = ""
            if (Test-Path $readmePath) {
                $firstLine = Get-Content $readmePath -TotalCount 1
                if ($firstLine -match "^#\s*(.+)$") {
                    $description = $matches[1]
                }
            }
            Write-Output "  - $($skill.Name)"
            if ($description) {
                Write-Output "    $description"
            }
        }
        
        Write-Output ""
        Write-Info "使用 .\install.ps1 -Skill <name> 安装指定 Skill"
    }
    catch {
        Write-Error "获取列表失败: $_"
        exit 1
    }
}

# 更新 Skill
function Update-Skill($skillName, $source, $branch) {
    $traeDir = Get-TraeSkillsDir
    $targetPath = Join-Path $traeDir $skillName
    
    if (!(Test-Path $targetPath)) {
        Write-Error "Skill '$skillName' 未安装，无法更新"
        Write-Info "使用 .\install.ps1 -Skill $skillName 进行安装"
        exit 1
    }
    
    Write-Info "更新 Skill: $skillName"
    Install-Skill $skillName $source $branch $true
}

# 卸载 Skill
function Uninstall-Skill($skillName) {
    $traeDir = Get-TraeSkillsDir
    $targetPath = Join-Path $traeDir $skillName
    
    if (!(Test-Path $targetPath)) {
        Write-Error "Skill '$skillName' 未安装"
        exit 1
    }
    
    Write-Warning "即将卸载 Skill: $skillName"
    $response = Read-Host "确认卸载? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Info "卸载已取消"
        return
    }
    
    # 备份
    $backupPath = "$targetPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Info "备份到: $backupPath"
    Move-Item -Path $targetPath -Destination $backupPath -Force
    
    Write-Success "Skill '$skillName' 已卸载"
    Write-Info "备份保存在: $backupPath"
}

# 清理临时文件
function Clear-Temp {
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 主程序
function Main {
    Show-Header
    
    # 显示帮助
    if ($args -contains "-Help" -or $args -contains "-h" -or $args -contains "--help") {
        Show-Help
        return
    }
    
    # 列出 Skills
    if ($List) {
        List-Skills $Source $Branch
        Clear-Temp
        return
    }
    
    # 检查 Skill 名称
    if ([string]::IsNullOrEmpty($Skill) -and !$List) {
        Write-Error "请指定 Skill 名称，或使用 -List 查看可用 Skills"
        Show-Help
        exit 1
    }
    
    # 检查依赖
    Test-Dependencies
    
    # 执行操作
    if ($Uninstall) {
        Uninstall-Skill $Skill
    }
    elseif ($Update) {
        Update-Skill $Skill $Source $Branch
    }
    else {
        Install-Skill $Skill $Source $Branch $Force
    }
    
    # 清理
    Clear-Temp
    
    Write-Output ""
    Write-Output "=========================================="
    Write-Output "  操作完成!"
    Write-Output "=========================================="
    Write-Output ""
}

# 执行主程序
Main
