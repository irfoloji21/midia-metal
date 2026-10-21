"""Render the exact manufacturer data into a printable reference and chart."""
import json
import shutil
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, String, Line
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'backend/database/content/dd7-product-detail.json').read_text(encoding='utf-8'))
OUT = ROOT / 'output/pdf'
REPORT = ROOT / 'reports/dd7-product'
ORIGINAL = REPORT / 'longwell-originals'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold', italic='Arial', boldItalic='ArialBold')
NAVY = colors.HexColor('#10275c')
ORANGE = colors.HexColor('#c45117')
GREY = colors.HexColor('#526079')
LIGHT = colors.HexColor('#eff3f7')
STYLES = {
    'title': ParagraphStyle('title', fontName='ArialBold', fontSize=25, leading=29, textColor=NAVY, spaceAfter=12),
    'h2': ParagraphStyle('h2', fontName='ArialBold', fontSize=17, leading=22, textColor=NAVY, spaceAfter=12),
    'body': ParagraphStyle('body', fontName='Arial', fontSize=9.5, leading=14, textColor=GREY, spaceAfter=10),
    'small': ParagraphStyle('small', fontName='Arial', fontSize=8, leading=11.5, textColor=GREY, spaceAfter=9),
    'cell': ParagraphStyle('cell', fontName='Arial', fontSize=8.3, leading=11.4, textColor=GREY),
    'label': ParagraphStyle('label', fontName='ArialBold', fontSize=8.3, leading=11.4, textColor=NAVY),
}
def para(text, kind='body'):
    return Paragraph(text, STYLES[kind])

def clean(text):
    return escape(str(text).replace('–', '-').replace('—', '-').replace('‑', '-'))

def photo(file, max_w, max_h):
    obj = Image(str(ORIGINAL / file))
    scale = min(max_w / obj.imageWidth, max_h / obj.imageHeight)
    obj.drawWidth, obj.drawHeight = obj.imageWidth * scale, obj.imageHeight * scale
    return obj

def table(rows, widths, header=False):
    cells = [[para(clean(v), 'label' if i == 0 and header or j == 0 and not header else 'cell')
              for j, v in enumerate(row)] for i, row in enumerate(rows)]
    obj = Table(cells, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
    commands = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#dbe1e9')),
                ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]
    commands.append(('BACKGROUND', (0, 0), (-1, 0) if header else (0, -1), LIGHT))
    obj.setStyle(TableStyle(commands))
    return obj

# Use a standard chart implementation; connect only the published points.
chart = Drawing(500, 270)
plot = LinePlot()
plot.x, plot.y, plot.width, plot.height = 58, 48, 410, 176
plot.data = [[(r[0], r[index]) for r in DATA['performance']] for index in (1, 2)]
plot.xValueAxis.valueMin, plot.xValueAxis.valueMax, plot.xValueAxis.valueStep = 800, 1450, 100
plot.yValueAxis.valueMin, plot.yValueAxis.valueMax, plot.yValueAxis.valueStep = 0, 350, 50
for axis in (plot.xValueAxis, plot.yValueAxis):
    axis.labels.fontName = 'Arial'
    axis.labels.fontSize = 9
    axis.strokeColor = colors.HexColor('#a8b2c0')
plot.yValueAxis.visibleGrid = True
plot.yValueAxis.gridStrokeColor = colors.HexColor('#e4e8ed')
plot.lines[0].strokeColor, plot.lines[1].strokeColor = NAVY, ORANGE
plot.lines[0].strokeWidth, plot.lines[1].strokeWidth = 2, 2
from reportlab.graphics.widgets.markers import makeMarker
for i, colour in enumerate([NAVY, ORANGE]):
    plot.lines[i].symbol = makeMarker('FilledCircle', size=5, fillColor=colour, strokeColor=colour)
chart.add(plot)
chart.add(String(58, 250, 'Pressure (Pa)', fontName='ArialBold', fontSize=10, fillColor=NAVY))
chart.add(String(265, 12, 'Airflow (m³/h)', textAnchor='middle', fontName='Arial', fontSize=10, fillColor=GREY))
for x, colour, label in [(280, NAVY, 'Static pressure'), (395, ORANGE, 'Total pressure')]:
    chart.add(Line(x-20, 251, x-5, 251, strokeColor=colour, strokeWidth=2))
    chart.add(String(x, 248, label, fontName='Arial', fontSize=8.5, fillColor=GREY))
renderSVG.drawToFile(chart, str(REPORT / 'performance.svg'))

