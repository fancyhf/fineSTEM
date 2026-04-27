import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Terminal, ExternalLink, BookOpen, Power, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectsApi, skillsApi } from '../services/api';
import { Project, SkillManifest, SkillRecord } from '../types';

export function Connect() {
  const { user } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [exportFormat, setExportFormat] = React.useState<'zip' | 'pdf' | 'docx' | 'md' | 'json'>('zip');
  const [loading, setLoading] = React.useState(false);
  const [marketplaceSkills, setMarketplaceSkills] = React.useState<SkillManifest[]>([]);
  const [installedSkills, setInstalledSkills] = React.useState<SkillRecord[]>([]);
  const [skillLoading, setSkillLoading] = React.useState(false);
  const [tutorialSkill, setTutorialSkill] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadProjects = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const response = await projectsApi.list({ page: 1, page_size: 100 });
        const items = response.data?.items || [];
        setProjects(items);
        if (items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    const loadSkills = async () => {
      if (!user) return;
      try {
        setSkillLoading(true);
        const [marketplaceRes, installedRes] = await Promise.all([
          skillsApi.marketplace(),
          skillsApi.listInstalled(),
        ]);
        setMarketplaceSkills(marketplaceRes.data || []);
        setInstalledSkills(installedRes.data || []);
      } finally {
        setSkillLoading(false);
      }
    };
    loadProjects();
    loadSkills();
  }, [user]);

  const isInstalled = (skillId: string) => installedSkills.find(item => item.manifest.skill_id === skillId);

  const handleInstallSkill = async (skillId: string) => {
    if (!user) return;
    await skillsApi.install({ skill_id: skillId, source: 'marketplace' });
    const installedRes = await skillsApi.listInstalled();
    setInstalledSkills(installedRes.data || []);
  };

  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    if (!user) return;
    await skillsApi.toggle(skillId, enabled);
    const installedRes = await skillsApi.listInstalled();
    setInstalledSkills(installedRes.data || []);
  };

  const handleDownload = async () => {
    if (!selectedProjectId) return;
    try {
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      if (exportFormat === 'zip' || exportFormat === 'pdf' || exportFormat === 'docx') {
        const res = await projectsApi.exportFile(selectedProjectId, exportFormat);
        const blob = res.blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.fileName || `${selectedProject?.name || 'project'}-export.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const content = await projectsApi.export(selectedProjectId, exportFormat);
        const fileExt = exportFormat === 'json' ? 'json' : 'md';
        const mimeType = exportFormat === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8';
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedProject?.name || 'project'}-export.${fileExt}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出失败', error);
      alert('导出失败，请稍后重试');
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">AI IDE 互联</h1>

      {/* Skills Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Skill 市场</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {marketplaceSkills.map((skill) => {
            const installed = isInstalled(skill.skill_id);
            return (
              <SkillCard
                key={skill.skill_id}
                title={skill.name}
                description={skill.description}
                version={skill.version}
                status={installed?.status}
                onInstall={() => handleInstallSkill(skill.skill_id)}
                onToggle={(enabled) => handleToggleSkill(skill.skill_id, enabled)}
                onTutorial={() => setTutorialSkill(skill.name)}
              />
            );
          })}
          {!skillLoading && marketplaceSkills.length === 0 && (
            <div className="text-sm text-gray-500">暂无可用 Skill</div>
          )}
        </div>
      </section>

      {/* IDEs Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">支持的 AI IDE</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: 'Trae', desc: '字节跳动 AI IDE，内置 AI 编程助手', url: 'https://www.trae.ai/' },
            { name: 'Cursor', desc: 'AI-First 代码编辑器，支持多模型', url: 'https://cursor.sh/' },
            { name: 'VS Code', desc: '微软编辑器 + Cline/Continue 插件', url: 'https://code.visualstudio.com/' },
            { name: 'CodeBuddy', desc: '腾讯 AI 编程助手', url: 'https://codebuddy.cc/' },
          ].map((ide) => (
            <Card key={ide.name} hoverable className="text-center p-6 cursor-pointer" onClick={() => window.open(ide.url, '_blank')}>
              <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-800">{ide.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{ide.desc}</p>
              <p className="text-xs text-teal-600 mt-2">点击了解安装方式</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Project Download Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>项目下载中心</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-700">
                请先登录后使用项目下载中心。
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择项目
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={loading || projects.length === 0}
                  >
                    {projects.length === 0 && (
                      <option value="">暂无可下载项目</option>
                    )}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    导出格式
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'zip' | 'pdf' | 'docx' | 'md' | 'json')}
                  >
                    <option value="zip">项目包 (.zip)</option>
                    <option value="pdf">结题报告 (.pdf)</option>
                    <option value="docx">开题报告 (.docx)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="json">JSON (.json)</option>
                  </select>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                  <p>下载项目档案后，使用 AI IDE 打开即可继续开发。</p>
                  <p className="mt-1">支持 ZIP 项目包、PDF/DOCX 报告、Markdown/JSON 数据格式。</p>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleDownload}
              disabled={!user || !selectedProjectId || loading}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              下载项目档案
            </Button>
          </CardFooter>
        </Card>
      </section>

      {tutorialSkill && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setTutorialSkill(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{tutorialSkill} 使用教程</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>1. 在 Skill 市场安装并启用该 Skill</p>
              <p>2. 在 AI IDE 中打开项目目录</p>
              <p>3. 在对话中输入 Skill 对应的指令或问题，AI 会自动调用</p>
              <p>4. 查看 Skill 详情页获取更多使用示例</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setTutorialSkill(null)}>知道了</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  title: string;
  description: string;
  version: string;
  status?: 'installed' | 'enabled' | 'disabled';
  onInstall: () => void;
  onToggle: (enabled: boolean) => void;
  onTutorial: () => void;
}

function SkillCard({ title, description, version, status, onInstall, onToggle, onTutorial }: SkillCardProps) {
  return (
    <Card hoverable>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-gray-600 text-sm mt-1">{description}</p>
            <p className="text-gray-400 text-xs mt-2">v{version}</p>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex gap-2">
        {!status ? (
          <Button variant="secondary" className="flex-1" onClick={onInstall}>
            <Download className="w-4 h-4 mr-2" />
            安装
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onToggle(status !== 'enabled')}
          >
            <Power className="w-4 h-4 mr-2" />
            {status === 'enabled' ? '停用' : '启用'}
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={onTutorial}>
          <BookOpen className="w-4 h-4 mr-2" />
          查看教程
        </Button>
      </CardFooter>
    </Card>
  );
}
