"""
文档生成服务

用途：生成项目文档（MD/JSON/PDF/DOCX）与下载元信息
维护者：AI Agent
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.time_utils import utc_now_iso, utc_now
from app.repositories.runtime_db import db
from app.schemas.documents import DocumentFormat, DocumentType, PublicProjectDocument
from app.services.stage_constants import (
    ARTIFACT_DISPLAY_NAMES,
    ARTIFACT_TO_BLOB_KEY,
    ARTIFACT_TO_FILENAME,
    ARTIFACT_TO_STAGE,
    PROCESS_ARTIFACT_ORDER,
)

DOCUMENT_SUMMARY_LENGTH = 100
REPORT_SUMMARY_LENGTH = 300
REPORT_TITLES: dict[DocumentType, str] = {
    "proposal": "开题报告",
    "technical": "技术报告",
    "final": "结题报告",
}
REPORT_ARTIFACTS: dict[DocumentType, tuple[str, ...]] = {
    "proposal": ("brainstorm", "project_brief"),
    "technical": ("constraints", "track_plan", "design", "step_plan", "dev_log"),
    "final": (),
}


JSON_FIELD_LABELS: dict[str, str] = {
    "title": "项目标题",
    "one_liner": "一句话介绍",
    "topic": "项目主题",
    "goal": "项目目标",
    "description": "项目说明",
    "success_criteria": "成功标准",
    "risks": "风险清单",
    "must_have": "必须实现",
    "wont_do": "暂不实现",
    "assumptions": "假设与约束",
    "track": "技术轨道",
    "tech_stack": "技术栈",
    "acceptance_criteria": "验收用例",
    "acceptance_results": "验收结果",
    "steps": "分步计划",
    "name": "名称",
    "run": "操作",
    "check": "检查",
    "rollback": "回退",
    "reflections": "学习反思",
    "reflection": "反思",
    "brief_reflection": "简要反思",
    "result": "项目成果",
    "core_features": "核心功能",
    "expected": "预期结果",
    "actual": "实际结果",
    "status": "状态",
    "notes": "备注",
    "content": "内容",
}


def _json_scalar(value: Any) -> str:
    if value is None:
        return "暂无"
    if isinstance(value, bool):
        return "是" if value else "否"
    return str(value)


def _append_json_node(lines: list[str], value: Any, level: int = 3) -> None:
    """递归保留 JSON 全部字段，并转换为读者可读的 Markdown。"""
    if isinstance(value, dict):
        for key, item in value.items():
            label = JSON_FIELD_LABELS.get(key, key.replace("_", " "))
            if isinstance(item, (dict, list)):
                if not item:
                    lines.append(f"- **{label}**：暂无")
                    continue
                heading = f"### {label}" if level <= 3 else f"**{label}**"
                lines.extend(["", heading, ""])
                _append_json_node(lines, item, level + 1)
            else:
                lines.append(f"- **{label}**：{_json_scalar(item)}")
        return
    if isinstance(value, list):
        for index, item in enumerate(value, start=1):
            if isinstance(item, (dict, list)):
                lines.extend(["", f"**第 {index} 项**", ""])
                _append_json_node(lines, item, level + 1)
            else:
                lines.append(f"- {_json_scalar(item)}")
        return
    lines.append(_json_scalar(value))


def _json_to_markdown(value: Any) -> str:
    lines: list[str] = []
    _append_json_node(lines, value)
    return "\n".join(lines).strip() + "\n"


def format_document_content(content: str) -> str:
    """仅在内容确为完整 JSON 时转换；无效或不完整 JSON 保留原文，避免二次损坏。"""
    stripped = content.strip()
    if not stripped.startswith(("{", "[")):
        return content
    try:
        parsed = json.loads(stripped)
    except (json.JSONDecodeError, TypeError):
        return content
    if isinstance(parsed, str):
        return parsed
    if isinstance(parsed, (dict, list)):
        return _json_to_markdown(parsed)
    return content


def _document_summary(content: str, length: int = DOCUMENT_SUMMARY_LENGTH) -> str:
    plain_lines = [
        line.strip().lstrip("#>- ").replace("**", "")
        for line in content.splitlines()
        if line.strip()
    ]
    return re.sub(r"\s+", " ", " ".join(plain_lines))[:length]


def _has_real_content(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def _build_light_process_documents(light_data: dict[str, Any]) -> list[PublicProjectDocument]:
    """轻量项目只返回真实存在的三类过程记录，不伪造九份标准阶段文档。"""
    specs = (
        ("light_step_01", "想法与方向", "light_01_topic.md", ("project_name", "one_liner", "topic", "goal", "core_features")),
        ("light_step_02", "设计与实现", "light_02_steps.md", ("steps",)),
        ("light_step_03", "成果与反思", "light_03_reflection.md", ("result", "reflection", "brief_reflection")),
    )
    documents: list[PublicProjectDocument] = []
    for stage, name, filename, fields in specs:
        selected = {key: light_data[key] for key in fields if _has_real_content(light_data.get(key))}
        if not selected:
            continue
        content = _json_to_markdown(selected)
        documents.append(PublicProjectDocument(
            stage=stage,
            name=name,
            filename=filename,
            has_content=True,
            summary=_document_summary(content),
            content=content,
            content_length=len(content),
        ))
    return documents


def _read_process_artifacts(progress: dict[str, Any]) -> dict[str, str]:
    """只从 standard_step_data 读取权威工件正文。"""
    standard_data = progress.get("standard_step_data")
    if not isinstance(standard_data, dict):
        standard_data = {}
    artifacts: dict[str, str] = {}
    for artifact_name in PROCESS_ARTIFACT_ORDER:
        blob_key = ARTIFACT_TO_BLOB_KEY[artifact_name]
        raw_content = standard_data.get(blob_key, "")
        artifacts[artifact_name] = (
            raw_content if isinstance(raw_content, str) else str(raw_content or "")
        )
    return artifacts


def build_process_documents(progress: dict[str, Any]) -> list[PublicProjectDocument]:
    """统一构造公开与作者文档，优先标准工件，空标准项目回退到轻量真实记录。"""
    artifacts = _read_process_artifacts(progress)
    documents: list[PublicProjectDocument] = []
    for artifact_name, raw_content in artifacts.items():
        content = format_document_content(raw_content)
        documents.append(
            PublicProjectDocument(
                stage=ARTIFACT_TO_STAGE.get(artifact_name, artifact_name),
                name=ARTIFACT_DISPLAY_NAMES[artifact_name],
                filename=ARTIFACT_TO_FILENAME[artifact_name],
                has_content=bool(content.strip()),
                summary=_document_summary(content),
                content=content,
                content_length=len(content),
            )
        )
    if any(document.has_content for document in documents):
        return documents
    light_data = progress.get("light_step_data")
    if isinstance(light_data, dict):
        return _build_light_process_documents(light_data)
    return documents


def _append_process_sections(
    lines: list[str], document_type: DocumentType, artifacts: dict[str, str]
) -> None:
    """将真实工件全文或摘要追加到对应报告。"""
    if document_type != "final":
        for artifact_name in REPORT_ARTIFACTS[document_type]:
            display_name = ARTIFACT_DISPLAY_NAMES[artifact_name]
            content = format_document_content(artifacts[artifact_name])
            lines.extend(["", f"## {display_name}", content or f"暂无{display_name}文档"])
        return

    evaluate_content = format_document_content(artifacts["evaluate"])
    lines.extend(["", "## 验收评估", evaluate_content or "暂无验收评估文档"])
    lines.extend(["", "## 过程文档摘要"])
    for artifact_name in PROCESS_ARTIFACT_ORDER:
        content = format_document_content(artifacts[artifact_name])
        summary = _document_summary(content, REPORT_SUMMARY_LENGTH) if content else "暂无文档"
        lines.extend(["", f"### {ARTIFACT_DISPLAY_NAMES[artifact_name]}", summary])


class DocumentService:
    def __init__(self) -> None:
        self.base_path = Path(settings.STORAGE_BASE_PATH)
        self.exports_dir = self.base_path / settings.STORAGE_EXPORTS_DIR
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def _snapshot(self, project_id: str) -> dict[str, Any]:
        project = db.get_project(project_id)
        if not project:
            raise ValueError("项目不存在")
        progress = db.get_skill_state(project_id)
        evidence_list = db.list_evidence_by_project(project_id, skip=0, limit=1000)
        achievement = db.get_achievement_card_by_project(project_id)
        return {
            "project": project.model_dump(mode="json"),
            "progress": progress.model_dump(mode="json") if progress else {},
            "evidence": [item.model_dump(mode="json") for item in evidence_list],
            "achievement_card": achievement.model_dump(mode="json") if achievement else None,
            "generated_at": utc_now_iso(),
        }

    def _build_markdown(self, document_type: DocumentType, snapshot: dict[str, Any]) -> str:
        project = snapshot["project"]
        progress = snapshot["progress"]
        evidence = snapshot["evidence"]
        achievement = snapshot["achievement_card"]
        title = f"{project['name']} - {REPORT_TITLES[document_type]}"
        lines = [
            f"# {title}",
            "",
            "## 项目概况",
            f"- 项目ID: {project.get('id', '')}",
            f"- 模式: {project.get('mode', '')}",
            f"- 当前阶段: {project.get('current_stage', '')}",
            f"- 生成时间: {snapshot.get('generated_at', '')}",
            "",
            "## 项目描述",
            project.get("description", "") or "暂无",
            "",
            "## 进度摘要",
            f"- 当前阶段: {progress.get('current_stage', '未知')}",
            f"- 历史节点数: {len(progress.get('stage_history', []))}",
            "",
            "## 证据清单",
        ]
        if evidence:
            for index, item in enumerate(evidence, start=1):
                evidence_title = item.get("title") or f"证据 {index}"
                content = str(item.get("content", "") or "")
                lines.extend([
                    "",
                    f"### {evidence_title}",
                    f"- 类型: {item.get('type', 'unknown')}",
                    "",
                    content,
                ])
        else:
            lines.append("- 暂无证据")

        if achievement:
            lines.extend([
                "",
                "## 成果档案卡",
                f"- 标题: {achievement.get('title', '')}",
                f"- 一句话介绍: {achievement.get('one_liner', '')}",
                f"- 反思: {achievement.get('reflection', '')}",
            ])

        _append_process_sections(lines, document_type, _read_process_artifacts(progress))
        lines.extend([
            "",
            "## 生成说明",
            "本报告由平台实时拼装（项目描述 + 证据 + 过程文档），生成时间见页眉。",
        ])
        return "\n".join(lines) + "\n"

    def _to_docx(self, markdown_text: str) -> bytes:
        from docx import Document
        from docx.shared import Pt, Cm, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = Document()

        style = doc.styles["Normal"]
        font = style.font
        font.name = "SimSun"
        font.size = Pt(11)
        style.paragraph_format.line_spacing = 1.5
        style.paragraph_format.space_after = Pt(4)

        for section in doc.sections:
            section.top_margin = Cm(2.54)
            section.bottom_margin = Cm(2.54)
            section.left_margin = Cm(3.17)
            section.right_margin = Cm(3.17)

        for raw in markdown_text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("# "):
                text = line[2:]
                p = doc.add_heading(text, level=1)
                for run in p.runs:
                    run.font.color.rgb = RGBColor(0x0F, 0x76, 0x6E)
            elif line.startswith("## "):
                text = line[3:]
                p = doc.add_heading(text, level=2)
                for run in p.runs:
                    run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
            elif line.startswith("- "):
                text = line[2:]
                doc.add_paragraph(text, style="List Bullet")
            else:
                doc.add_paragraph(line)

        buffer = io.BytesIO()
        doc.save(buffer)
        return buffer.getvalue()

    def _to_pdf(self, markdown_text: str) -> bytes:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.lib.enums import TA_LEFT, TA_CENTER

        font_paths = [
            Path("C:/Windows/Fonts/msyh.ttc"),
            Path("C:/Windows/Fonts/simsun.ttc"),
            Path("C:/Windows/Fonts/simhei.ttf"),
        ]
        cn_font_name = "Helvetica"
        for fp in font_paths:
            if fp.exists():
                try:
                    pdfmetrics.registerFont(TTFont("CNFont", str(fp)))
                    cn_font_name = "CNFont"
                    break
                except Exception:
                    continue

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=2.5 * cm,
            rightMargin=2.5 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2.5 * cm,
        )

        styles = getSampleStyleSheet()
        style_h1 = ParagraphStyle(
            "CN_H1", parent=styles["Heading1"],
            fontName=cn_font_name, fontSize=18, leading=24,
            spaceAfter=12, alignment=TA_CENTER,
        )
        style_h2 = ParagraphStyle(
            "CN_H2", parent=styles["Heading2"],
            fontName=cn_font_name, fontSize=14, leading=20,
            spaceAfter=8, spaceBefore=12,
        )
        style_normal = ParagraphStyle(
            "CN_Normal", parent=styles["Normal"],
            fontName=cn_font_name, fontSize=11, leading=18,
            spaceAfter=4,
        )
        style_bullet = ParagraphStyle(
            "CN_Bullet", parent=styles["Normal"],
            fontName=cn_font_name, fontSize=11, leading=18,
            leftIndent=20, spaceAfter=2,
        )

        story: list[Any] = []
        for raw in markdown_text.splitlines():
            line = raw.strip()
            if not line:
                story.append(Spacer(1, 6))
                continue
            if line.startswith("# "):
                text = line[2:]
                story.append(Paragraph(text, style_h1))
            elif line.startswith("## "):
                text = line[3:]
                story.append(Paragraph(text, style_h2))
            elif line.startswith("- "):
                text = line[2:]
                safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(f"\u2022 {safe}", style_bullet))
            else:
                safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(safe, style_normal))

        doc.build(story)
        return buffer.getvalue()

    def generate(
        self, project_id: str, document_type: DocumentType, fmt: DocumentFormat
    ) -> tuple[str, str, bytes | str]:
        snapshot = self._snapshot(project_id)
        markdown_text = self._build_markdown(document_type, snapshot)
        ts = utc_now().strftime("%Y%m%d%H%M%S")
        basename = f"{project_id}_{document_type}_{ts}"

        if fmt == "md":
            return f"{basename}.md", "text/markdown; charset=utf-8", markdown_text
        if fmt == "json":
            payload = {
                "document_type": document_type,
                "snapshot": snapshot,
                "markdown": markdown_text,
            }
            return (
                f"{basename}.json",
                "application/json; charset=utf-8",
                json.dumps(payload, ensure_ascii=False, indent=2),
            )
        if fmt == "docx":
            return (
                f"{basename}.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                self._to_docx(markdown_text),
            )
        if fmt == "pdf":
            return f"{basename}.pdf", "application/pdf", self._to_pdf(markdown_text)
        raise ValueError("不支持的导出格式")


document_service = DocumentService()
