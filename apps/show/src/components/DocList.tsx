import type { DocResource, ProjectLink } from '../types';

/** 资料列表：文档直链新窗口打开 */
export function DocList({ docs }: { docs: DocResource[] }) {
  return (
    <div className="doc-list">
      {docs.map((d) => (
        <a key={d.url} className="doc-item" href={d.url} target="_blank" rel="noopener noreferrer">
          <span className="doc-item__fmt">{d.format || 'file'}</span>
          <span className="doc-item__title">{d.title}</span>
          <span className="doc-item__arrow">↗</span>
        </a>
      ))}
    </div>
  );
}

/** 相关项目（fineSTEM 系列）：跳转主站 */
export function ProjectList({ projects }: { projects: ProjectLink[] }) {
  return (
    <>
      {projects.map((p) => (
        <a key={p.url} className="project-item" href={p.url} target="_blank" rel="noopener noreferrer">
          <span className="project-item__title">{p.title}</span>
          {p.note && <span className="project-item__note">{p.note}</span>}
          <span className="project-item__go">去 fineSTEM 查看 ↗</span>
        </a>
      ))}
    </>
  );
}
