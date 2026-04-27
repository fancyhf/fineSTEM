# fineSTEM B/S 平台产品方案 V3.3 附件：设计系统规范

**版本**: v1.1
**日期**: 2026-04-23
**状态**: 设计定义（基于 Figma）
**对应主文档**: `04_fineSTEM_BS平台产品方案_V3.3.md`
**用途**: 基于 Figma 设计定义颜色系统、按钮样式、字体系统、圆角/阴影等通用样式规范

---

## 1. 颜色系统

### 1.1 主色调（蓝绿色系）

| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Primary 50 | #F0FDFA | 240, 253, 250 | 背景淡色 |
| Primary 100 | #CCFBF1 | 204, 251, 241 | 边框淡色 |
| Primary 200 | #99F6E4 | 153, 246, 228 | 悬停背景 |
| Primary 300 | #5EEAD4 | 94, 234, 212 | 次要按钮 |
| Primary 400 | #2DD4BF | 45, 212, 191 | 图标颜色 |
| Primary 500 | #14B8A6 | 20, 184, 166 | **主按钮、品牌色** |
| Primary 600 | #0D9488 | 13, 148, 136 | 按下状态 |
| Primary 700 | #0F766E | 15, 118, 110 | 深色背景 |
| Primary 800 | #115E59 | 17, 94, 89 | 文本强调 |
| Primary 900 | #134E4A | 19, 78, 74 | 最深色 |

### 1.2 辅助色

#### 成功色（绿色系）
| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Success 500 | #10B981 | 16, 185, 129 | 成功状态、完成标记 |
| Success 600 | #059669 | 5, 150, 105 | 成功按钮按下 |

#### 警告色（橙色系）
| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Warning 500 | #F59E0B | 245, 158, 11 | 警告状态 |
| Warning 600 | #D97706 | 217, 119, 6 | 警告按钮按下 |

#### 错误色（红色系）
| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Error 500 | #EF4444 | 239, 68, 68 | 错误状态、危险操作 |
| Error 600 | #DC2626 | 220, 38, 38 | 错误按钮按下 |

### 1.3 中性色（灰阶）

| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Gray 50 | #F9FAFB | 249, 250, 251 | 页面背景 |
| Gray 100 | #F3F4F6 | 243, 244, 246 | 卡片背景 |
| Gray 200 | #E5E7EB | 229, 231, 235 | 边框、分割线 |
| Gray 300 | #D1D5DB | 209, 213, 219 | 禁用边框 |
| Gray 400 | #9CA3AF | 156, 163, 175 | 次要文本 |
| Gray 500 | #6B7280 | 107, 114, 128 | 占位符文本 |
| Gray 600 | #4B5563 | 75, 85, 99 | 正文文本 |
| Gray 700 | #374151 | 55, 65, 81 | 标题文本 |
| Gray 800 | #1F2937 | 31, 41, 55 | 深色标题 |
| Gray 900 | #111827 | 17, 24, 39 | 最深色文本 |

### 1.4 色彩使用规则

| 元素 | 颜色 |
|------|------|
| 主按钮 | Primary 500 |
| 主按钮 hover | Primary 600 |
| 主按钮按下 | Primary 700 |
| 次要按钮 | Gray 100 背景 + Gray 700 文字 |
| 文本按钮 | Primary 500 文字，无背景 |
| 成功按钮 | Success 500 |
| 警告按钮 | Warning 500 |
| 危险按钮 | Error 500 |
| 正文 | Gray 600 |
| 标题 | Gray 800 |
| 次要文本 | Gray 400 |
| 占位符 | Gray 500 |
| 边框 | Gray 200 |
| 卡片背景 | Gray 100 或 White |
| 页面背景 | Gray 50 |

---

## 2. 按钮样式

### 2.1 按钮尺寸

| 尺寸 | 高度 | 内边距 | 圆角 | 字体大小 |
|------|------|--------|------|---------|
| XS | 28px | 8px 12px | 6px | 12px |
| SM | 36px | 10px 16px | 8px | 14px |
| MD | 44px | 12px 20px | 10px | 16px |
| LG | 52px | 16px 24px | 12px | 18px |

### 2.2 按钮变体

#### 主按钮（Primary）
```css
background: #14B8A6;
color: white;
border: none;
font-weight: 600;
transition: all 0.15s ease;

/* Hover */
background: #0D9488;

/* Pressed */
background: #0F766E;

/* Disabled */
background: #D1D5DB;
color: #9CA3AF;
cursor: not-allowed;
```

#### 次要按钮（Secondary）
```css
background: #F3F4F6;
color: #374151;
border: 1px solid #E5E7EB;
font-weight: 500;
transition: all 0.15s ease;

/* Hover */
background: #E5E7EB;

/* Pressed */
background: #D1D5DB;

/* Disabled */
background: #F9FAFB;
color: #9CA3AF;
border-color: #E5E7EB;
cursor: not-allowed;
```

