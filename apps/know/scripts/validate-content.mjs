#!/usr/bin/env node
/**
 * Show 内容库校验（发布 SOP 第一步，零依赖）
 *
 * 用法：node scripts/validate-content.mjs [内容目录]
 * 默认目录：仓库 content/know。校验：
 *   - index.json / series.json / episode.json 必填字段
 *   - slug 与目录名一致；status=published 必须有 published_at
 *   - 资源引用的文件真实存在（cover / interactive.path / docs[].path）
 *   - 视频必须是外部嵌入（embed_url，// 或 https:// 开头），不允许自托管 mp4
 * 退出码：有 error 为 1，仅 warning 为 0。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? join(here, '..', '..', '..', 'content', 'know'));

const errors = [];
const warnings = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    errors.push(`${rel(path)}: JSON 解析失败（${e.message}）`);
    return null;
  }
}

function rel(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function mustString(obj, key, path) {
  const v = obj?.[key];
  if (typeof v !== 'string' || v.trim() === '') {
    errors.push(`${rel(path)}: 缺少必填字段 ${key}`);
    return null;
  }
  return v;
}

function checkFileExists(baseDir, relPath, label, path, level = 'error') {
  if (!relPath) return;
  if (/^https?:\/\//.test(relPath)) return; // 外链不做存在性检查
  const full = join(baseDir, relPath);
  if (!existsSync(full)) {
    (level === 'error' ? errors : warnings).push(
      `${rel(path)}: ${label} 引用的文件不存在 → ${relPath}`
    );
  }
}

if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`内容目录不存在：${root}`);
  process.exit(1);
}

// ── index.json ──────────────────────────────────────────────
const indexPath = join(root, 'index.json');
if (existsSync(indexPath)) {
  const index = readJson(indexPath);
  if (index) {
    mustString(index.site ?? {}, 'title', indexPath);
  }
} else {
  warnings.push('缺少 index.json（频道名/主打位将使用默认值）');
}

// ── series/*/series.json ────────────────────────────────────
const seriesDir = join(root, 'series');
const seriesSlugs = [];
if (existsSync(seriesDir)) {
  for (const name of readdirSync(seriesDir)) {
    const sdir = join(seriesDir, name);
    if (!statSync(sdir).isDirectory()) continue;
    const metaPath = join(sdir, 'series.json');
    if (!existsSync(metaPath)) {
      warnings.push(`series/${name}: 缺少 series.json，整系列将被忽略`);
      continue;
    }
    const meta = readJson(metaPath);
    if (!meta) continue;
    const slug = mustString(meta, 'slug', metaPath);
    mustString(meta, 'title', metaPath);
    mustString(meta, 'brand', metaPath);
    if (slug && slug !== name) {
      errors.push(`series/${name}: series.json 的 slug "${slug}" 与目录名不一致`);
    }
    if (slug) seriesSlugs.push(slug);
    if (meta.cover) checkFileExists(sdir, meta.cover, '系列封面', metaPath);
    for (const d of meta.docs ?? []) {
      if (!d?.path) errors.push(`${rel(metaPath)}: 系列 docs 条目缺少 path`);
      else checkFileExists(sdir, d.path, `系列资料「${d.title ?? d.path}」`, metaPath);
    }
  }
}

// ── series/*/ep*/episode.json ───────────────────────────────
let episodeCount = 0;
if (existsSync(seriesDir)) {
  for (const name of readdirSync(seriesDir)) {
    const sdir = join(seriesDir, name);
    if (!statSync(sdir).isDirectory()) continue;
    for (const epName of readdirSync(sdir)) {
      const edir = join(sdir, epName);
      if (!statSync(edir).isDirectory()) continue;
      const epPath = join(edir, 'episode.json');
      if (!existsSync(epPath)) continue;
      const ep = readJson(epPath);
      if (!ep) continue;
      episodeCount += 1;

      const slug = mustString(ep, 'slug', epPath);
      if (slug && slug !== epName) {
        errors.push(`series/${name}/${epName}: episode.json 的 slug "${slug}" 与目录名不一致`);
      }
      const no = ep.episode_no;
      if (!Number.isInteger(no) || no < 1) {
        errors.push(`${rel(epPath)}: episode_no 必须是正整数`);
      }
      mustString(ep, 'title', epPath);
      mustString(ep, 'summary', epPath);
      const status = ep.status ?? 'published';
      if (status === 'published' && !ep.published_at) {
        errors.push(`${rel(epPath)}: status=published 必须填写 published_at（YYYY-MM-DD）`);
      }
      if (!['family', 'parent', 'child'].includes(ep.audience ?? 'family')) {
        errors.push(`${rel(epPath)}: audience 仅支持 family/parent/child`);
      }

      const res = ep.resources ?? {};
      if (res.interactive) {
        if (!res.interactive.path) {
          errors.push(`${rel(epPath)}: interactive 缺少 path`);
        } else {
          checkFileExists(edir, res.interactive.path, '互动动画', epPath);
        }
      }
      for (const v of res.videos ?? []) {
        const url = v?.embed_url ?? '';
        if (!url) {
          errors.push(`${rel(epPath)}: 视频条目「${v?.title ?? v?.id ?? '?'}」缺少 embed_url`);
        } else if (!/^https?:\/\//.test(url) && !url.startsWith('//')) {
          errors.push(
            `${rel(epPath)}: 视频「${v.title ?? ''}」embed_url 必须是外部嵌入地址（// 或 https:// 开头；本子系统不存 mp4）`
          );
        }
      }
      for (const d of res.docs ?? []) {
        if (!d?.path) errors.push(`${rel(epPath)}: docs 条目「${d?.title ?? '?'}」缺少 path`);
        else checkFileExists(edir, d.path, `资料「${d.title ?? d.path}」`, epPath);
      }
      for (const p of res.projects ?? []) {
        if (!p?.url) errors.push(`${rel(epPath)}: projects 条目「${p?.title ?? '?'}」缺少 url`);
      }
      if (ep.cover) checkFileExists(edir, ep.cover, '节目封面', epPath);
    }
  }
}

// ── featured 引用可解析 ─────────────────────────────────────
if (existsSync(indexPath)) {
  const index = readJson(indexPath);
  const f = index?.featured;
  if (f?.series && !seriesSlugs.includes(f.series)) {
    errors.push(`index.json: featured.series "${f.series}" 不存在于内容库`);
  }
  if (f?.series && f?.episode) {
    const epFile = join(root, 'series', f.series, f.episode, 'episode.json');
    if (!existsSync(epFile)) {
      errors.push(`index.json: featured 节目 ${f.series}/${f.episode} 不存在`);
    }
  }
}

// ── 汇总 ───────────────────────────────────────────────────
for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
console.log(
  `\n校验完成：${seriesSlugs.length} 个系列 / ${episodeCount} 集，${errors.length} 错误 / ${warnings.length} 警告`
);
process.exit(errors.length > 0 ? 1 : 0);
