# Project Naming Convention（项目命名规范）

本文档定义项目 slug 的生成规则，用于创建 `projects/` 目录下的子项目文件夹。

## 命名规则

### 1. 基本转换规则

1. **中文名称 → 拼音或英文翻译**
   - 优先使用有意义的英文翻译
   - 英文翻译不明确时使用拼音（不带声调）

2. **空格处理**
   - 空格转换为连字符 `-`
   - 连续多个空格合并为单个连字符
   - 首尾空格去除

3. **特殊字符处理**
   - 移除所有标点符号：`!@#$%^&*()_+=[]{}|;':",./<>?`
   - 移除所有表情符号
   - 保留连字符 `-` 和下划线 `_`

4. **大小写规范**
   - 全部转换为小写
   - 使用连字符分隔单词（kebab-case）

5. **长度限制**
   - 最大长度：50 个字符
   - 超长时保留前 50 个字符

### 2. 重复名称处理

当 `projects/` 目录下已存在同名 slug 时：

1. 尝试添加数字后缀 `_1`, `_2`, `_3`...
2. 检查新名称是否已存在，直到找到可用名称
3. 最大尝试次数：100（防止无限循环）

### 3. 保留关键字

以下名称保留，不能作为项目 slug：
- `docs`, `src`, `assets`, `lib`, `test`, `build`, `dist`
- `node_modules`, `.git`, `.trae`

## 示例

| 原始项目名称 | 生成的 slug | 说明 |
|-------------|------------|------|
| 智能植物浇水系统 | `smart-plant-watering-system` | 中文翻译为英文 |
| AI 图像分类器 | `ai-image-classifier` | 保留英文缩写 |
| 我的第一个网站 | `my-first-website` | 中文翻译为英文 |
| Python 数据分析 | `python-data-analysis` | 保留英文技术名词 |
| 智能家居控制 | `smart-home-control` | 中文翻译为英文 |
| 温度湿度监测 | `temperature-humidity-monitor` | 中文翻译为英文 |
| 小游戏：猜数字 | `guess-number-game` | 去除标点和修饰词 |
| 机器学习入门项目 | `machine-learning-intro-project` | 超长截断或简化 |
| 智能小车 | `smart-car` / `smart-car_1` | 重复时加后缀 |
| Web 应用 | `web-application` / `web-application_1` | 重复时加后缀 |

## 实现参考

```javascript
// 伪代码示例
function generateProjectSlug(projectName, existingSlugs) {
  // 1. 中文转英文/拼音（简化示例，实际需词典支持）
  let slug = translateOrPinyin(projectName);
  
  // 2. 转换为小写
  slug = slug.toLowerCase();
  
  // 3. 替换空格为连字符
  slug = slug.replace(/\s+/g, '-');
  
  // 4. 移除特殊字符
  slug = slug.replace(/[^a-z0-9-_]/g, '');
  
  // 5. 去除首尾连字符
  slug = slug.replace(/^-+|-+$/g, '');
  
  // 6. 截断长度
  slug = slug.substring(0, 50);
  
  // 7. 处理重复
  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${slug}_${counter}`;
    counter++;
    if (counter > 100) throw new Error('Too many duplicate names');
  }
  
  return finalSlug;
}
```

## 验证清单

创建项目前检查：
- [ ] slug 只包含小写字母、数字、连字符、下划线
- [ ] slug 不以连字符或下划线开头/结尾
- [ ] slug 长度在 1-50 之间
- [ ] slug 不是保留关键字
- [ ] projects/ 目录下不存在同名文件夹
