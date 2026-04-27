interface CapabilityRadarChartProps {
  tags: string[];
}

const AXES = [
  { key: 'engineering', label: '工程实现', match: ['工程', '开发', 'web', '前端', '后端', 'python'] },
  { key: 'analysis', label: '分析建模', match: ['分析', '数据', '模型', 'ai', '机器学习'] },
  { key: 'creativity', label: '创新表达', match: ['创新', '设计', '表达', '创意'] },
  { key: 'collaboration', label: '协作沟通', match: ['协作', '沟通', '团队', '分享'] },
  { key: 'execution', label: '执行推进', match: ['实践', '执行', '项目', '落地'] },
] as const;

function clampScore(score: number) {
  return Math.max(20, Math.min(95, score));
}

function getAxisScore(tags: string[], matches: readonly string[]) {
  const hitCount = tags.reduce((count, tag) => {
    const normalized = tag.toLowerCase();
    const hit = matches.some((keyword) => normalized.includes(keyword.toLowerCase()));
    return count + (hit ? 1 : 0);
  }, 0);
  return clampScore(30 + hitCount * 18);
}

function pointForAxis(index: number, score: number, radius: number, cx: number, cy: number, total: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (score / 100) * radius;
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

export function CapabilityRadarChart({ tags }: CapabilityRadarChartProps) {
  const size = 220;
  const center = size / 2;
  const radius = 78;
  const levels = [20, 40, 60, 80, 100];
  const scores = AXES.map((axis) => getAxisScore(tags, axis.match));
  const polygon = scores
    .map((score, index) => {
      const point = pointForAxis(index, score, radius, center, center, AXES.length);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-sm font-medium text-gray-700 mb-2">能力雷达图</div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-h-64">
        {levels.map((level) => {
          const points = AXES.map((_, index) => {
            const point = pointForAxis(index, level, radius, center, center, AXES.length);
            return `${point.x},${point.y}`;
          }).join(' ');
          return <polygon key={level} points={points} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
        })}

        {AXES.map((axis, index) => {
          const outer = pointForAxis(index, 100, radius, center, center, AXES.length);
          return <line key={axis.key} x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        <polygon points={polygon} fill="rgba(13, 148, 136, 0.2)" stroke="#0d9488" strokeWidth="2" />

        {AXES.map((axis, index) => {
          const point = pointForAxis(index, 112, radius, center, center, AXES.length);
          return (
            <text key={axis.key} x={point.x} y={point.y} fontSize="11" textAnchor="middle" fill="#4b5563">
              {axis.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-gray-500">基于当前能力标签自动映射五个维度分值。</div>
    </div>
  );
}
