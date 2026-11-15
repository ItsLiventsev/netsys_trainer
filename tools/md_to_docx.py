#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
md_to_docx.py — конвертер сценария урока из Markdown в .docx.

Поддерживает ровно тот набор разметки, который используется в
materials/patch-panel/scenario.md: заголовки #/##/###, абзацы, маркированные
и нумерованные списки, таблицы, цитаты, горизонтальные линии, **жирный**,
`код` и ссылки в тексте.

    python3 tools/md_to_docx.py materials/patch-panel/scenario.md \
        materials/patch-panel/scenario.docx

Зависимость: python-docx (pip install python-docx).
"""

import re
import sys
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

VIOLET = RGBColor(0x5B, 0x3F, 0xA8)
INK = RGBColor(0x19, 0x18, 0x26)
MUTED = RGBColor(0x6A, 0x67, 0x7F)
BODY_FONT = "Calibri"
MONO_FONT = "Consolas"


# ---------------------------------------------------------------- утилиты ---
def shade(cell, hex_color):
    """Заливка ячейки таблицы."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def cell_margins(table, top=60, bottom=60, left=100, right=100):
    tbl_pr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for side, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement("w:" + side)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tbl_pr.append(mar)


def keep_with_next(paragraph):
    paragraph.paragraph_format.keep_with_next = True


def add_field(paragraph, instr):
    """Поле Word: используется для нумерации страниц."""
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr_el = OxmlElement("w:instrText")
    instr_el.set(qn("xml:space"), "preserve")
    instr_el.text = instr
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr_el)
    run._r.append(fld_end)


def bottom_border(paragraph, color="D9CFF6", size=12):
    p_pr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), color)
    borders.append(bottom)
    p_pr.append(borders)


# ------------------------------------------------------------ разбор md ---
INLINE = re.compile(r"(\*\*.+?\*\*|`.+?`|\[[^\]]+\]\([^)]+\))")


def add_inline(paragraph, text, size=10.5, color=INK, bold_all=False):
    """Добавляет текст с поддержкой **жирного**, `кода` и [ссылок](url)."""
    for chunk in INLINE.split(text):
        if not chunk:
            continue
        if chunk.startswith("**") and chunk.endswith("**"):
            run = paragraph.add_run(chunk[2:-2])
            run.bold = True
        elif chunk.startswith("`") and chunk.endswith("`"):
            run = paragraph.add_run(chunk[1:-1])
            run.font.name = MONO_FONT
            run.font.size = Pt(size - 0.5)
            run.font.color.rgb = VIOLET
        elif chunk.startswith("[") and "](" in chunk:
            label, url = chunk[1:-1].split("](", 1)
            run = paragraph.add_run(label + " (" + url + ")")
            run.font.size = Pt(size - 0.5)
            run.font.color.rgb = VIOLET
        else:
            run = paragraph.add_run(chunk)
        run.font.size = Pt(size)
        run.font.name = BODY_FONT
        if color and not (chunk.startswith("`") or chunk.startswith("[")):
            run.font.color.rgb = color
        if bold_all:
            run.bold = True


def is_table_row(line):
    return line.strip().startswith("|") and line.strip().endswith("|")


def split_row(line):
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return cells


def is_separator(line):
    return bool(re.match(r"^\|[\s:\-|]+\|$", line.strip())) and "-" in line


