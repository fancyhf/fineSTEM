#!/bin/bash
# fineSTEM SKILLs 安装脚本 (macOS/Linux)
# 用法: ./install.sh [-s <skill-name>] [-S <local|github|gitee>] [-b <branch>] [-l] [-u] [-U] [-f] [-h]

set -e

# 版本
SCRIPT_VERSION="1.0.0"

# 默认配置
SKILL=""
SOURCE="github"
BRANCH="main"
LIST=false
UPDATE=false
UNINSTALL=false
FORCE=false

# GitHub/Gitee 配置
GITHUB_REPO="https://github.com/your-org/fineSTEM.git"
GITEE_REPO="https://gitee.com/your-org/fineSTEM.git"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_info() { echo -e "${CYAN}[ℹ]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# 显示标题
show_header() {
    echo ""
    echo "=========================================="
    echo "  fineSTEM SKILLs 安装脚本 v${SCRIPT_VERSION}"
    echo "=========================================="
    echo ""
}

# 显示帮助
show_help() {
    echo "用法: ./install.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -s <name>      指定要安装的 Skill 名称"
    echo "  -S <source>    指定源: local, github, gitee (默认: github)"
    echo "  -b <branch>    指定分支 (默认: main)"
    echo "  -l             列出所有可用 Skills"
    echo "  -u             更新已安装的 Skill"
    echo "  -U             卸载指定的 Skill"
    echo "  -f             强制安装，覆盖现有文件"
    echo "  -h             显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./install.sh -s stem-pbl-guide"
    echo "  ./install.sh -s stem-pbl-guide -S gitee"
    echo "  ./install.sh -l"
    echo "  ./install.sh -s stem-pbl-guide -u"
    echo "  ./install.sh -s stem-pbl-guide -U"
    echo ""
}

# 解析参数
parse_args() {
    while getopts "s:S:b:luUfh" opt; do
        case $opt in
            s) SKILL="$OPTARG" ;;
            S) SOURCE="$OPTARG" ;;
            b) BRANCH="$OPTARG" ;;
            l) LIST=true ;;
            u) UPDATE=true ;;
            U) UNINSTALL=true ;;
            f) FORCE=true ;;
            h) show_help; exit 0 ;;
            *) show_help; exit 1 ;;
        esac
    done
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    # 检查 Git
    if ! command -v git &> /dev/null; then
        print_error "未找到 Git，请先安装 Git"
        echo "  macOS: brew install git"
        echo "  Ubuntu/Debian: sudo apt-get install git"
        echo "  CentOS/RHEL: sudo yum install git"
        exit 1
    fi
    
    print_success "依赖检查通过"
}

# 获取 Trae Skill 目录
get_trae_skills_dir() {
    local default_dir="$HOME/.trae/skills"
    
    if [ -d "$default_dir" ]; then
        echo "$default_dir"
        return
    fi
    
    # 尝试其他可能的位置
    local possible_dirs=(
        "$HOME/Library/Application Support/Trae/skills"
        "$HOME/.config/Trae/skills"
    )
    
    for dir in "${possible_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo "$dir"
            return
        fi
    done
    
    # 如果都不存在，创建默认目录
    mkdir -p "$default_dir"
    echo "$default_dir"
}

# 获取临时目录
get_temp_dir() {
    if [ -n "$TMPDIR" ]; then
        echo "$TMPDIR/fineSTEM-skills"
    elif [ -n "$TEMP" ]; then
        echo "$TEMP/fineSTEM-skills"
    else
        echo "/tmp/fineSTEM-skills"
    fi
}

# 下载 Skill
download_skill() {
    local skill_name=$1
    local source=$2
    local branch=$3
    local temp_dir=$(get_temp_dir)
    
    print_info "下载 Skill: $skill_name (来源: $source, 分支: $branch)"
    
    # 清理临时目录
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    local repo_url
    if [ "$source" = "github" ]; then
        repo_url="$GITHUB_REPO"
    else
        repo_url="$GITEE_REPO"
    fi
    
    # 使用 sparse checkout 只下载 SKILLs 目录
    cd "$temp_dir"
    git init > /dev/null 2>&1
    git remote add origin "$repo_url"
    git config core.sparseCheckout true
    echo "SKILLs/$skill_name" > .git/info/sparse-checkout
    
    if ! git pull origin "$branch" > /dev/null 2>&1; then
        print_error "下载失败"
        exit 1
    fi
    
    local skill_path="$temp_dir/SKILLs/$skill_name"
    if [ ! -d "$skill_path" ]; then
        print_error "Skill '$skill_name' 不存在"
        exit 1
    fi
    
    print_success "下载完成"
    echo "$skill_path"
}