width = A4[0] - 88
story = [para('LONGWELL<br/>DD7-5 EC Centrifugal Fan', 'title'),
         para('LWDD7-5-EC  |  PRODUCT DATA SUMMARY', 'small')]
intro = Table([[para('A direct-drive centrifugal blower with a 200 W EC motor and 0-10 V / PWM speed control. Use the model code, dimension drawing and operating-point table together when selecting the fan.<br/><br/><b>220 V / 50 Hz</b><br/><b>Up to 1,400 m³/h at 0 Pa static pressure</b>'), photo('front.jpg', 155, 145)]], colWidths=[width-165, 165])
intro.setStyle(TableStyle([('VALIGN', (0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0)]))
story.extend([intro, Spacer(1, 15), para('Electrical &amp; operating specifications', 'h2')])
specs = list(DATA['specifications'].items())
story.append(table(specs[3:19], [175, width-175]))
story.extend([PageBreak(), para('Dimensions &amp; mounting', 'title'),
              para('LWDD7-5-EC  |  All drawing dimensions in millimetres', 'small'),
              photo('dimensions-original.jpg', width, 285), Spacer(1, 20),
              table(specs[19:], [175, width-175]), Spacer(1, 20),
              para('Before specifying the installation', 'h2'),
              para('Check the available space, inlet clearance, outlet connection, mounting points and access for service. The flange size is not the clear air opening. The width (283) is a reference dimension as shown on the original drawing.'),
              para('Obtain model-specific wiring and installation instructions before connection. Confirm controller compatibility, accessories and suitability for the air being moved. The published page does not provide current, net weight, temperature limits or terminal assignments.'),
              PageBreak(), para('Performance reference', 'title'),
              para('Nine operating points published by LONGWELL for LWDD7-5-EC.', 'body'),
              chart, Spacer(1, 8)])
headers = ['Airflow\n(m³/h)', 'Static pressure\n(Pa)', 'Total pressure\n(Pa)', 'Speed\n(rpm)', 'Noise\n(dB(A))']
headers = [h.replace('\n', ' ') for h in headers]
rows = [[str(v) if i != 4 else f'{v:.1f}' for i,v in enumerate(r)] for r in DATA['performance']]
story.extend([table([headers] + rows, [101,105,105,95,width-406], header=True), Spacer(1, 13),
              para('Lines connect the published points and do not represent additional tests. The test speeds vary from 1,200 to 1,450 rpm; the catalogue reference is 1,440 ± 10 rpm. At 1,400 m³/h, static pressure is 0 Pa and total pressure is 65 Pa. Noise measurement conditions are not stated.', 'small'),
              para(f'<b>Source:</b> <link href="{DATA["source_url"]}" color="#a63c09">LONGWELL manufacturer product page</link>, reviewed 20 October 2026. Original product photographs and dimension drawing: LONGWELL. Chart redrawn from the published numerical table.', 'small'),
              para('Prepared by Midia M Metal as a reference summary, not an installation manual. Confirm availability, package contents, delivery and applicable warranty separately. Manufacturer ratings are not independent test results or a seller performance guarantee.', 'small')])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#dbe1e9'))
    canvas.line(44, 40, A4[0]-44, 40)
    canvas.setFont('Arial', 8)
    canvas.setFillColor(GREY)
    canvas.drawString(44, 25, 'MIDIA M METAL  |  LWDD7-5-EC  |  20 OCT 2026')
    canvas.drawRightString(A4[0]-44, 25, str(doc.page))
    canvas.restoreState()

final = OUT / 'longwell-lwdd7-5-ec-datasheet.pdf'
doc = SimpleDocTemplate(str(final), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=38, bottomMargin=54,
                        title='LONGWELL LWDD7-5-EC - Product Data Summary', author='Midia M Metal')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(final)
assert len(reader.pages) == 3, f'Expected 3 pages, got {len(reader.pages)}'
assert '1,400' in ''.join(p.extract_text() for p in reader.pages)
pdf = pdfium.PdfDocument(str(final))
for index, page in enumerate(pdf):
    bitmap = page.render(scale=1.5)
    bitmap.to_pil().save(REPORT / f'datasheet-page-{index+1}.png')
for base in [ROOT / 'public/documents', ROOT / 'backend/public/documents']:
    base.mkdir(parents=True, exist_ok=True)
    shutil.copy2(final, base / final.name)
print(json.dumps({'pdf':str(final), 'pages':len(reader.pages), 'bytes':final.stat().st_size}))
