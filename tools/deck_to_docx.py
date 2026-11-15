#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deck_to_docx.py — выгрузка сценария-презентации (lessons/patch-panel/index.html)
в .docx: каждый слайд — заголовок, содержимое и заметка мастера.

    python3 tools/deck_to_docx.py lessons/patch-panel/index.html \
        materials/patch-panel/deck-handout.docx

Зависимость: python-docx. Разметка слайдов читается через регулярные выражения,
поэтому дополнительных пакетов не требуется.
"""

import re
import sys
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

VIOLET = RGBColor(0x5B, 0x3F, 0xA8)
INK = RGBColor(0x19, 0x18, 0x26)
MUTED = RGBColor(0x6A, 0x67, 0x7F)
BODY_FONT = "Calibri"


def bottom_border(paragraph, color="D9CFF6", size=10):
    p_pr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), color)
    borders.append(bottom)
    p_pr.append(borders)


def strip_tags(text):
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&mdash;", "—").replace("&laquo;", "«")
    text = text.replace("&raquo;", "»").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return text


def clean(text):
    text = strip_tags(text)
    text = re.sub(r"\s+\n\s+", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def parse(html):
    """Возвращает список слайдов: {num, kicker, title, body, notes}."""
    blocks = re.findall(r'<section class="slide[^"]*"(.*?)</section>', html, re.S)
    slides = []
    for raw in blocks:
        notes_m = re.search(r'data-notes="(.*?)">', raw, re.S)
        notes = clean(notes_m.group(1)) if notes_m else ""
        body_raw = raw[notes_m.end():] if notes_m else raw

        kicker_m = re.search(r'class="slide__kicker">(.*?)<', body_raw, re.S)
        num_m = re.search(r'class="slide__num">(.*?)<', body_raw, re.S)
        h2_m = re.search(r"<h2[^>]*>(.*?)</h2>", body_raw, re.S)
        h1_m = re.search(r"<h1[^>]*>(.*?)</h1>", body_raw, re.S)

        title = clean(h2_m.group(1)) if h2_m else (clean(h1_m.group(1)) if h1_m else "")
        if not title:
            title = clean(re.search(r'class="cover__eyebrow">(.*?)<', body_raw, re.S).group(1)) if "cover__eyebrow" in body_raw else "Титул"

        # содержимое: снимаем шапку и заметки, оставляем текст
        body = re.sub(r'<div class="slide__head">.*?</div>\s*</div>', "", body_raw, flags=re.S)
        body = re.sub(r'<span class="slide__num">.*?</span>', "", body, flags=re.S)
        body = re.sub(r'<span class="slide__kicker">.*?</span>', "", body, flags=re.S)
        body = re.sub(r"<h1[^>]*>.*?</h1>", "", body, flags=re.S)
        body = re.sub(r"<h2[^>]*>.*?</h2>", "", body, flags=re.S)
        body = re.sub(r"</(li|p|tr|h3|h4|div)>", "\n", body)
        body = re.sub(r"<li[^>]*>", "• ", body)
        body = re.sub(r"</t[dh]>", " | ", body)
        body = clean(body)
        body = re.sub(r"\n{2,}", "\n", body)
        body = re.sub(r"\s*\|\s*\n", "\n", body)

        slides.append(
            {
                "num": clean(num_m.group(1)) if num_m else "",
                "kicker": clean(kicker_m.group(1)) if kicker_m else "",
                "title": title,
                "body": body,
                "notes": notes,
            }
        )
    return slides


def main(src, dst):
    html = open(src, encoding="utf-8").read()
    slides = parse(html)

    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.7)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(1.7)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK

    header = section.header.paragraphs[0]
    header.text = "Сценарий урока · Монтаж коммутационной панели · раздаточная версия слайдов"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in header.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED
        run.font.name = BODY_FONT

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("УП.01 · 09.02.06 · ООО «СетьПолис»")
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    run.font.name = BODY_FONT

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(2)
    run = title.add_run("Монтаж коммутационной панели")
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = VIOLET
    run.font.name = BODY_FONT

    sub = doc.add_paragraph()
    sub.paragraph_format.space_after = Pt(12)
    run = sub.add_run("Раздаточная версия сценария урока: слайды и заметки мастера")
    run.font.size = Pt(12)
    run.font.name = BODY_FONT
    bottom_border(sub, "5B3FA8", 12)

    for s in slides:
        head = doc.add_paragraph()
        head.paragraph_format.space_before = Pt(14)
        head.paragraph_format.space_after = Pt(2)
        head.paragraph_format.keep_with_next = True
        run = head.add_run((s["num"] + "  " if s["num"] else "") + s["title"])
        run.bold = True
        run.font.size = Pt(13)
        run.font.color.rgb = VIOLET
        run.font.name = BODY_FONT
        bottom_border(head)

        if s["kicker"]:
            k = doc.add_paragraph()
            k.paragraph_format.space_after = Pt(3)
            run = k.add_run(s["kicker"].upper())
            run.font.size = Pt(8)
            run.font.color.rgb = MUTED
            run.font.name = BODY_FONT

        if s["body"]:
            for chunk in [c.strip() for c in s["body"].split("\n") if c.strip()]:
                para = doc.add_paragraph()
                para.paragraph_format.space_after = Pt(2)
                para.paragraph_format.line_spacing = 1.08
                run = para.add_run(chunk)
                run.font.size = Pt(10)
                run.font.name = BODY_FONT

        if s["notes"]:
            n = doc.add_paragraph()
            n.paragraph_format.left_indent = Cm(0.4)
            n.paragraph_format.space_before = Pt(4)
            n.paragraph_format.space_after = Pt(4)
            run = n.add_run("Мастеру: ")
            run.bold = True
            run.font.size = Pt(9)
            run.font.color.rgb = VIOLET
            run.font.name = BODY_FONT
            run2 = n.add_run(s["notes"])
            run2.font.size = Pt(9)
            run2.font.color.rgb = MUTED
            run2.font.name = BODY_FONT

    doc.save(dst)
    return dst, len(slides)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: deck_to_docx.py <index.html> <out.docx>")
        sys.exit(1)
    out, count = main(sys.argv[1], sys.argv[2])
    print("✓ " + out + " (" + str(count) + " слайдов, " + str(os.path.getsize(out) // 1024) + " КБ)")
