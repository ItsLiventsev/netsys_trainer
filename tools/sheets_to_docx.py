#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sheets_to_docx.py — отдельные документы смены в .docx:

    материалы/журнал кроссовой  -> materials/patch-panel/journal-krossovoy.docx
    операционная карта          -> materials/patch-panel/operation-card.docx
    акт по образцу ГОСТ         -> materials/patch-panel/act-gost.docx

Стиль — офисный бланк: Times New Roman, поля под подшивку, таблицы с рамками,
серые шапки, пустые поля для заполнения от руки.

    python3 tools/sheets_to_docx.py [каталог]
"""

import os
import sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FONT = "Times New Roman"
GREY = "EDEDED"
INK = RGBColor(0x00, 0x00, 0x00)
MUTED = RGBColor(0x55, 0x55, 0x55)

ORG = "ООО «СетьПолис» · участок кабельных систем № 2"
OBJ = "ООО «Контур-Логистика», складской комплекс «Северный», кроссовая К-2, стойка ШТК-2"


# ---------------------------------------------------------------- утилиты ---
def shade(cell, color=GREY):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
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


def set_row_height(row, cm):
    tr_pr = row._tr.get_or_add_trPr()
    tr_h = OxmlElement("w:trHeight")
    tr_h.set(qn("w:val"), str(int(cm * 567)))
    tr_h.set(qn("w:hRule"), "atLeast")
    tr_pr.append(tr_h)


def no_split(row, header=False):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))
    if header:
        tr_pr.append(OxmlElement("w:tblHeader"))


def borders(table):
    tbl_pr = table._tbl.tblPr
    bd = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "7F7F7F")
        bd.append(el)
    tbl_pr.append(bd)


def width(table, widths_cm):
    table.autofit = False
    for row in table.rows:
        for idx, w in enumerate(widths_cm):
            if idx < len(row.cells):
                row.cells[idx].width = Cm(w)


def cell_text(cell, text, size=10.5, bold=False, align=None, mono=False, color=None):
    par = cell.paragraphs[0]
    par.paragraph_format.space_before = Pt(1)
    par.paragraph_format.space_after = Pt(1)
    par.paragraph_format.line_spacing = 1.05
    if align:
        par.alignment = align
    run = par.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Consolas" if mono else FONT
    if color:
        run.font.color.rgb = color
    return par


def top_borderless_sign(par):
    pass


def h_par(doc, text, size=13, space_before=14, space_after=6, align=WD_ALIGN_PARAGRAPH.LEFT, color=INK):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.alignment = align
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    run.font.name = FONT
    run.font.color.rgb = color
    return p


def p_par(doc, text, size=11, space_after=5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, color=INK, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    p.alignment = align
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.name = FONT
    run.font.color.rgb = color
    run.italic = italic
    return p


def base_doc(compact=False):
    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.PORTRAIT
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = Cm(1.6)
    sec.bottom_margin = Cm(1.6)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(1.2)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(4)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        rfonts.set(qn(attr), FONT)

    # колонтитул
    head = sec.header.paragraphs[0]
    head.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = head.add_run("УП.01 · 09.02.06 · монтаж коммутационной (патч-)панели")
    run.font.size = Pt(8)
    run.font.name = FONT
    run.font.color.rgb = MUTED

    return doc


def doc_head(doc, title, subtitle, right_lines):
    """Шапка бланка: организация слева, номер формы справа, название по центру."""
    t = doc.add_table(rows=1, cols=2)
    borders_off = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "nil")
        borders_off.append(el)
    t._tbl.tblPr.append(borders_off)
    width(t, [12.6, 5.0])

    left = t.rows[0].cells[0]
    cell_text(left, ORG, size=8.5, color=MUTED)
    sub_par = left.add_paragraph()
    sub_par.paragraph_format.space_after = Pt(0)
    run = sub_par.add_run(subtitle)
    run.font.size = Pt(8.5)
    run.font.name = FONT
    run.font.color.rgb = MUTED

    right = t.rows[0].cells[1]
    for idx, line in enumerate(right_lines):
        par = right.paragraphs[0] if idx == 0 else right.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        par.paragraph_format.space_after = Pt(0)
        run = par.add_run(line)
        run.font.size = Pt(8.5)
        run.font.name = FONT
        run.font.color.rgb = MUTED

    title_par = doc.add_paragraph()
    title_par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_par.paragraph_format.space_before = Pt(10)
    title_par.paragraph_format.space_after = Pt(2)
    run = title_par.add_run(title)
    run.bold = True
    run.font.size = Pt(15)
    run.font.name = FONT

    rule = doc.add_paragraph()
    rule.paragraph_format.space_after = Pt(8)
    p_pr = rule._p.get_or_add_pPr()
    pbd = OxmlElement("w:pBdr")
    bot = OxmlElement("w:bottom")
    bot.set(qn("w:val"), "single")
    bot.set(qn("w:sz"), "12")
    bot.set(qn("w:space"), "1")
    bot.set(qn("w:color"), "000000")
    pbd.append(bot)
    p_pr.append(pbd)


def signatures(doc, left_label, right_label):
    p_par(doc, "", size=6, space_after=10)
    t = doc.add_table(rows=1, cols=2)
    bd = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "nil")
        bd.append(el)
    t._tbl.tblPr.append(bd)
    width(t, [9.0, 8.6])
    for idx, label in enumerate((left_label, right_label)):
        cell = t.rows[0].cells[idx]
        par = cell.paragraphs[0]
        par.paragraph_format.space_after = Pt(0)
        run = par.add_run(label)
        run.font.size = Pt(9.5)
        run.font.name = FONT
        line = cell.add_paragraph()
        line.paragraph_format.space_before = Pt(14)
        run = line.add_run("_________________________ / _________________")
        run.font.size = Pt(9.5)
        run.font.name = FONT


# --------------------------------------------------------- документ 1 ---
def build_journal(path):
    doc = base_doc()
    doc_head(
        doc,
        "Журнал кроссовой",
        "Объект «Северный» · кроссовая К-2 · стойка ШТК-2",
        ["Форма ЖК-2", "Ведётся по ходу работ", "Листов: ___"],
    )

    p_par(
        doc,
        "Одно и то же имя — на панели, на бирке кабеля и в этом журнале. Запись делается сразу "
        "после заделки и проверки порта, а не «в конце, если останется время». Порт без маркировки "
        "считается незаделанным при приёмке.",
        size=10,
    )
    p_par(
        doc,
        "Заполняет документовед бригады. Проверяет и подписывает мастер производственного обучения.",
        size=10,
        color=MUTED,
        italic=True,
    )

    h_par(doc, "1. Линии панели", size=11.5, space_before=8, space_after=4)
    rows = 24
    headers = ["Порт", "Рабочее место", "Кабель / бирка", "Порт SW", "Тест", "Примечание"]
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    borders(t)
    cell_margins(t)
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    no_split(t.rows[0], header=True)
    for n in range(1, rows + 1):
        tr = t.add_row()
        no_split(tr)
        set_row_height(tr, 0.62)
        cell_text(tr.cells[0], f"{n:02d}", size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        for c in range(1, len(headers)):
            cell_text(tr.cells[c], "", size=10)
    width(t, [1.4, 4.6, 3.0, 2.0, 1.8, 4.8])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "2. Дефекты, найденные в чужой работе", size=11.5, space_before=6, space_after=4)
    t2 = doc.add_table(rows=1, cols=4)
    t2.style = "Table Grid"
    borders(t2)
    cell_margins(t2)
    for i, h in enumerate(["Порт / линия", "Что обнаружено", "Показания тестера", "Кому сообщено"]):
        cell = t2.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    no_split(t2.rows[0], header=True)
    for _ in range(4):
        tr = t2.add_row()
        no_split(tr)
        set_row_height(tr, 0.85)
        for c in range(4):
            cell_text(tr.cells[c], "", size=10)
    width(t2, [3.2, 7.0, 4.2, 3.2])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "3. Отметка о сдаче смены", size=11.5, space_before=6, space_after=4)
    t3 = doc.add_table(rows=1, cols=3)
    t3.style = "Table Grid"
    borders(t3)
    cell_margins(t3)
    for i, h in enumerate(["Портов заделано", "Портов проверено тестером", "Незакрытые этапы переданы"]):
        cell = t3.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    tr = t3.add_row()
    set_row_height(tr, 1.0)
    for c in range(3):
        cell_text(tr.cells[c], "", size=10)
    width(t3, [5.8, 5.8, 5.8])

    signatures(doc, "Сдал (документовед бригады)", "Принял (мастер п/о)")
    doc.save(path)
    return path


# --------------------------------------------------------- документ 2 ---
STAGES = [
    ("01", "Допуск и ограждение зоны", "заказчик предупреждён, окно работ названо; коврик и ограждение; инструмент разложен"),
    ("02", "Комплектность панели и крепежа", "24 порта, два ушка 19″, четыре винта М6, органайзер, бирки, вставки; панель без трещин"),
    ("03", "Установка панели, горизонталь", "четыре винта затянуты, уровень выставлен, отступ 1U от активного оборудования, ввод к органайзеру"),
    ("04", "Завод кабелей, фиксация пучка", "радиус изгиба ≥ 4 диаметров, оболочка не передавлена, стяжки без металлического сердечника"),
    ("05", "Зачистка и расплетение", "оболочка 2–2,5 см, жилы целы, свивка сохранена, расплетение ≤ 13 мм"),
    ("06", "Заделка в IDC по строке B", "восемь жил по строке B, заделка «до щелчка», излишки срезаны, соседние жилы не задеты"),
    ("07", "Маркировка и журнал", "панель = бирка = журнал: порт → рабочее место → порт коммутатора"),
    ("08", "Тест и сдача мастеру", "прогон по восьми портам, результат записан, дефекты в списке, работа принята"),
]

ERRORS = [
    ("Смешан стандарт A/B на разных концах линии", "перекрёст 3-6, падение до 100 Мбит/с, «иногда работает»"),
    ("Расплетение пары 3–4 см", "рост NEXT и обратных потерь, Cat 6A не держит 10G"),
    ("Перетянутая стяжка, оболочка продавлена", "меняется геометрия пары, жила надламывается"),
    ("Панель на двух винтах, перекос", "натяг патч-кордов, отказ порта, панель выворачивает"),
    ("Нет маркировки или расходится с журналом", "порт не найти, работу начинают заново"),
]

SELF_CHECK = [
    "Панель закреплена четырьмя винтами, качания нет, горизонталь выставлена.",
    "Отступ от соседнего оборудования не менее 1U, доступ к портам свободен.",
    "Пучок уложен в органайзере, стяжки не передавливают оболочку, радиус изгиба соблюдён.",
    "Оболочка снята на 2–2,5 см, расплетение не больше 13 мм, жилы целы.",
    "Все восемь портов заделаны по строке B, излишки срезаны заподлицо.",
    "Маркировка на панели, на бирках и в журнале совпадает.",
    "Все восемь портов проверены тестером, результаты записаны.",
]


def build_operation_card(path):
    doc = base_doc()
    doc_head(
        doc,
        "Операционная карта · восемь этапов",
        "Приложение к заявке PP-314 · монтаж коммутационной (патч-)панели",
        ["Форма ОК-8", "На одну бригаду", "Этапов: 8"],
    )

    p_par(
        doc,
        "Этап закрывается только после проверки по строке «контроль». Отметку ставит исполнитель, "
        "подтверждает ответственный за качество или мастер. Незакрытый этап передаётся следующей "
        "бригаде вместе с инструментом и журналом.",
        size=10,
    )

    h_par(doc, "1. Этапы работы", size=11.5, space_before=8, space_after=4)
    t = doc.add_table(rows=1, cols=4)
    t.style = "Table Grid"
    borders(t)
    cell_margins(t)
    for i, h in enumerate(["№", "Этап", "Контроль — по чему закрываем", "Отметка"]):
        cell = t.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    no_split(t.rows[0], header=True)
    for num, name, ctrl in STAGES:
        tr = t.add_row()
        no_split(tr)
        set_row_height(tr, 0.95)
        cell_text(tr.cells[0], num, size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        cell_text(tr.cells[1], name, size=10, bold=True)
        cell_text(tr.cells[2], ctrl, size=9.5)
        cell_text(tr.cells[3], "", size=10)
    width(t, [1.2, 5.2, 8.4, 1.8])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "2. Норматив времени", size=11.5, space_before=6, space_after=4)
    t2 = doc.add_table(rows=1, cols=3)
    t2.style = "Table Grid"
    borders(t2)
    cell_margins(t2)
    for i, h in enumerate(["Операция", "Норматив", "Факт (заполняет исполнитель)"]):
        cell = t2.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for op, norm in (
        ("Крепёж панели и выставление горизонтали", "4–5 минут"),
        ("Первый порт (с показом мастера)", "6–8 минут"),
        ("Каждый следующий порт", "4–5 минут"),
        ("Укладка пучка и маркировка восьми линий", "8–10 минут"),
        ("Тест восьми портов и запись результатов", "5–6 минут"),
    ):
        tr = t2.add_row()
        no_split(tr)
        set_row_height(tr, 0.6)
        cell_text(tr.cells[0], op, size=10)
        cell_text(tr.cells[1], norm, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
        cell_text(tr.cells[2], "", size=10)
    width(t2, [9.6, 3.6, 4.6])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "3. Типичные ошибки — что проверяем отдельно", size=11.5, space_before=6, space_after=4)
    t3 = doc.add_table(rows=1, cols=2)
    t3.style = "Table Grid"
    borders(t3)
    cell_margins(t3)
    for i, h in enumerate(["Ошибка", "Чем заканчивается"]):
        cell = t3.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for err, effect in ERRORS:
        tr = t3.add_row()
        no_split(tr)
        set_row_height(tr, 0.62)
        cell_text(tr.cells[0], err, size=10)
        cell_text(tr.cells[1], effect, size=9.5)
    width(t3, [8.4, 9.4])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "4. Самоконтроль перед приёмкой", size=11.5, space_before=6, space_after=4)
    t4 = doc.add_table(rows=1, cols=3)
    t4.style = "Table Grid"
    borders(t4)
    cell_margins(t4)
    for i, h in enumerate(["№", "Пункт проверки", "Да / Нет"]):
        cell = t4.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for i, item in enumerate(SELF_CHECK, 1):
        tr = t4.add_row()
        no_split(tr)
        set_row_height(tr, 0.6)
        cell_text(tr.cells[0], str(i), size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        cell_text(tr.cells[1], item, size=10)
        cell_text(tr.cells[2], "", size=10)
    width(t4, [1.2, 13.6, 3.0])

    signatures(doc, "Исполнитель (роль, ФИО)", "Мастер производственного обучения")
    p_par(doc, "Этап закрыт = проверено по строке «контроль».", size=9, color=MUTED, italic=True)
    doc.save(path)
    return path


# --------------------------------------------------------- документ 3 ---
def build_act(path, practical_scale=True):
    doc = base_doc()
    doc_head(
        doc,
        "Акт выполненных работ № PP-314",
        "Форма по образцу ГОСТ · монтаж коммутационной (патч-)панели",
        ["Форма АВР-314", "Экземпляр 1 из 2", "Листов: ___"],
    )

    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    borders(t)
    cell_margins(t, top=50, bottom=50)
    fields = [
        ("Организация-исполнитель", "ООО «СетьПолис», участок кабельных систем № 2"),
        ("Заказчик", "ООО «Контур-Логистика»"),
        ("Объект", OBJ),
        ("Основание", "Заявка PP-314 от «____» ____________ 20____ г., приоритет высокий"),
        ("Оборудование", "Коммутационная (патч-)панель 19″, 24 × RJ-45, ISO/IEC 11801, Cat 6A; кабель Cat 6A; органайзер, крепёж М6"),
        ("Место монтажа", "стойка 19″ / учебный стенд / монтажный макет (нужное подчеркнуть)"),
        ("Стандарт", "TIA/EIA-568B, единый для всей панели"),
        ("Исполнитель", "ФИО ____________________________ · группа __________ · роль ____________________"),
        ("Дата работ", "«____» ____________ 20____ г. · время смены ____________"),
    ]
    for key, value in fields:
        tr = t.add_row()
        no_split(tr)
        set_row_height(tr, 0.62)
        kc, vc = tr.cells
        cell_text(kc, key, size=9.5, bold=True)
        shade(kc)
        cell_text(vc, value, size=9.5)
    width(t, [4.6, 13.2])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "1. Состав выполненных работ", size=11.5, space_before=6, space_after=4)
    works = [
        ("1.1", "Подготовка рабочего места, допуск по охране труда, проверка комплектности панели и крепежа"),
        ("1.2", "Монтаж панели на место установки: четыре винта М6, горизонталь, отступ 1U от активного оборудования"),
        ("1.3", "Кабельный менеджмент: органайзер, пучок без перетяжки, радиус изгиба не менее четырёх диаметров"),
        ("1.4", "Заделка восьми портов по T568B: оболочка 2–2,5 см, расплетение ≤ 13 мм, заделка «до щелчка»"),
        ("1.5", "Маркировка линий, заполнение кросс-плана и журнала кроссовой"),
        ("1.6", "Тестирование линий, фиксация результатов по каждому порту, устранение выявленных дефектов"),
    ]
    t2 = doc.add_table(rows=1, cols=3)
    t2.style = "Table Grid"
    borders(t2)
    cell_margins(t2)
    for i, h in enumerate(["№", "Наименование работ", "Отметка о выполнении"]):
        cell = t2.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for num, work in works:
        tr = t2.add_row()
        no_split(tr)
        set_row_height(tr, 0.75)
        cell_text(tr.cells[0], num, size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        cell_text(tr.cells[1], work, size=9.5)
        cell_text(tr.cells[2], "", size=10)
    width(t2, [1.2, 14.2, 2.4])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "2. Результаты измерений по портам", size=11.5, space_before=6, space_after=4)
    t3 = doc.add_table(rows=1, cols=5)
    t3.style = "Table Grid"
    borders(t3)
    cell_margins(t3)
    for i, h in enumerate(["Порт", "Рабочее место", "Порт коммутатора", "Тест (PASS / FAIL)", "Примечание"]):
        cell = t3.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    no_split(t3.rows[0], header=True)
    for n in range(1, 9):
        tr = t3.add_row()
        no_split(tr)
        set_row_height(tr, 0.62)
        cell_text(tr.cells[0], f"{n:02d}", size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        for c in range(1, 5):
            cell_text(tr.cells[c], "", size=10)
    width(t3, [1.4, 5.0, 3.4, 3.6, 4.4])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "3. Выявленные дефекты и отклонения", size=11.5, space_before=6, space_after=4)
    t4 = doc.add_table(rows=1, cols=2)
    t4.style = "Table Grid"
    borders(t4)
    cell_margins(t4)
    for i, h in enumerate(["Описание дефекта", "Устранён / передан отдельной заявкой"]):
        cell = t4.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for _ in range(3):
        tr = t4.add_row()
        no_split(tr)
        set_row_height(tr, 0.85)
        cell_text(tr.cells[0], "", size=10)
        cell_text(tr.cells[1], "", size=10)
    width(t4, [11.0, 6.8])
    p_par(doc, "", size=6, space_after=2)

    h_par(doc, "4. Оценка выполненных работ", size=11.5, space_before=6, space_after=4)
    if practical_scale:
        rows = [
            ("Установка панели на место монтажа", "15"),
            ("Заделка портов по T568B", "30"),
            ("Кабельный менеджмент", "15"),
            ("Маркировка", "10"),
            ("Работоспособность портов", "20"),
            ("Документация", "10"),
        ]
    else:
        rows = [
            ("Подключение и раскладка по T568B", "30"),
            ("Качество монтажа и кабельного менеджмента", "25"),
            ("Работоспособность портов (тест и приёмка)", "20"),
            ("Документация и отчёт", "15"),
            ("Ответы на контрольные вопросы", "10"),
        ]
    t5 = doc.add_table(rows=1, cols=3)
    t5.style = "Table Grid"
    borders(t5)
    cell_margins(t5)
    for i, h in enumerate(["Критерий", "Максимум", "Набрано"]):
        cell = t5.rows[0].cells[i]
        cell_text(cell, h, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(cell)
    for crit, mx in rows:
        tr = t5.add_row()
        no_split(tr)
        set_row_height(tr, 0.58)
        cell_text(tr.cells[0], crit, size=10)
        cell_text(tr.cells[1], mx, size=10, align=WD_ALIGN_PARAGRAPH.CENTER, mono=True)
        cell_text(tr.cells[2], "", size=10)
    tr = t5.add_row()
    no_split(tr)
    for c, txt in enumerate(["Итого", "100", ""]):
        cell = tr.cells[c]
        cell_text(cell, txt, size=10, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER if c else WD_ALIGN_PARAGRAPH.LEFT)
        shade(cell)
    width(t5, [12.4, 2.6, 2.8])
    p_par(doc, "Оценка: 90–100 — отлично · 75–89 — хорошо · 60–74 — удовлетворительно · менее 60 — неудовлетворительно.",
          size=9.5, color=MUTED)

    h_par(doc, "5. Вывод", size=11.5, space_before=6, space_after=4)
    t6 = doc.add_table(rows=1, cols=1)
    t6.style = "Table Grid"
    borders(t6)
    cell_margins(t6)
    set_row_height(t6.rows[0], 1.9)
    cell_text(t6.rows[0].cells[0], "", size=10)
    width(t6, [17.8])
    p_par(doc, "Формулировки — только факты и цифры, без «примерно» и «вроде».", size=9, color=MUTED, italic=True)

    signatures(doc, "Работы сдал (исполнитель)", "Работы принял (мастер п/о)")
    doc.save(path)
    return path


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    made = [
        build_journal(os.path.join(outdir, "journal-krossovoy.docx")),
        build_operation_card(os.path.join(outdir, "operation-card.docx")),
        build_act(os.path.join(outdir, "act-gost.docx")),
    ]
    for path in made:
        print("✓ " + path + " (" + str(os.path.getsize(path) // 1024) + " КБ)")
    return made


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "materials/patch-panel"
    main(target)