def build(doc, md_lines):
    i = 0
    total = len(md_lines)
    ordered_no = 0  # нумерация внутри одного списка: сбрасывается на любом другом абзаце
    while i < total:
        raw = md_lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        # пустая строка
        if not stripped:
            i += 1
            continue

        if not re.match(r"^\s*\d+\.\s", line):
            ordered_no = 0  # новый список начинается с единицы

        # горизонтальная линия
        if stripped == "---":
            p = doc.add_paragraph()
            bottom_border(p, "CFCCD9", 8)
            p.paragraph_format.space_after = Pt(10)
            i += 1
            continue

        # заголовки
        if stripped.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(stripped[4:].upper())
            run.bold = True
            run.font.size = Pt(10)
            run.font.name = BODY_FONT
            run.font.color.rgb = VIOLET
            keep_with_next(p)
            i += 1
            continue

        if stripped.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(stripped[3:])
            run.bold = True
            run.font.size = Pt(14)
            run.font.name = BODY_FONT
            run.font.color.rgb = VIOLET
            bottom_border(p)
            keep_with_next(p)
            i += 1
            continue

        if stripped.startswith("# "):
            i += 1  # заголовок документа уже на титуле
            continue

        # таблица
        if is_table_row(stripped):
            rows = []
            while i < total and is_table_row(md_lines[i].rstrip()):
                if not is_separator(md_lines[i]):
                    rows.append(split_row(md_lines[i]))
                i += 1
            if rows:
                cols = max(len(r) for r in rows)
                table = doc.add_table(rows=0, cols=cols)
                table.style = "Table Grid"
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell_margins(table)
                for ri, row in enumerate(rows):
                    tr = table.add_row()
                    # строка не разрывается между страницами, шапка повторяется
                    tr_pr = tr._tr.get_or_add_trPr()
                    cant = OxmlElement("w:cantSplit")
                    tr_pr.append(cant)
                    if ri == 0:
                        tr_pr.append(OxmlElement("w:tblHeader"))
                    cells = tr.cells
                    for ci in range(cols):
                        text = row[ci] if ci < len(row) else ""
                        cell = cells[ci]
                        cell.paragraphs[0].text = ""
                        para = cell.paragraphs[0]
                        para.paragraph_format.space_after = Pt(1)
                        para.paragraph_format.space_before = Pt(1)
                        if ri == 0:
                            add_inline(para, text, size=9, color=INK, bold_all=True)
                            shade(cell, "EFEAFB")
                        else:
                            add_inline(para, text, size=9.5)
                doc.add_paragraph().paragraph_format.space_after = Pt(4)
            continue

        # списки
        if re.match(r"^\s*[-*] ", line):
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(2)
            add_inline(p, re.sub(r"^\s*[-*] ", "", line))
            i += 1
            continue

        if re.match(r"^\s*\d+\.\s", line):
            # нумерацию ставим вручную: стиль List Number в Word продолжает счёт
            # между разными списками, а в сценарии списки независимые
            ordered_no += 1
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.left_indent = Cm(0.9)
            p.paragraph_format.first_line_indent = Cm(-0.5)
            num = p.add_run(str(ordered_no) + ". ")
            num.font.size = Pt(10.5)
            num.font.name = BODY_FONT
            num.font.color.rgb = VIOLET
            num.bold = True
            add_inline(p, re.sub(r"^\s*\d+\.\s", "", line))
            i += 1
            continue

        # цитата
        if stripped.startswith("> "):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.4)
            p.paragraph_format.space_after = Pt(6)
            add_inline(p, stripped[2:], size=10, color=MUTED)
            i += 1
            continue

        # обычный абзац
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.12
        add_inline(p, stripped)
        i += 1


# ------------------------------------------------------------------ main ---
def main(src, dst):
    with open(src, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    doc = Document()

    # страница и базовый стиль
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(1.6)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)

    # колонтитул
    header = section.header.paragraphs[0]
    header.text = "Сценарий урока · УП.01 · Монтаж коммутационной панели · 09.02.06"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in header.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED
        run.font.name = BODY_FONT

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("стр. ")
    run.font.size = Pt(8)
    run.font.color.rgb = MUTED
    add_field(footer, "PAGE")

    # титульный блок
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("ООО «СетьПолис» · участок кабельных систем № 2 · учебная практика")
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    run.font.name = BODY_FONT

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(2)
    run = title.add_run("Сценарий проведения урока")
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = VIOLET
    run.font.name = BODY_FONT

    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(10)
    run = subtitle.add_run("Монтаж коммутационной панели · бригады 3–4 человека · ротация 20 минут")
    run.font.size = Pt(12)
    run.font.color.rgb = INK
    run.font.name = BODY_FONT
    bottom_border(subtitle, "5B3FA8", 12)

    # мета-таблица
    meta = [
        ("Специальность", "09.02.06 «Сетевое и системное администрирование»"),
        ("Предмет", "УП.01 Учебная практика. Организация, принципы построения и функционирования компьютерных сетей"),
        ("Тема", "Монтаж коммутационной панели. Форма работы: смены, бригады"),
        ("Продолжительность", "45 минут (вход в тему); тема целиком — 8 академических часов"),
        ("Форма работы", "4 бригады по 3–4 человека, две формы деятельности, ротация каждые 20 минут"),
    ]
    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    cell_margins(t)
    for key, value in meta:
        cells = t.add_row().cells
        p1 = cells[0].paragraphs[0]
        p1.paragraph_format.space_after = Pt(1)
        r1 = p1.add_run(key)
        r1.bold = True
        r1.font.size = Pt(9)
        r1.font.name = BODY_FONT
        shade(cells[0], "F6F4FC")
        p2 = cells[1].paragraphs[0]
        p2.paragraph_format.space_after = Pt(1)
        add_inline(p2, value, size=9.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # оглавление (статичное, по разделам)
    toc_title = doc.add_paragraph()
    run = toc_title.add_run("СОДЕРЖАНИЕ")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = VIOLET
    run.font.name = BODY_FONT
    keep_with_next(toc_title)

    for line in lines:
        if line.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.left_indent = Cm(0.3)
            run = p.add_run("· " + line[3:])
            run.font.size = Pt(9.5)
            run.font.color.rgb = INK
            run.font.name = BODY_FONT

    doc.add_page_break()

    # основной текст (титульные строки пропускаем)
    body_start = 0
    for idx, line in enumerate(lines):
        if line.startswith("# "):
            body_start = idx + 1
            break
    # строки-мета до первого раздела тоже пропускаем: они уже на титуле
    build(doc, lines[body_start:])

    doc.save(dst)
    return dst


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: md_to_docx.py <input.md> <output.docx>")
        sys.exit(1)
    out = main(sys.argv[1], sys.argv[2])
    print("✓ " + out + " (" + str(os.path.getsize(out) // 1024) + " КБ)")