#### 文本按钮（Text）
```css
background: transparent;
color: #14B8A6;
border: none;
font-weight: 500;
transition: all 0.15s ease;

/* Hover */
background: #F0FDFA;

/* Pressed */
background: #CCFBF1;

/* Disabled */
color: #9CA3AF;
background: transparent;
cursor: not-allowed;
```

#### 幽灵按钮（Ghost）
```css
background: transparent;
color: #14B8A6;
border: 1px solid #14B8A6;
font-weight: 500;
transition: all 0.15s ease;

/* Hover */
background: #F0FDFA;

/* Pressed */
background: #CCFBF1;

/* Disabled */
color: #9CA3AF;
border-color: #D1D5DB;
background: transparent;
cursor: not-allowed;
```

#### 状态按钮（Success/Warning/Error）
```css
/* Success */
background: #10B981;
color: white;
hover: #059669;

/* Warning */
background: #F59E0B;
color: white;
hover: #D97706;

/* Error */
background: #EF4444;
color: white;
hover: #DC2626;
```

### 2.3 按钮图标

| 位置 | 间距 |
|------|------|
| 图标在左 | 图标与文字间距 8px |
| 图标在右 | 文字与图标间距 8px |
| 仅图标 | 内边距 12px |

---

## 3. 字体系统

### 3.1 字体家族

| 用途 | 字体 |
|------|------|
| 中文正文 | -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif |
| 英文/数字 | "Inter", "Segoe UI", Roboto, sans-serif |
| 代码 | "Fira Code", "JetBrains Mono", Consolas, monospace |

### 3.2 字体大小与行高

| 层级 | 字号 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| H1 | 36px | 44px | 700 | 页面标题 |
| H2 | 30px | 38px | 700 | 区块标题 |
| H3 | 24px | 32px | 600 | 卡片标题 |
| H4 | 20px | 28px | 600 | 子标题 |
| H5 | 18px | 26px | 600 | 小标题 |
| Body LG | 16px | 24px | 400 | 正文 |
| Body MD | 14px | 22px | 400 | 次要正文 |
| Body SM | 12px | 18px | 400 | 辅助文本 |
| Caption | 11px | 16px | 400 | 标签、说明 |

### 3.3 字重

| 字重 | 数值 | 用途 |
|------|------|------|
| Regular | 400 | 正文、默认 |
| Medium | 500 | 次要强调 |
| Semibold | 600 | 标题、按钮 |
| Bold | 700 | 强调标题 |

---

## 4. 圆角与阴影

### 4.1 圆角系统

| 名称 | 值 | 用途 |
|------|-----|------|
| None | 0px | 直角 |
| SM | 4px | 小标签 |
| MD | 8px | 输入框、卡片 |
| LG | 12px | 按钮、组件 |
| XL | 16px | 大卡片 |
| 2XL | 24px | 弹窗、Hero |
| Full | 9999px | 圆形、胶囊 |

### 4.2 阴影系统

| 名称 | 样式 | 用途 |
|------|------|------|
| SM | 0 1px 2px 0 rgba(0, 0, 0, 0.05) | 输入框聚焦 |
| MD | 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) | 卡片悬停 |
| LG | 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) | 弹窗、下拉 |
| XL | 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) | 大弹窗、Hero |

### 4.3 输入框样式

```css
/* 默认状态 */
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 10px 12px;
background: white;
color: #4B5563;
font-size: 14px;
line-height: 22px;
transition: all 0.15s ease;

/* 聚焦状态 */
border-color: #14B8A6;
box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
outline: none;

/* 错误状态 */
border-color: #EF4444;
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);

/* 禁用状态 */
background: #F9FAFB;
border-color: #E5E7EB;
color: #9CA3AF;
cursor: not-allowed;
```

---

## 5. 间距系统

| 名称 | 值 |
|------|-----|
| 4xs | 2px |
| 3xs | 4px |
| 2xs | 6px |
| xs | 8px |
| sm | 12px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |

---

## 6. 组件样式汇总

### 6.1 卡片样式

```css
background: white;
border-radius: 12px;
border: 1px solid #E5E7EB;
padding: 16px;
transition: all 0.2s ease;

/* 悬停状态 */
border-color: #D1D5DB;
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
transform: translateY(-2px);
```

### 6.2 标签样式

```css
/* 默认标签 */
background: #F3F4F6;
color: #374151;
padding: 4px 10px;
border-radius: 9999px;
font-size: 12px;
line-height: 18px;
font-weight: 500;

/* 主题标签 */
background: #F0FDFA;
color: #0F766E;
```

### 6.3 进度条样式

```css
/* 容器 */
height: 8px;
background: #E5E7EB;
border-radius: 9999px;
overflow: hidden;

/* 进度条 */
height: 100%;
background: #14B8A6;
border-radius: 9999px;
transition: width 0.3s ease;
```

---

## 7. 暗模式适配（预留）

预留暗模式配色方案，暂不实现。

---

**备注**: 此设计系统基于 Figma 实际设计，采用蓝绿色为主色调，基于 Tailwind CSS 风格命名，便于直接在前端开发中使用。
