import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentViewerModal } from './DocumentViewerModal';
import { ProcessDocumentList } from './ProcessDocumentList';
import { ProjectDocument } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const documentFixture: ProjectDocument = {
  stage: 'stage_01_brainstorm',
  name: '头脑风暴',
  filename: '00_brainstorm.md',
  has_content: true,
  summary: '摘要'.repeat(60),
  content_length: 120,
};

describe('过程文档共享组件', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('展示文档摘要并将点击事件关联到稳定阶段标识', async () => {
    const onView = vi.fn();
    await act(async () => {
      root.render(<ProcessDocumentList documents={[documentFixture]} onView={onView} />);
    });

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('头脑风暴');
    expect(button?.textContent).toContain('摘要'.repeat(50));
    expect(button?.textContent).toContain('120 字');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onView).toHaveBeenCalledWith(documentFixture);
  });

  it('无正文时显示空态且不渲染可点击文档', async () => {
    await act(async () => {
      root.render(
        <ProcessDocumentList
          documents={[{ ...documentFixture, has_content: false, summary: '' }]}
          onView={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('该项目未沉淀过程文档');
    expect(container.querySelector('button')).toBeNull();
  });

  it('混合数据中只显示真实有正文的文档', async () => {
    await act(async () => {
      root.render(
        <ProcessDocumentList
          documents={[
            documentFixture,
            { ...documentFixture, stage: 'empty', name: '空文档', has_content: false, summary: '' },
          ]}
          onView={vi.fn()}
        />,
      );
    });

    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.textContent).toContain('头脑风暴');
    expect(container.textContent).not.toContain('空文档');
    expect(container.textContent).not.toContain('待生成');
  });

  it('以 Markdown 渲染全文并支持 Escape 关闭', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <DocumentViewerModal title="头脑风暴" content={'# 全文标题\n\n完整正文'} onClose={onClose} />,
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('全文标题');
    expect(container.textContent).toContain('完整正文');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
