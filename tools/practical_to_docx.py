#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
practical_to_docx.py — собирает практическое занятие (markdown) в .docx
в офисном стиле методички: Times New Roman 12, интервал 1,15, поля 2/1,5 см,
жирные заголовки, нумерованные шаги, таблицы с рамками.

    python3 tools/practical_to_docx.py materials/patch-panel/practical-work-panel.md \
        materials/patch-panel/practical-work-panel.docx
"""

import re
import sys
import os
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FONT = "Times New Roman"


def shade(cell, hex_color="F2F2F2"):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def cell_margins(table, top=40, bottom=40, left=90, right=90):
    tbl_pr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for side, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement("w:" + side)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tbl_pr.append(mar)


INLINE = re.compile(r"(\*\*.+?\*\*|`.+?`)")


def add_inline(par, text, size=12, bold=False, italic=False):
    for chunk in INLINE.split(text):
        if not chunk:
            continue
        if chunk.startswith("**") and chunk.endswith("**"):
            run = par.add_run(chunk[2:-2])
            run.bold = True
        elif chunk.startswith("`") and chunk.endswith("`"):
            run = par.add_run(chunk[1:-1])
            run.font.name = "Consolas"
        else:
            run = par.add_run(chunk)
            if bold:
                run.bold = True
        run.font.size = Pt(size)
        if italic:
            run.italic = True
        if run.font.name != "Consolas":
            run.font.name = FONT


def is_row(line):
    s = line.strip()
    return s.startswith("|") and s.endswith("|")


def is_sep(line):
    return bool(re.match(r"^\|[\s:\-|]+\|$", line.strip())) and "-" in line


def build(doc, lines):
    i, n = 0, len(lines)
    while i < n:
        line = lines[i].rstrip()
        st = line.strip()
        if not st:
            i += 1
            continue

        # таблица
        if is_row(st):
            rows = []
            while i < n and is_row(lines[i].rstrip()):
                if not is_sep(lines[i]):
                    rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            cols = max(len(r) for r in rows)
            table = doc.add_table(rows=0, cols=cols)
            table.style = "Table Grid"
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell_margins(table)
            for ri, row in enumerate(rows):
                tr = table.add_row()
                tr_pr = tr._tr.get_or_add_trPr()
                tr_pr.append(OxmlElement("w:cantSplit"))
                if ri == 0:
                    tr_pr.append(OxmlElement("w:tblHeader"))
                for ci in range(cols):
                    cell = tr.cells[ci]
                    par = cell.paragraphs[0]
                    par.paragraph_format.space_before = Pt(1)
                    par.paragraph_format.space_after = Pt(1)
                    par.paragraph_format.line_spacing = 1.0
                    text = row[ci] if ci < len(row) else ""
                    add_inline(par, text, size=10.5, bold=(ri == 0))
                    if ri == 0:
                        shade(cell)
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        # заголовки
        if st.startswith("### "):
            par = doc.add_paragraph()
            par.paragraph_format.space_before = Pt(10)
            par.paragraph_format.space_after = Pt(3)
            run = par.add_run(st[4:])
            run.bold = True
            run.italic = True
            run.font.size = Pt(12)
            run.font.name = FONT
            par.paragraph_format.keep_with_next = True
            i += 1
            continue

        if st.startswith("## "):
            par = doc.add_paragraph()
            par.paragraph_format.space_before = Pt(14)
            par.paragraph_format.space_after = Pt(5)
            run = par.add_run(st[3:])
            run.bold = True
            run.font.size = Pt(13)
            run.font.name = FONT
            par.paragraph_format.keep_with_next = True
            i += 1
            continue

        if st.startswith("# "):
            i += 1
            continue

        # вложенный маркер (два и более пробела отступа)
        if re.match(r"^\s{2,}[-•] ", line):
            par = doc.add_paragraph()
            par.paragraph_format.left_indent = Cm(2.2)
            par.paragraph_format.first_line_indent = Cm(-0.5)
            par.paragraph_format.space_after = Pt(1)
            par.paragraph_format.line_spacing = 1.15
            add_inline(par, "– " + re.sub(r"^\s*[-•] ", "", line))
            i += 1
            continue

        # маркированный список первого уровня
        if re.match(r"^[-•] ", line):
            par = doc.add_paragraph()
            par.paragraph_format.left_indent = Cm(1.25)
            par.paragraph_format.first_line_indent = Cm(-0.5)
            par.paragraph_format.space_after = Pt(2)
            par.paragraph_format.line_spacing = 1.15
            add_inline(par, "– " + re.sub(r"^[-•] ", "", line))
            i += 1
            continue

        # нумерованный список: номер сохраняем как в методичке
        m = re.match(r"^(\d+)\.\s+(.*)$", st)
        if m:
            par = doc.add_paragraph()
            par.paragraph_format.left_indent = Cm(1.25)
            par.paragraph_format.first_line_indent = Cm(-0.5)
            par.paragraph_format.space_after = Pt(2)
            par.paragraph_format.line_spacing = 1.15
            par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            add_inline(par, m.group(1) + ". " + m.group(2))
            i += 1
            continue

        # абзац
        par = doc.add_paragraph()
        par.paragraph_format.space_after = Pt(5)
        par.paragraph_format.line_spacing = 1.15
        par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_inline(par, st)
        i += 1


def main(src, dst):
    lines = open(src, encoding="utf-8").read().split("\n")

    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = Cm(2)
    sec.bottom_margin = Cm(2)
    sec.left_margin = Cm(3)
    sec.right_margin = Cm(1.5)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(12)
    normal.paragraph_format.line_spacing = 1.15
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        rfonts.set(qn(attr), FONT)

    # титульная строка
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(2)
    run = title.add_run("Практическое занятие № 10")
    run.bold = True
    run.font.size = Pt(15)
    run.font.name = FONT

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.paragraph_format.space_after = Pt(12)
    run = sub.add_run("УП.01 Учебная практика · 09.02.06 «Сетевое и системное администрирование»")
    run.font.size = Pt(11)
    run.font.name = FONT

    body = lines[1:] if lines and lines[0].startswith("# ") else lines
    # пропускаем строку «## Тема…» — она уже в заголовке
    build(doc, body)
    doc.save(dst)
    return dst


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: practical_to_docx.py <in.md> <out.docx>")
        sys.exit(1)
    out = main(sys.argv[1], sys.argv[2])
    print("✓ " + out + " (" + str(os.path.getsize(out) // 1024) + " КБ)")