# 安装 Skill
install_skill() {
    local skill_name=$1
    local source=$2
    local branch=$3
    local force=$4
    local trae_dir=$(get_trae_skills_dir)
    local target_path="$trae_dir/$skill_name"
    
    # 检查是否已存在
    if [ -d "$target_path" ]; then
        if [ "$force" != true ]; then
            print_warning "Skill '$skill_name' 已存在"
            read -p "是否覆盖? (y/N) " response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                print_info "安装已取消"
                return
            fi
        fi
        
        # 备份旧版本
        local backup_path="${target_path}.backup.$(date +%Y%m%d%H%M%S)"
        print_info "备份旧版本到: $backup_path"
        mv "$target_path" "$backup_path"
    fi
    
    # 下载 Skill
    local skill_path=$(download_skill "$skill_name" "$source" "$branch")
    
    # 复制到目标目录
    print_info "安装 Skill 到: $target_path"
    cp -r "$skill_path" "$target_path"
    
    print_success "Skill '$skill_name' 安装成功!"
    print_info "请重启 Trae IDE 以加载新 Skill"
    print_info "触发语: 查看 $target_path/README.md"
}

# 列出可用 Skills
list_skills() {
    local source=$1
    local branch=$2
    local temp_dir=$(get_temp_dir)
    
    print_info "获取可用 Skills 列表..."
    
    # 清理临时目录
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    local repo_url
    if [ "$source" = "github" ]; then
        repo_url="$GITHUB_REPO"
    else
        repo_url="$GITEE_REPO"
    fi
    
    cd "$temp_dir"
    git init > /dev/null 2>&1
    git remote add origin "$repo_url"
    git config core.sparseCheckout true
    echo "SKILLs" > .git/info/sparse-checkout
    
    if ! git pull origin "$branch" > /dev/null 2>&1; then
        print_error "获取列表失败"
        exit 1
    fi
    
    local skills_dir="$temp_dir/SKILLs"
    
    echo ""
    echo "可用 Skills:"
    echo "------------"
    
    for skill_dir in "$skills_dir"/*/; do
        local skill_name=$(basename "$skill_dir")
        if [ "$skill_name" != "templates" ] && [ -f "$skill_dir/SKILL.md" ]; then
            local description=""
            if [ -f "$skill_dir/README.md" ]; then
                description=$(head -n 1 "$skill_dir/README.md" | sed 's/^# //')
            fi
            echo "  - $skill_name"
            if [ -n "$description" ]; then
                echo "    $description"
            fi
        fi
    done
    
    echo ""
    print_info "使用 ./install.sh -s <name> 安装指定 Skill"
}

# 更新 Skill
update_skill() {
    local skill_name=$1
    local source=$2
    local branch=$3
    local trae_dir=$(get_trae_skills_dir)
    local target_path="$trae_dir/$skill_name"
    
    if [ ! -d "$target_path" ]; then
        print_error "Skill '$skill_name' 未安装，无法更新"
        print_info "使用 ./install.sh -s $skill_name 进行安装"
        exit 1
    fi
    
    print_info "更新 Skill: $skill_name"
    install_skill "$skill_name" "$source" "$branch" true
}

# 卸载 Skill
uninstall_skill() {
    local skill_name=$1
    local trae_dir=$(get_trae_skills_dir)
    local target_path="$trae_dir/$skill_name"
    
    if [ ! -d "$target_path" ]; then
        print_error "Skill '$skill_name' 未安装"
        exit 1
    fi
    
    print_warning "即将卸载 Skill: $skill_name"
    read -p "确认卸载? (y/N) " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "卸载已取消"
        return
    fi
    
    # 备份
    local backup_path="${target_path}.backup.$(date +%Y%m%d%H%M%S)"
    print_info "备份到: $backup_path"
    mv "$target_path" "$backup_path"
    
    print_success "Skill '$skill_name' 已卸载"
    print_info "备份保存在: $backup_path"
}

# 清理临时文件
clear_temp() {
    local temp_dir=$(get_temp_dir)
    rm -rf "$temp_dir" 2>/dev/null || true
}

# 主程序
main() {
    show_header
    parse_args "$@"
    
    # 列出 Skills
    if [ "$LIST" = true ]; then
        list_skills "$SOURCE" "$BRANCH"
        clear_temp
        return
    fi
    
    # 检查 Skill 名称
    if [ -z "$SKILL" ] && [ "$LIST" = false ]; then
        print_error "请指定 Skill 名称，或使用 -l 查看可用 Skills"
        show_help
        exit 1
    fi
    
    # 检查依赖
    check_dependencies
    
    # 执行操作
    if [ "$UNINSTALL" = true ]; then
        uninstall_skill "$SKILL"
    elif [ "$UPDATE" = true ]; then
        update_skill "$SKILL" "$SOURCE" "$BRANCH"
    else
        install_skill "$SKILL" "$SOURCE" "$BRANCH" "$FORCE"
    fi
    
    # 清理
    clear_temp
    
    echo ""
    echo "=========================================="
    echo "  操作完成!"
    echo "=========================================="
    echo ""
}

# 执行主程序
main "$@"
