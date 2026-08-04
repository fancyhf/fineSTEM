/**
 * 精选管理页面（Admin 专用）
 *
 * 用途：管理员管理全局项目精选状态、Demo 入选、灵感墙。
 * 五个页签：
 *   - 全部项目：已完成阶段9（评估展示）的项目（projects 表），含搜索/过滤，
 *                可设为精选Demo/精选作品，可跳转到项目详情进行 Demo 上线准备。
 *   - 我的项目：当前 admin 名下项目（projects 表，mine=当前用户），admin 自己也做项目。
 *   - Demo 项目：从 demos 表读取（2026-08-03 改造：不再读 projects.is_featured_demo），
 *                默认显示公开 demo，可切换查看未公开草稿；支持编辑/删除/上下架。
 *   - 精选作品：is_featured=true 的成果卡（achievement_cards 表），可取消精选、排序、下架。
 *   - 灵感墙：已公开的成果卡（achievement_cards 表，is_public=true），可设精选、下架。
 *
 * 维护者：AI Agent
 * links: .trae/documents/技术与架构/精选灵感墙Demo数据源统一方案与测试计划_v1.0.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Check, X, EyeOff, Search, RotateCcw, ExternalLink, ChevronDown, ChevronUp, Trash2, Edit2, Wand2, Bell } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { CoverPicker } from '../components/CoverPicker';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { achievementCardsApi, demosApi, notificationsApi, projectsApi } from '../services/api';
import { showToast } from '../services/toast';
import { useAuth } from '../contexts/AuthContext';
import type { AchievementCard, Demo, DemoCreateFromProject, DemoPrefill, DemoUpdate, Project, PaginationResult } from '../types';
import { resolveImageUrl } from '../lib/image';

// ──────────────────────────────────────────────────────────────
// 页签定义
// ──────────────────────────────────────────────────────────────

type TabKey = 'all' | 'mine' | 'demo' | 'featured' | 'wall';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: '全部项目' },
  { key: 'mine', label: '我的项目' },
  { key: 'demo', label: 'Demo 项目' },
  { key: 'featured', label: '精选作品' },
  { key: 'wall', label: '灵感墙' },
];

// ──────────────────────────────────────────────────────────────
// 过滤选项常量（页面级搜索/过滤条件区，从 SKILL.md 提取）
// ──────────────────────────────────────────────────────────────

const PROJECT_MODE_OPTIONS = [
  { value: '', label: '所有模式' },
  { value: 'light', label: '轻量' },
  { value: 'standard', label: '进阶' },
];

const DIFFICULTY_OPTIONS = [
  { value: '', label: '所有难度' },
  { value: 'beginner', label: '入门 (beginner)' },
  { value: 'intermediate', label: '进阶 (intermediate)' },
  { value: 'advanced', label: '高级 (advanced)' },
];

const TRACK_OPTIONS = [
  { value: '', label: '所有方向' },
  { value: 'web', label: 'Web 应用' },
  { value: 'web_app', label: 'Web App' },
  { value: 'game_dev', label: '游戏开发' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'data_viz', label: '数据可视化' },
  { value: 'creative_coding', label: '创意编程' },
  { value: 'kaggle', label: 'Kaggle 数据' },
  { value: 'hardware', label: '硬件 (Pico)' },
  { value: 'course', label: '课程' },
];

const TEACHING_MODE_OPTIONS = [
  { value: '', label: '所有教学模式' },
  { value: 'guided', label: '引导式 (guided)' },
  { value: 'demo', label: '演示 (demo)' },
  { value: 'hands_on', label: '动手 (hands_on)' },
  { value: 'lecture', label: '讲授 (lecture)' },
  { value: 'html_visual', label: 'HTML 可视化 (html_visual)' },
];

const TECH_STACK_OPTIONS = [
  { value: '', label: '所有技术栈' },
  { value: 'Streamlit', label: 'Streamlit' },
  { value: 'Flask', label: 'Flask' },
  { value: 'Pygame', label: 'Pygame' },
  { value: 'Tkinter', label: 'Tkinter' },
  { value: 'Python', label: 'Python + AI IDE' },
  { value: 'HTML', label: 'HTML / JS' },
];

const AGE_BAND_OPTIONS = [
  { value: '', label: '所有年龄段' },
  { value: 'junior', label: '初中 (junior)' },
  { value: 'senior', label: '高中 (senior)' },
];

const TIME_BUDGET_OPTIONS = [
  { value: '', label: '所有时间预算' },
  { value: '2h', label: '2 小时' },
  { value: '6h', label: '6 小时' },
  { value: '12h', label: '12 小时+' },
];

const STAGE_OPTIONS = [
  { value: '', label: '所有阶段' },
  { value: 'stage_00_bootstrap', label: 'Stage 00 · 启动' },
  { value: 'stage_01_brainstorm', label: 'Stage 01 · 脑暴' },
  { value: 'stage_02_brief', label: 'Stage 02 · 开题' },
  { value: 'stage_03_constraints', label: 'Stage 03 · 裁剪' },
  { value: 'stage_04_track', label: 'Stage 04 · 轨道' },
  { value: 'stage_05_design', label: 'Stage 05 · 设计' },
  { value: 'stage_06_step_plan', label: 'Stage 06 · 计划' },
  { value: 'stage_07_execute', label: 'Stage 07 · 执行' },
  { value: 'stage_08_evaluate', label: 'Stage 08 · 验收' },
];

const FEATURED_STATE_OPTIONS = [
  { value: '', label: '所有状态' },
  { value: 'demo', label: '仅 Demo 项目' },
  { value: 'work', label: '仅精选作品' },
  { value: 'featured_card', label: '仅精选成果卡' },
];

function PaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: Omit<PaginationResult<unknown>, 'items'>;
  onPageChange: (page: number) => void;
}) {
  if (pagination.total_pages <= 1) return null;
  return (
    <div className="flex justify-center gap-2 mt-6">
      <Button
        variant="secondary"
        size="sm"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        上一页
      </Button>
      <span className="flex items-center px-4 text-gray-600 text-sm">
        第 {pagination.page} 页 / 共 {pagination.total_pages} 页（{pagination.total} 条）
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={pagination.page >= pagination.total_pages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        下一页
      </Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 9;

export default function AdminFeatured() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');

  // ---------- 项目类页签状态（all / mine / demo）----------
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsPagination, setProjectsPagination] = useState<Omit<PaginationResult<unknown>, 'items'> | null>(null);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectActionLoading, setProjectActionLoading] = useState<string | null>(null);

  // ---------- 成果卡页签状态（featured / wall）----------
  const [cards, setCards] = useState<AchievementCard[]>([]);
  const [cardsPagination, setCardsPagination] = useState<Omit<PaginationResult<unknown>, 'items'> | null>(null);
  const [cardsPage, setCardsPage] = useState(1);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardActionLoading, setCardActionLoading] = useState<string | null>(null);
  const [cardSortEdits, setCardSortEdits] = useState<Record<string, number>>({});

  // ---------- Demo 页签状态（2026-08-03：从 demos 表读取）----------
  const [demos, setDemos] = useState<Demo[]>([]);
  const [demosPagination, setDemosPagination] = useState<Omit<PaginationResult<unknown>, 'items'> | null>(null);
  const [demosPage, setDemosPage] = useState(1);
  const [demosLoading, setDemosLoading] = useState(false);
  const [demosError, setDemosError] = useState<string | null>(null);
  const [demoActionLoading, setDemoActionLoading] = useState<string | null>(null);
  // 是否查看未公开草稿（默认 false = 只看公开 demo）
  const [showDemoDrafts, setShowDemoDrafts] = useState(false);

  // ---------- 收录/编辑 Demo Modal 状态 ----------
  // promote 模式：把 project 收录为 demo（project 必填）
  // edit 模式：编辑已存在的 demo（demo 必填，project 可选用于回显来源）
  const [demoModal, setDemoModal] = useState<{
    open: boolean;
    mode: 'promote' | 'edit';
    project?: Project;
    demo?: Demo;
  }>({ open: false, mode: 'promote' });

  // 项目→Demo 映射：source_project_id → Demo（用于判断项目是否已被收录）。
  // 数据源是 demos 表（唯一真相源），全量拉取一次建 Map。
  const [projectDemoMap, setProjectDemoMap] = useState<Record<string, Demo>>({});

  /** 拉取所有未删除 demo，构建 source_project_id → Demo 映射 */
  const refreshProjectDemoMap = useCallback(async () => {
    try {
      // is_public 不传（后端默认只返回公开）；为拿到含草稿的全量，传 is_public=false 拿草稿，
      // 再传 is_public=true（默认）拿公开，合并。但更简单：后端 list_demos 的 is_public=None
      // 默认只返回公开。这里我们用大 page_size 拉公开 demo（草稿 demo 理论上也算"已收录"，
      // 但公开列表通常已覆盖项目页签里的项目）。为准确，分两次拉取合并。
      const [publicRes, draftRes] = await Promise.all([
        demosApi.listForAdmin({ page: 1, page_size: 100 }),
        demosApi.listForAdmin({ page: 1, page_size: 100, is_public: false }),
      ]);
      const allDemos = [
        ...(publicRes.data?.items ?? []),
        ...(draftRes.data?.items ?? []),
      ];
      const map: Record<string, Demo> = {};
      for (const d of allDemos) {
        if (d.source_project_id) map[d.source_project_id] = d;
      }
      setProjectDemoMap(map);
    } catch {
      // 映射加载失败不阻塞主流程，按钮按"未收录"展示
    }
  }, []);

  useEffect(() => {
    void refreshProjectDemoMap();
  }, [refreshProjectDemoMap]);

  // ---------- 页面级搜索/过滤条件区（对所有页签的当前数据都生效）----------
  // 输入中间态（用户在框里编辑，尚未提交）
  const [searchInput, setSearchInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  // 已提交的过滤条件（后端参数）
  const [search, setSearch] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterFeaturedState, setFilterFeaturedState] = useState('');
  // SKILL.md 提取的维度（前端对当前页数据客户端过滤）
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterTeachingMode, setFilterTeachingMode] = useState('');
  const [filterTechStack, setFilterTechStack] = useState('');
  const [filterAgeBand, setFilterAgeBand] = useState('');
  const [filterTimeBudget, setFilterTimeBudget] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterCapabilityTag, setFilterCapabilityTag] = useState('');
  // 高级过滤器折叠状态
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ──────────────────────────────────────────────────────────────
  // 数据加载：项目类（all / mine / demo）
  // ──────────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    // 2026-08-03：demo 页签改为从 demos 表读取，这里只处理 all / mine
    if (tab !== 'all' && tab !== 'mine') return;
    try {
      setProjectsLoading(true);
      setProjectsError(null);

      const params: Parameters<typeof projectsApi.listForAdmin>[0] = {
        page: projectsPage,
        page_size: PAGE_SIZE,
      };

      // 页签维度约束
      if (tab === 'mine') {
        params.author_id = user?.id;
      }

      // "全部项目"页签：只展示已完成阶段9（评估展示）的项目，排除仍在开发中的项目
      if (tab === 'all') {
        params.completed_only = true;
      }

      // 页面级搜索/过滤条件（对所有页签的当前数据都生效）
      if (search) params.search = search;
      if (authorName) params.author_name = authorName;

      // 精选状态过滤
      if (filterFeaturedState === 'demo') params.is_featured_demo = true;
      else if (filterFeaturedState === 'work') params.is_featured_work = true;

      const res = await projectsApi.listForAdmin(params);
      if (res.data) {
        setProjects(res.data.items);
        setProjectsPagination({
          total: res.data.total,
          page: res.data.page,
          page_size: res.data.page_size,
          total_pages: res.data.total_pages,
        });
      }
    } catch {
      setProjectsError('加载项目失败，请稍后重试');
    } finally {
      setProjectsLoading(false);
    }
  }, [tab, projectsPage, search, authorName, filterFeaturedState, user?.id]);

  // ──────────────────────────────────────────────────────────────
  // 数据加载：Demo 页签（2026-08-03：从 demos 表读取）
  // ──────────────────────────────────────────────────────────────

  const loadDemos = useCallback(async () => {
    if (tab !== 'demo') return;
    try {
      setDemosLoading(true);
      setDemosError(null);
      // showDemoDrafts=true → 只看未公开草稿；false → 只看公开
      const res = await demosApi.listForAdmin({
        page: demosPage,
        page_size: PAGE_SIZE,
        is_public: !showDemoDrafts,
        search: search || undefined,
      });
      if (res.data) {
        setDemos(res.data.items);
        setDemosPagination({
          total: res.data.total,
          page: res.data.page,
          page_size: res.data.page_size,
          total_pages: res.data.total_pages,
        });
      }
    } catch {
      setDemosError('加载 Demo 失败，请稍后重试');
    } finally {
      setDemosLoading(false);
    }
  }, [tab, demosPage, showDemoDrafts, search]);

  // ──────────────────────────────────────────────────────────────
  // 数据加载：成果卡类（featured / wall）
  // ──────────────────────────────────────────────────────────────

  const loadCards = useCallback(async () => {
    if (tab !== 'featured' && tab !== 'wall') return;
    try {
      setCardsLoading(true);
      setCardsError(null);

      const res = await achievementCardsApi.listPublic({
        page: cardsPage,
        page_size: PAGE_SIZE,
        ...(tab === 'wall' ? {} : {}),
      });
      if (res.data) {
        setCards(res.data.items);
        setCardsPagination({
          total: res.data.total,
          page: res.data.page,
          page_size: res.data.page_size,
          total_pages: res.data.total_pages,
        });
      }
    } catch {
      setCardsError('加载成果卡失败，请稍后重试');
    } finally {
      setCardsLoading(false);
    }
  }, [tab, cardsPage]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadDemos();
  }, [loadDemos]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // ──────────────────────────────────────────────────────────────
  // 页签切换
  // ──────────────────────────────────────────────────────────────

  const handleTabChange = (key: TabKey) => {
    if (key === tab) return;
    setTab(key);
    setProjectsPage(1);
    setCardsPage(1);
    setDemosPage(1);
  };

  // ──────────────────────────────────────────────────────────────
  // 页面级搜索/过滤条件区（作用于所有页签的当前数据）
  // ──────────────────────────────────────────────────────────────

  const handleSubmitFilters = () => {
    setSearch(searchInput.trim());
    setAuthorName(authorInput.trim());
    setProjectsPage(1);
    setCardsPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAuthorInput('');
    setSearch('');
    setAuthorName('');
    setFilterMode('');
    setFilterFeaturedState('');
    setFilterDifficulty('');
    setFilterTrack('');
    setFilterTeachingMode('');
    setFilterTechStack('');
    setFilterAgeBand('');
    setFilterTimeBudget('');
    setFilterStage('');
    setFilterCapabilityTag('');
    setProjectsPage(1);
    setCardsPage(1);
  };

  // ──────────────────────────────────────────────────────────────
  // 客户端过滤（对当前页数据做兜底过滤：SKILL.md 提取维度，后端未支持）
  //   宽松语义：项目对象缺失对应字段则不排除。
  // ──────────────────────────────────────────────────────────────

  const matchProjectFilters = useCallback((p: Project): boolean => {
    if (filterMode && p.mode !== filterMode) return false;
    if (filterStage && p.current_stage && p.current_stage !== filterStage) return false;
    if (filterTechStack) {
      if (!Array.isArray(p.tech_stack) || p.tech_stack.length === 0) return true;
      const hit = p.tech_stack.some(
        (t) => (t || '').toLowerCase().includes(filterTechStack.toLowerCase()),
      );
      if (!hit) return false;
    }
    // 其它维度（difficulty/track/teaching_mode/age_band/time_budget/capability_tag）
    // 目前 Project 顶层无对应字段，前端不做硬过滤（避免误伤），后续后端补齐再收紧。
    return true;
  }, [filterMode, filterStage, filterTechStack]);

  const matchCardFilters = useCallback((c: AchievementCard): boolean => {
    if (filterMode && c.project_mode !== filterMode) return false;
    if (filterCapabilityTag) {
      if (!Array.isArray(c.capability_tags) || c.capability_tags.length === 0) return true;
      const hit = c.capability_tags.some(
        (t) => (t || '').toLowerCase().includes(filterCapabilityTag.toLowerCase()),
      );
      if (!hit) return false;
    }
    if (filterFeaturedState === 'featured_card' && !c.is_featured) return false;
    // 关键词（成果卡后端未接受 search 参数，前端兜底）
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.title || ''} ${c.one_liner || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (authorName) {
      const a = (c.author_username || '').toLowerCase();
      if (!a.includes(authorName.toLowerCase())) return false;
    }
    return true;
  }, [filterMode, filterCapabilityTag, filterFeaturedState, search, authorName]);

  // ──────────────────────────────────────────────────────────────
  // 项目操作：收录为 Demo（含成果卡上线校验 + 引导）
  // ──────────────────────────────────────────────────────────────

  const formatMissingFields = (fields: string[]): string =>
    fields.map((f) => MISSING_FIELD_LABELS[f] || f).join('、');

  // DemoFormModal 内部会自行处理成果卡状态（无成果卡则提供"补全成果卡"按钮，
  // 字段不全则表单内补全），这里不再做前置校验拦截。

  /**
   * "设为 Demo" 入口（2026-08-03 改造）：
   * 1. 校验成果卡齐全（有卡 + 截图 + 标签 + one_liner + 已公开）
   * 2. 无卡/字段不全/未公开 → 按是否自己项目分别引导：
   *    - 自己项目：询问是否即刻去设置成果卡，确认则跳转 /research/projects/:id/achievement
   *    - 他人项目：仅提示告知（admin 无法替作者做成果卡）
   * 3. 全通过 → 打开"收录为 Demo"表单 Modal
   */
  /**
   * "收录为 Demo" 入口（2026-08-04 重新设计）：
   * 不管项目成果卡是否齐全，**永远先弹出 DemoFormModal**。
   *   - 有已收录 demo → 打开 edit 模式
   *   - 无已收录 demo → 打开 promote 模式，Modal 内自行处理：
   *       · 无成果卡 → 顶部显示"补全成果卡"按钮（调 generateAchievementCard），生成后原地刷新
   *       · 成果卡字段不全 → 在表单内补全（能力标签可"自动同步"）
   *       · 齐全 → 正常填写发布
   * 不再跳转成果卡页、不再用 window.confirm 拦截。
   */
  const handleSetFeaturedDemo = (project: Project) => {
    const existing = projectDemoMap[project.id];
    if (existing) {
      setDemoModal({ open: true, mode: 'edit', demo: existing, project });
      return;
    }
    setDemoModal({ open: true, mode: 'promote', project });
  };

  /**
   * 管理员通知作者补齐成果卡：向项目作者发送 achievement_missing 通知，
   * linkUrl 指向项目成果档案卡页面，便于作者直接跳转补全。
   */
  const handleNotifyAuthorForCard = async (project: Project) => {
    if (!project.author_id) {
      showToast('error', '无法获取项目作者信息');
      return;
    }
    setProjectActionLoading(`notify-${project.id}`);
    try {
      await notificationsApi.adminCreate({
        recipientId: project.author_id,
        type: 'achievement_missing',
        title: `请补齐项目「${project.name}」的成果档案卡`,
        content: '管理员希望您尽快补齐该项目的成果档案卡，以便进入 Demo 收录与精选流程。点击可直接前往设置。',
        relatedType: 'project',
        relatedId: project.id,
        linkUrl: `/research/projects/${project.id}/achievement`,
      });
      showToast('success', '已发送通知给作者');
    } catch {
      showToast('error', '发送通知失败，请稍后重试');
    } finally {
      setProjectActionLoading(null);
    }
  };

  /**
   * 设为 / 取消精品项目：作用于项目关联成果卡的 is_featured（精品 = 精选作品）。
   * 需要成果卡存在且已发布到灵感墙（后端校验），否则 toast 提示。
   */
  const handleFeatureProjectAsWork = async (project: Project, value: boolean) => {
    const cardId = project.achievement_card_id;
    if (!cardId) {
      showToast('error', '该项目尚未生成成果档案卡，无法设为精品');
      return;
    }
    if (value && !project.achievement_card_is_public) {
      showToast('error', '成果卡未发布到灵感墙，无法设为精品');
      return;
    }
    setProjectActionLoading(`work-${project.id}`);
    try {
      await achievementCardsApi.setFeatured(cardId, value, value ? 10 : 0);
      showToast('success', value ? '已设为精品项目' : '已取消精品');
      await Promise.all([loadProjects(), loadCards()]);
    } catch {
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setProjectActionLoading(null);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Demo 操作（编辑/删除/上下架）—— 作用于 demos 表
  // ──────────────────────────────────────────────────────────────

  const handleToggleDemoPublic = async (demo: Demo) => {
    setDemoActionLoading(`pub-${demo.id}`);
    try {
      await demosApi.togglePublic(demo.id, !demo.is_public);
      showToast('success', demo.is_public ? '已下架' : '已上架');
      await loadDemos();
    } catch {
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setDemoActionLoading(null);
    }
  };

  const handleDeleteDemo = async (demo: Demo) => {
    const ok = window.confirm(
      `确认删除 Demo「${demo.name}」？\n\n删除后将从 Demo 列表移除（项目本身不受影响）。`,
    );
    if (!ok) return;
    setDemoActionLoading(`del-${demo.id}`);
    try {
      await demosApi.remove(demo.id);
      showToast('success', '已删除 Demo');
      await loadDemos();
      await refreshProjectDemoMap();
    } catch {
      showToast('error', '删除失败，请稍后重试');
    } finally {
      setDemoActionLoading(null);
    }
  };

  const handleEditDemo = (demo: Demo) => {
    setDemoModal({ open: true, mode: 'edit', demo });
  };

  /** 收录/编辑 Modal 提交（统一入口）。返回 { ok, missingFields } 供 Modal 决定是否关闭 */
  const handleDemoModalSubmit = async (
    data: DemoCreateFromProject,
    demoId?: string,
  ): Promise<{ ok: boolean; missingFields?: string[] }> => {
    const isEdit = demoModal.mode === 'edit' && demoId;
    try {
      if (isEdit) {
        await demosApi.update(demoId!, data as DemoUpdate);
        showToast('success', 'Demo 已更新');
      } else if (demoModal.project) {
        await demosApi.createFromProject(demoModal.project.id, data);
        showToast('success', '已收录为 Demo');
      }
      setDemoModal({ open: false, mode: 'promote' });
      // 收录成功后切到 Demo 页签并刷新
      if (!isEdit) {
        setTab('demo');
        setDemosPage(1);
      }
      await loadDemos();
      await refreshProjectDemoMap();
      return { ok: true };
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const body = (err as { body?: { detail?: { details?: { missing_fields?: string[] } } } })?.body;
      // 422 字段缺失：返回 missingFields，让 Modal 自动展开对应补全区（不关 modal、不 toast，Modal 内统一提示）
      if (status === 422 && body?.detail?.details?.missing_fields) {
        return { ok: false, missingFields: body.detail.details.missing_fields };
      }
      if (status === 409) {
        showToast('error', '该项目已被收录为 Demo，请直接在 Demo 页签编辑');
      } else {
        // 透传后端原始 message，便于诊断（不再笼统"操作失败"）
        const rawDetail = (body as { detail?: { message?: string } | string })?.detail;
        const msg = (typeof rawDetail === 'string' ? rawDetail : rawDetail?.message) || `操作失败(${status})`;
        showToast('error', msg);
      }
      return { ok: false };
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 成果卡操作：设为/取消精选、下架灵感墙
  // ──────────────────────────────────────────────────────────────

  const handleFeatureCard = async (cardId: string, value: boolean) => {
    setCardActionLoading(cardId);
    try {
      await achievementCardsApi.setFeatured(cardId, value, 0);
      showToast('success', value ? '已设为精选' : '已取消精选');
      await loadCards();
    } catch {
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleCardSortSave = async (cardId: string) => {
    const newOrder = cardSortEdits[cardId];
    if (newOrder === undefined) return;
    setCardActionLoading(`sort-${cardId}`);
    try {
      await achievementCardsApi.setFeatured(cardId, true, newOrder);
      showToast('success', '排序已更新');
      await loadCards();
      setCardSortEdits((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    } catch {
      showToast('error', '排序更新失败');
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleAdminWithdraw = async (cardId: string, cardTitle: string) => {
    const ok = window.confirm(
      `确认将「${cardTitle}」从灵感墙强制下架？\n\n此操作会同时清除精选标记，作者可在项目详情中重新发布。`,
    );
    if (!ok) return;
    setCardActionLoading(`withdraw-${cardId}`);
    try {
      await achievementCardsApi.adminWithdraw(cardId);
      showToast('success', '已从灵感墙下架');
      await loadCards();
    } catch {
      showToast('error', '下架失败，请稍后重试');
    } finally {
      setCardActionLoading(null);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 计算：应用页面级过滤条件到当前页数据
  //   - 项目页签：叠加 matchProjectFilters
  //   - 精选作品页签：仅 is_featured=true，且叠加 matchCardFilters
  //   - 灵感墙页签：叠加 matchCardFilters
  // ──────────────────────────────────────────────────────────────

  const visibleProjects = useMemo(
    () => projects.filter(matchProjectFilters),
    [projects, matchProjectFilters],
  );

  const visibleCards = useMemo(() => {
    const base = tab === 'featured' ? cards.filter((c) => !!c.is_featured) : cards;
    return base.filter(matchCardFilters);
  }, [cards, tab, matchCardFilters]);

  // ──────────────────────────────────────────────────────────────
  // 渲染：项目卡片（all / mine 页签共用）
  // ──────────────────────────────────────────────────────────────

  const renderProjectCard = (project: Project) => {
    const demoLoading = projectActionLoading === `demo-${project.id}`;
    const workLoading = projectActionLoading === `work-${project.id}`;
    const notifyLoading = projectActionLoading === `notify-${project.id}`;
    const isOwn = project.author_id === user?.id;
    const isAdmin = user?.role === 'admin';
    const hasAchievementCard = !!project.achievement_card_id;
    const promotedDemo = projectDemoMap[project.id]; // 已收录的 demo（undefined = 未收录）
    // 封面图：优先使用关联成果卡的截图，与首页精选作品/灵感墙展示逻辑一致
    const cover = project.achievement_card_screenshots && project.achievement_card_screenshots.length > 0
      ? resolveImageUrl(project.achievement_card_screenshots[0]) : null;
    return (
      <Card key={project.id} className="overflow-hidden flex flex-col">
        <div className="relative">
          {cover ? (
            <img
              src={cover}
              alt={project.name}
              className="h-36 w-full object-cover"
              loading="lazy"
              onError={(e) => {
                // 图片加载失败时隐藏 img，让兄弟节点的渐变占位符显示（需切到 else 分支时才存在，
                // 此处兜底：直接隐藏并让父容器保留高度）
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-36 bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center">
              <span className="text-3xl text-teal-300">📦</span>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            {promotedDemo && (
              <Badge variant="success" size="sm">已收录 Demo</Badge>
            )}
            {project.achievement_card_is_featured && (
              <Badge variant="primary" size="sm">精品</Badge>
            )}
          </div>
        </div>
        <CardContent className="pt-3 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 text-sm truncate flex-1">{project.name}</h3>
            {project.mode && (
              <Badge variant="secondary" size="sm">
                {project.mode === 'standard' ? '进阶' : '轻量'}
              </Badge>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.description}</p>
          )}
          <div className="mt-2 text-xs text-gray-500">
            作者：{project.author_name || project.author_id || '未知'}
            {isOwn && <span className="ml-1 text-teal-600">（我）</span>}
          </div>
          {project.tech_stack && project.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {project.tech_stack.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" size="sm">{t}</Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-stretch">
          {promotedDemo ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={demoLoading}
              onClick={() => setDemoModal({ open: true, mode: 'edit', demo: promotedDemo, project })}
            >
              {demoLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Edit2 className="w-4 h-4 mr-1" />编辑 Demo</>}
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              disabled={demoLoading || !hasAchievementCard}
              onClick={() => handleSetFeaturedDemo(project)}
              title={!hasAchievementCard ? '该项目尚未生成成果档案卡，无法收录为 Demo' : undefined}
            >
              {demoLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Star className="w-4 h-4 mr-1" />收录为 Demo</>}
            </Button>
          )}
          {!hasAchievementCard && isAdmin && !isOwn && (
            <Button
              variant="secondary"
              size="sm"
              disabled={notifyLoading}
              onClick={() => handleNotifyAuthorForCard(project)}
              title="向该项目作者发送通知，请其补齐成果档案卡"
            >
              {notifyLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" /> : <><Bell className="w-4 h-4 mr-1" />通知作者补齐成果卡</>}
            </Button>
          )}
          {project.achievement_card_is_featured ? (
            <Button variant="error" size="sm" disabled={workLoading} onClick={() => handleFeatureProjectAsWork(project, false)}>
              {workLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><X className="w-4 h-4 mr-1" />取消精品</>}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={workLoading} onClick={() => handleFeatureProjectAsWork(project, true)}>
              {workLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Star className="w-4 h-4 mr-1" />设为精品</>}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate(`/research/projects/${project.id}/achievement`)}>
            <ExternalLink className="w-4 h-4 mr-1" />
            查看项目
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // ──────────────────────────────────────────────────────────────
  // 渲染：Demo 卡片（demo 页签专用，从 demos 表读取）
  // ──────────────────────────────────────────────────────────────

  const renderDemoCard = (demo: Demo) => {
    const pubLoading = demoActionLoading === `pub-${demo.id}`;
    const delLoading = demoActionLoading === `del-${demo.id}`;
    const cover = demo.screenshots && demo.screenshots.length > 0
      ? resolveImageUrl(demo.screenshots[0]) : null;
    return (
      <Card key={demo.id} className="overflow-hidden flex flex-col">
        <div className="relative">
          {cover ? (
            <img
              src={cover}
              alt={demo.name}
              className="h-36 w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-36 bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center">
              <span className="text-3xl text-teal-300">📦</span>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            {demo.is_public ? (
              <Badge variant="success" size="sm">已上架</Badge>
            ) : (
              <Badge variant="default" size="sm">草稿</Badge>
            )}
          </div>
        </div>
        <CardContent className="pt-3 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 text-sm truncate flex-1">{demo.name}</h3>
            {demo.difficulty && (
              <Badge variant="secondary" size="sm">
                {demo.difficulty === 'beginner' ? '入门' : demo.difficulty === 'intermediate' ? '进阶' : '高级'}
              </Badge>
            )}
          </div>
          {demo.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{demo.description}</p>
          )}
          {demo.subjects && demo.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {demo.subjects.slice(0, 3).map((s) => (
                <Badge key={s} variant="primary" size="sm">{s}</Badge>
              ))}
            </div>
          )}
          {demo.tech_stack && demo.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {demo.tech_stack.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" size="sm">{t}</Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-stretch">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleEditDemo(demo)}>
              <Edit2 className="w-4 h-4 mr-1" />编辑
            </Button>
            <Button
              variant={demo.is_public ? 'ghost' : 'success'}
              size="sm"
              disabled={pubLoading}
              onClick={() => handleToggleDemoPublic(demo)}
            >
              {pubLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <>{demo.is_public ? <><EyeOff className="w-4 h-4 mr-1" />下架</> : <><Star className="w-4 h-4 mr-1" />上架</>}</>}
            </Button>
          </div>
          <Button variant="error" size="sm" disabled={delLoading} onClick={() => handleDeleteDemo(demo)}>
            {delLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Trash2 className="w-4 h-4 mr-1" />删除</>}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // ──────────────────────────────────────────────────────────────
  // 渲染：成果卡片（featured / wall 两个页签共用）
  // ──────────────────────────────────────────────────────────────

  const renderAchievementCard = (card: AchievementCard) => {
    const featured = !!card.is_featured;
    const isFeatureLoading = cardActionLoading === card.id;
    const isSortLoading = cardActionLoading === `sort-${card.id}`;
    const isWithdrawLoading = cardActionLoading === `withdraw-${card.id}`;
    const isOwn = card.author_id === user?.id;
    const cover = card.screenshots && card.screenshots.length > 0
      ? resolveImageUrl(card.screenshots[0]) : null;
    return (
      <Card key={card.id} className="overflow-hidden flex flex-col">
        <div className="relative">
          {cover ? (
            <img src={cover} alt={card.title} className="h-40 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-40 bg-gradient-to-br from-purple-50 to-purple-100" />
          )}
          <div className="absolute top-3 right-3">
            {featured ? (
              <Badge variant="success" size="sm"><Check className="w-3 h-3 mr-0.5" />精选</Badge>
            ) : (
              <Badge variant="default" size="sm">未精选</Badge>
            )}
          </div>
        </div>
        <CardContent className="pt-4 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 text-base truncate flex-1">{card.title}</h3>
            {card.project_mode && (
              <Badge variant="secondary" size="sm">
                {card.project_mode === 'standard' ? '进阶' : '轻量'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
          <div className="mt-2 text-xs text-gray-500">
            作者：{card.author_username || card.author_id || '未知'}
            {isOwn && <span className="ml-1 text-purple-600">（我）</span>}
          </div>
          {card.capability_tags && card.capability_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {card.capability_tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="primary" size="sm">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-stretch">
          <div className="flex items-center gap-2">
            {featured ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 whitespace-nowrap">排序</span>
                  <Input
                    type="number"
                    min={0}
                    className="!w-20 !h-9 !px-2 !py-1 text-sm"
                    value={cardSortEdits[card.id] ?? card.featured_sort_order ?? 0}
                    onChange={(e) => setCardSortEdits((p) => ({ ...p, [card.id]: parseInt(e.target.value, 10) || 0 }))}
                    onBlur={() => handleCardSortSave(card.id)}
                    disabled={isSortLoading}
                  />
                </div>
                <Button variant="error" size="sm" className="flex-1" disabled={isFeatureLoading} onClick={() => handleFeatureCard(card.id, false)}>
                  {isFeatureLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><X className="w-4 h-4 mr-1" />取消精选</>}
                </Button>
              </>
            ) : (
              <Button variant="success" size="sm" className="flex-1" disabled={isFeatureLoading} onClick={() => handleFeatureCard(card.id, true)}>
                {isFeatureLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Star className="w-4 h-4 mr-1" />设为精选</>}
              </Button>
            )}
          </div>
          <Button variant="secondary" size="sm" disabled={isWithdrawLoading} onClick={() => handleAdminWithdraw(card.id, card.title)}>
            {isWithdrawLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" /> : <><EyeOff className="w-4 h-4 mr-1" />取消灵感墙</>}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // ──────────────────────────────────────────────────────────────
  // 渲染：页签内容区
  // ──────────────────────────────────────────────────────────────

  const isProjectTab = tab === 'all' || tab === 'mine';
  const isDemoTab = tab === 'demo';
  const isCardTab = tab === 'featured' || tab === 'wall';
  const isLoading = isDemoTab ? demosLoading : isProjectTab ? projectsLoading : cardsLoading;
  const hasError = isDemoTab ? demosError : isProjectTab ? projectsError : cardsError;
  const isEmpty = isDemoTab
    ? demos.length === 0
    : isProjectTab
      ? visibleProjects.length === 0
      : visibleCards.length === 0;
  const reloadFn = isDemoTab ? loadDemos : isProjectTab ? loadProjects : loadCards;

  const emptyText: Record<TabKey, string> = {
    all: '暂无项目',
    mine: '你还没有创建项目',
    demo: showDemoDrafts ? '暂无未公开的 Demo 草稿' : '暂无公开 Demo，请在「全部项目」中收录',
    featured: '暂无精选作品，请在「灵感墙」中设置精选',
    wall: '暂无公开到灵感墙的成果卡',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-6 w-6 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">精选管理</h1>
          </div>
          <p className="text-gray-600">
            管理全局 Demo 项目、精选作品与灵感墙；设置精选、调整排序、强制下架不合规内容。
          </p>
        </div>

        {/* ── 页面级搜索/过滤条件区（唯一一处，作用于所有页签的当前数据）── */}
        <form
          className="bg-white p-4 rounded-xl border border-gray-200 mb-4"
          onSubmit={(e) => { e.preventDefault(); handleSubmitFilters(); }}
        >
          {/* 基础条件 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="搜索名称/描述/一句话介绍..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div>
              <Input
                placeholder="作者名筛选..."
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
              />
            </div>
            <div>
              <select
                value={filterMode}
                onChange={(e) => { setFilterMode(e.target.value); setProjectsPage(1); setCardsPage(1); }}
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                {PROJECT_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 精选状态 + 高级过滤器折叠开关 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <div>
              <select
                value={filterFeaturedState}
                onChange={(e) => { setFilterFeaturedState(e.target.value); setProjectsPage(1); setCardsPage(1); }}
                className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                {FEATURED_STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                高级过滤（难度/Track/教学模式/技术栈/年龄段/时间预算/阶段/能力标签）
                {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 高级过滤器（SKILL.md 维度） */}
          {advancedOpen && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
              <div>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterTrack}
                  onChange={(e) => setFilterTrack(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {TRACK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterTeachingMode}
                  onChange={(e) => setFilterTeachingMode(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {TEACHING_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterTechStack}
                  onChange={(e) => setFilterTechStack(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {TECH_STACK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterAgeBand}
                  onChange={(e) => setFilterAgeBand(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {AGE_BAND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterTimeBudget}
                  onChange={(e) => setFilterTimeBudget(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {TIME_BUDGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Input
                  placeholder="能力标签（如 数据分析）"
                  value={filterCapabilityTag}
                  onChange={(e) => setFilterCapabilityTag(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3 justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={handleResetFilters}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
            <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Search className="w-4 h-4 mr-1" />
              搜索
            </Button>
          </div>
        </form>

        {/* ── 页签栏 ── */}
        <div className="mb-6 flex items-center gap-0 border-b border-gray-200">
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={`px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>


        {/* ── 内容区 ── */}
        {isLoading && isEmpty ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        ) : hasError && isEmpty ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 mb-4">{hasError}</p>
              <Button onClick={reloadFn}>重试</Button>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">{emptyText[tab]}</p>
          </div>
        ) : isCardTab ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-2">
              {visibleCards.map(renderAchievementCard)}
            </div>
            {cardsPagination && (
              <PaginationBar pagination={cardsPagination} onPageChange={setCardsPage} />
            )}
          </>
        ) : isDemoTab ? (
          <>
            {/* Demo 页签工具栏：公开/草稿切换 */}
            <div className="flex justify-end mb-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  checked={showDemoDrafts}
                  onChange={(e) => { setShowDemoDrafts(e.target.checked); setDemosPage(1); }}
                />
                只看未公开草稿
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-2">
              {demos.map(renderDemoCard)}
            </div>
            {demosPagination && (
              <PaginationBar pagination={demosPagination} onPageChange={setDemosPage} />
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-2">
              {visibleProjects.map(renderProjectCard)}
            </div>
            {projectsPagination && (
              <PaginationBar pagination={projectsPagination} onPageChange={setProjectsPage} />
            )}
          </>
        )}

        {/* ── 收录/编辑 Demo Modal ── */}
        {demoModal.open && (
          <DemoFormModal
            mode={demoModal.mode}
            project={demoModal.project}
            demo={demoModal.demo}
            onClose={() => setDemoModal({ open: false, mode: 'promote' })}
            onSubmit={handleDemoModalSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 收录/编辑 Demo 表单 Modal
//   - promote 模式：把 project 收录为 demo，name/description/screenshots 来自 project+成果卡（只读预填）
//   - edit 模式：编辑已存在 demo，所有字段可编辑
// ──────────────────────────────────────────────────────────────

const DIFFICULTY_SELECT_OPTIONS = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高级' },
];

const DISPLAY_MODE_OPTIONS = [
  { value: 'static', label: '静态展示（截图）' },
  { value: 'iframe', label: 'iframe 嵌入' },
];

// 缺失字段中文标签（模块级，AdminFeatured 和 DemoFormModal 共用）
const MISSING_FIELD_LABELS: Record<string, string> = {
  achievement_card: '成果卡（请先生成成果卡）',
  one_liner: '成果卡一句话介绍',
  screenshots: '成果卡截图',
  capability_tags: '成果卡能力标签',
};

function DemoFormModal({
  mode,
  project,
  demo,
  onClose,
  onSubmit,
}: {
  mode: 'promote' | 'edit';
  project?: Project;
  demo?: Demo;
  onClose: () => void;
  onSubmit: (data: DemoCreateFromProject, demoId?: string) => Promise<{ ok: boolean; missingFields?: string[] }>;
}) {
  const isEdit = mode === 'edit' && !!demo;

  // 基础字段（promote 模式初始空，由 prefill 接口自动填充；edit 模式预填自 demo）
  const [name, setName] = useState(isEdit ? (demo!.name || '') : '');
  const [description, setDescription] = useState(isEdit ? (demo!.description || '') : '');
  // demo 独有字段
  const [difficulty, setDifficulty] = useState<DemoCreateFromProject['difficulty']>(
    isEdit ? (demo!.difficulty || 'beginner') : 'beginner',
  );
  const [subjectsText, setSubjectsText] = useState(
    (isEdit ? demo!.subjects : []).join('、'),
  );
  const [gradeRange, setGradeRange] = useState(isEdit ? (demo!.grade_range || '13-15岁') : '13-15岁');
  const [techStackText, setTechStackText] = useState(
    (isEdit ? demo!.tech_stack : []).join('、'),
  );
  const [tagsText, setTagsText] = useState((isEdit ? demo!.tags : []).join('、'));
  const [displayMode, setDisplayMode] = useState<'iframe' | 'static'>(
    isEdit ? (demo!.display_mode as 'iframe' | 'static') || 'static' : 'static',
  );
  const [iframeUrl, setIframeUrl] = useState(isEdit ? (demo!.iframe_url || '') : '');
  const [codeUrl, setCodeUrl] = useState(isEdit ? (demo!.code_url || '') : '');
  const [downloadUrl, setDownloadUrl] = useState(isEdit ? (demo!.download_url || '') : '');
  // code_url/download_url 是否使用自定义地址（promote 模式默认自动生成）
  const [useCustomUrl, setUseCustomUrl] = useState(isEdit);
  const [demoVideoUrl, setDemoVideoUrl] = useState(isEdit ? (demo!.demo_video_url || '') : '');
  const [projectBreakdown, setProjectBreakdown] = useState(isEdit ? (demo!.project_breakdown || '') : '');
  const [explanationDoc, setExplanationDoc] = useState(isEdit ? (demo!.explanation_doc || '') : '');
  const [isPublic, setIsPublic] = useState(isEdit ? !!demo!.is_public : true);
  const [submitting, setSubmitting] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  // 成果卡状态：promote 模式下需要知道项目是否有成果卡（无则显示"补全成果卡"按钮）
  const [cardStatus, setCardStatus] = useState<'loading' | 'none' | 'ready'>(
    isEdit ? 'ready' : 'loading',
  );
  const [generatingCard, setGeneratingCard] = useState(false);
  // 成果卡对象（用于截图补全：CoverPicker 需要 card.id；promote 模式查状态时保存）
  const [achievementCard, setAchievementCard] = useState<AchievementCard | null>(null);
  // 截图是否就绪（promote 模式：prefill 后 screenshots 为空时显示"补充截图"区域）
  const [screenshotsReady, setScreenshotsReady] = useState(
    isEdit ? !!(demo!.screenshots && demo!.screenshots.length > 0) : false,
  );

  /** 加载 prefill（项目已有成果卡时调用，自动填充字段） */
  const loadPrefill = useCallback(async (pid: string) => {
    setPrefillLoading(true);
    try {
      const res = await demosApi.getPrefill(pid);
      if (!res.data) return;
      const p: DemoPrefill = res.data;
      setName(p.name);
      setDescription(p.description);
      setDifficulty(p.difficulty);
      setSubjectsText((p.subjects || []).join('、'));
      setGradeRange(p.grade_range || '13-15岁');
      setTechStackText((p.tech_stack || []).join('、'));
      setTagsText((p.tags || []).join('、'));
      setDisplayMode((p.display_mode as 'iframe' | 'static') || 'static');
      setIframeUrl(p.iframe_url || '');
      setCodeUrl(p.code_url || '');
      setDownloadUrl(p.download_url || '');
      setUseCustomUrl(false);
      setProjectBreakdown(p.project_breakdown || '');
      setExplanationDoc(p.explanation_doc || '');
      setIsPublic(p.is_public);
      const hasShots = !!(p.screenshots && p.screenshots.length > 0);
      setScreenshotsReady(hasShots);
      // 同步 prefill 的 screenshots 到 achievementCard（避免两者不一致导致预览图不显示）
      if (hasShots) {
        setAchievementCard((prev) => prev ? { ...prev, screenshots: p.screenshots } : prev);
      }
    } catch {
      showToast('error', '自动填充失败，请手动填写');
    } finally {
      setPrefillLoading(false);
    }
  }, []);

  // promote 模式：打开时先查成果卡状态，有成果卡才 prefill
  useEffect(() => {
    if (isEdit || !project) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await achievementCardsApi.getByProject(project.id);
        if (cancelled) return;
        if (res.data) {
          setAchievementCard(res.data);
          setCardStatus('ready');
          await loadPrefill(project.id);
        } else {
          setCardStatus('none');
        }
      } catch {
        if (!cancelled) setCardStatus('none');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 补全成果卡：调用与项目详情页相同的生成逻辑，成功后原地刷新字段（不跳转） */
  const handleGenerateCard = async () => {
    if (!project) return;
    setGeneratingCard(true);
    try {
      const res = await projectsApi.generateAchievementCard(project.id);
      if (res.data) {
        showToast('success', '成果卡已生成');
        setAchievementCard(res.data);
        setCardStatus('ready');
        await loadPrefill(project.id);
      } else {
        throw new Error(res.message || '成果卡生成失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '成果卡生成失败，请稍后重试';
      showToast('error', msg);
    } finally {
      setGeneratingCard(false);
    }
  };

  const splitList = (text: string): string[] =>
    text.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // code_url/download_url：自定义模式下校验非空，自动模式下传空串让后端兜底
    if (useCustomUrl && (!codeUrl.trim() || !downloadUrl.trim())) {
      showToast('error', '请填写代码地址和下载地址（或切换为自动生成）');
      return;
    }
    const data: DemoCreateFromProject = {
      difficulty,
      subjects: splitList(subjectsText),
      grade_range: gradeRange.trim() || '13-15岁',
      // 自动模式传空串 → 后端用项目导出 URL 兜底
      code_url: useCustomUrl ? codeUrl.trim() : '',
      download_url: useCustomUrl ? downloadUrl.trim() : '',
      tech_stack: splitList(techStackText),
      tags: splitList(tagsText),
      display_mode: displayMode,
      iframe_url: iframeUrl.trim() || undefined,
      demo_video_url: demoVideoUrl.trim() || undefined,
      project_breakdown: projectBreakdown.trim() || undefined,
      explanation_doc: explanationDoc.trim() || undefined,
      is_public: isPublic,
    };
    // edit 模式补上可编辑的基础字段
    if (isEdit) {
      (data as DemoUpdate).name = name.trim();
      (data as DemoUpdate).description = description.trim();
    }
    setSubmitting(true);
    try {
      const result = await onSubmit(data, isEdit ? demo!.id : undefined);
      // 收录失败且有缺失字段：自动展开对应区域（截图/标签等），不关 modal
      if (!result.ok && result.missingFields && result.missingFields.length > 0) {
        const missing = result.missingFields;
        if (missing.includes('screenshots')) {
          setScreenshotsReady(false); // 强制展开截图补全区
        }
        // 成果卡缺失不太可能在提交后出现（前面已处理），这里兜底提示
        const labels = missing.map((m) => MISSING_FIELD_LABELS[m] || m);
        showToast('error', `以下内容仍缺失，请在表单内补全：${labels.join('、')}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm';
  const textareaCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm min-h-[80px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `编辑 Demo：${demo!.name}` : `收录为 Demo：${project?.name ?? ''}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {prefillLoading && (
          <div className="px-6 py-3 bg-purple-50 text-purple-700 text-sm flex items-center gap-2 border-b border-purple-100">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
            正在从项目数据自动填充字段...
          </div>
        )}

        {/* 无成果卡提示区：promote 模式且项目无成果卡时显示，提供"补全成果卡"按钮 */}
        {cardStatus === 'none' && !isEdit && (
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-800">该项目尚未生成成果卡</p>
                <p className="text-xs text-amber-600 mt-0.5">需先生成成果卡，才能收录为 Demo。点击右侧按钮一键生成（与项目页功能一致）。</p>
              </div>
              <Button
                size="sm"
                className="!bg-amber-600 hover:!bg-amber-700 flex-shrink-0"
                disabled={generatingCard}
                onClick={handleGenerateCard}
              >
                {generatingCard
                  ? <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1" />生成中</>
                  : <><Wand2 className="w-4 h-4 mr-1" />补全成果卡</>}
              </Button>
            </div>
          </div>
        )}

        {cardStatus === 'loading' && !isEdit && (
          <div className="px-6 py-3 bg-gray-50 text-gray-500 text-sm flex items-center gap-2 border-b border-gray-100">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
            正在检查成果卡状态...
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* 基础信息（promote 模式由 prefill 自动填充，只读；edit 模式可改） */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1">基础信息</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称 {isEdit ? '' : '（自动填充自项目名）'}</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={!isEdit}
                disabled={!isEdit}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">简介 {isEdit ? '' : '（自动填充自成果卡一句话介绍）'}</label>
              <textarea
                className={textareaCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={!isEdit}
                disabled={!isEdit}
              />
            </div>
          </div>

          {/* 截图（封面）：promote 模式始终显示此区，让 admin 看到当前封面并可更换 */}
          {achievementCard && project && !isEdit && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1">
                成果卡截图（封面）
                {screenshotsReady
                  ? <span className="ml-2 text-xs font-normal text-green-600">已设置</span>
                  : <span className="ml-2 text-xs font-normal text-amber-600">缺失 · Demo 上线需要至少一张</span>}
              </h3>
              {screenshotsReady && achievementCard.screenshots && achievementCard.screenshots.length > 0 ? (
                <div className="flex items-center gap-3">
                  <img
                    src={resolveImageUrl(achievementCard.screenshots[0])}
                    alt="封面预览"
                    className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-2">当前封面预览。如需更换：</p>
                    <CoverPicker
                      card={achievementCard}
                      projectId={project.id}
                      onUpdated={(updated) => {
                        setAchievementCard(updated);
                        setScreenshotsReady(!!(updated.screenshots && updated.screenshots.length > 0));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">从项目运行截图、AI 生成或上传图片中选一张作为封面：</p>
                  <CoverPicker
                    card={achievementCard}
                    projectId={project.id}
                    onUpdated={(updated) => {
                      setAchievementCard(updated);
                      setScreenshotsReady(!!(updated.screenshots && updated.screenshots.length > 0));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Demo 独有字段（必填） */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1">Demo 属性（必填）</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">难度 *</label>
                <select className={inputCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value as DemoCreateFromProject['difficulty'])}>
                  {DIFFICULTY_SELECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">适用年级 *</label>
                <input className={inputCls} value={gradeRange} onChange={(e) => setGradeRange(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">学科标签（顿号/逗号分隔）</label>
              <input className={inputCls} value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)} placeholder="如：计算机科学、数据科学" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-gray-500">代码 / 下载地址</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    checked={useCustomUrl}
                    onChange={(e) => setUseCustomUrl(e.target.checked)}
                  />
                  自定义地址
                </label>
              </div>
              {useCustomUrl ? (
                <div className="grid grid-cols-1 gap-2">
                  <input className={inputCls} value={codeUrl} onChange={(e) => setCodeUrl(e.target.value)} placeholder="代码地址 https://..." />
                  <input className={inputCls} value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="下载地址 https://..." />
                </div>
              ) : (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  {prefillLoading
                    ? '正在自动生成...'
                    : (codeUrl
                      ? <>自动指向项目导出包：<code className="text-purple-600 break-all">{codeUrl}</code></>
                      : '收录后将自动指向项目导出接口（无需手填）')}
                </div>
              )}
            </div>
          </div>

          {/* Demo 独有字段（选填） */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1">展示物料（选填，可后续补充）</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">展示模式</label>
                <select className={inputCls} value={displayMode} onChange={(e) => setDisplayMode(e.target.value as 'iframe' | 'static')}>
                  {DISPLAY_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">iframe 嵌入地址</label>
                <input className={inputCls} value={iframeUrl} onChange={(e) => setIframeUrl(e.target.value)} placeholder="留空则用截图展示" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">技术栈（顿号/逗号分隔）</label>
              <input className={inputCls} value={techStackText} onChange={(e) => setTechStackText(e.target.value)} placeholder="如：Python、Flask" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">通用标签（顿号/逗号分隔）</label>
              <input className={inputCls} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">录屏地址</label>
              <input className={inputCls} value={demoVideoUrl} onChange={(e) => setDemoVideoUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">项目拆解说明（Markdown）</label>
              <textarea className={textareaCls} value={projectBreakdown} onChange={(e) => setProjectBreakdown(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">讲解文档（Markdown）</label>
              <textarea className={textareaCls} value={explanationDoc} onChange={(e) => setExplanationDoc(e.target.value)} />
            </div>
          </div>

          {/* 公开开关 */}
          <div className="flex items-center gap-2">
            <input
              id="demo-public"
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <label htmlFor="demo-public" className="text-sm text-gray-700 cursor-pointer">
              {isEdit ? '公开（上架到首页/Demo 列表）' : '收录后公开上架'}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={submitting}>
              {submitting ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : (isEdit ? '保存' : '收录')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
