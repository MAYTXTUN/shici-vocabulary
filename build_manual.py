from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / '拾词使用教程手册.pdf'
pdfmetrics.registerFont(TTFont('YaHei', r'C:\Windows\Fonts\msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('YaHeiBold', r'C:\Windows\Fonts\msyhbd.ttc', subfontIndex=0))
pdfmetrics.registerFontFamily('YaHei', normal='YaHei', bold='YaHeiBold', italic='YaHei', boldItalic='YaHeiBold')
GREEN = colors.HexColor('#17675D')
INK = colors.HexColor('#293D35')
MUTED = colors.HexColor('#6D7F72')
LINE = colors.HexColor('#DEE7DB')
PALE = colors.HexColor('#F0F5E9')
WIDTH, HEIGHT = A4
CONTENT = WIDTH - 92
styles = {
    'body': ParagraphStyle('body', fontName='YaHei', fontSize=10, leading=17, textColor=INK, spaceAfter=8, wordWrap='CJK'),
    'small': ParagraphStyle('small', fontName='YaHei', fontSize=8.3, leading=14, textColor=MUTED, wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='YaHeiBold', fontSize=24, leading=33, textColor=INK, spaceAfter=11, wordWrap='CJK'),
    'h2': ParagraphStyle('h2', fontName='YaHeiBold', fontSize=13, leading=20, textColor=GREEN, spaceBefore=14, spaceAfter=8, wordWrap='CJK'),
    'step': ParagraphStyle('step', fontName='YaHei', fontSize=10, leading=18, textColor=INK, spaceAfter=9, wordWrap='CJK'),
    'table': ParagraphStyle('table', fontName='YaHei', fontSize=9, leading=15, textColor=INK, wordWrap='CJK'),
    'white': ParagraphStyle('white', fontName='YaHeiBold', fontSize=9, leading=15, textColor=colors.white, wordWrap='CJK'),
    'cover': ParagraphStyle('cover', fontName='YaHeiBold', fontSize=36, leading=49, textColor=GREEN, spaceAfter=16, wordWrap='CJK'),
    'code': ParagraphStyle('code', fontName='YaHei', fontSize=10, leading=21, textColor=GREEN, wordWrap='CJK'),
}
story = []

def p(text, style='body'):
    return Paragraph(text, styles[style])

def add(text, style='body'):
    story.append(p(text, style))

def heading(number, title, subtitle):
    add(f'使用教程 / {number:02d}', 'small')
    story.append(Spacer(1, 9))
    add(title, 'h1')
    add(subtitle)
    story.append(Spacer(1, 4))

def sub(title):
    add(title, 'h2')

def step(number, title, detail):
    add(f'<font color="#17675D"><b>{number:02d}</b></font>  <b>{title}</b><br/>{detail}', 'step')

def box(title, body):
    content = [[p(title, 'h2')], [p(body)]]
    table = Table(content, colWidths=[CONTENT], hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1),PALE), ('BOX',(0,0),(-1,-1),.6,LINE),
        ('LEFTPADDING',(0,0),(-1,-1),15), ('RIGHTPADDING',(0,0),(-1,-1),15),
        ('TOPPADDING',(0,0),(-1,0),7), ('BOTTOMPADDING',(0,0),(-1,0),0),
        ('TOPPADDING',(0,1),(-1,1),2), ('BOTTOMPADDING',(0,1),(-1,1),10),
    ]))
    story.extend([Spacer(1,9), table, Spacer(1,10)])

def table(headers, rows, widths):
    data = [[p(escape(str(cell)), 'white') for cell in headers]]
    data += [[p(escape(str(cell)), 'table') for cell in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),GREEN), ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),11), ('RIGHTPADDING',(0,0),(-1,-1),11),
        ('TOPPADDING',(0,0),(-1,-1),9), ('BOTTOMPADDING',(0,0),(-1,-1),9),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, colors.HexColor('#F7F9F3')]),
        ('LINEBELOW',(0,1),(-1,-1),.4,LINE),
    ]))
    story.extend([t, Spacer(1,10)])

def page():
    story.append(PageBreak())

def link(url, label=None):
    return f'<link href="{escape(url, quote=True)}" color="#17675D"><u>{escape(label or url)}</u></link>'

# Page 1: quick start and a useful reading map, rather than a blank cover.
add('SHICI / USER GUIDE', 'small')
story.append(Spacer(1, 20))
add('拾词<br/>使用教程手册', 'cover')
add('把自己的单词，按自己的节奏记牢。')
add('适用：Windows 电脑 + 安卓手机浏览器<br/>整理日期：2026 年 10 月 2 日 · 对应当前版本', 'small')
story.append(Spacer(1, 14))
box('第一次使用，先完成这 4 步',
    '1. 双击软件文件夹中的 <b>启动拾词.cmd</b>，保持启动窗口打开。<br/>'
    '2. 在电脑 Chrome 或 Edge 浏览器中打开 ' + link('http://localhost:4173') + '。<br/>'
    '3. 在“我的词库”新建词库，导入自己的英文、词性和中文释义。<br/>'
    '4. 停用示例词库，再进入“今日学习”开始正式任务。')
sub('按需要查阅')
table(['想完成什么', '翻到哪页'], [
    ['第一次导入 / 从 Excel 复制 / 以后追加单词', '第 2 页'],
    ['每天怎么背 / 薄弱词加练 / 自动发音', '第 3 页'],
    ['让安卓手机连接并打开软件', '第 4 页'],
    ['备份词库 / 把电脑进度迁移到手机', '第 5 页'],
    ['打不开、没有声音、导入重复等常见问题', '第 6 页'],
], [CONTENT - 110, 110])
add('<b>先记住：</b>正式复习按日历天安排；当天加练不改变困难分数和下次正式复习日期。电脑和手机的数据各自保存，目前没有自动同步。', 'small')

# Page 2: import, append, optional fields, and duplicate handling.
page()
heading(1, '把你的单词加进来', '最少有英文和中文释义就可以。建议带上词性，按原来的顺序导入。')
step(1, '新建并选择词库', '打开“我的词库” → “新建词库”，输入名称，例如“考研单词书”“考试生词”“笔记生词”。点击“导入单词”，在“存入词库”中选择目标词库。')
step(2, '粘贴文字，或选择文件', '每行一个词。可选择 UTF-8 编码的 CSV、TSV、TXT 文件。以下三行可以直接粘贴：')
code = Table([[p('abandon v. 放弃；抛弃<br/>acquire v. 获得；习得<br/>adapt v. 适应；改编', 'code')]], colWidths=[CONTENT])
code.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE), ('LEFTPADDING',(0,0),(-1,-1),15), ('TOPPADDING',(0,0),(-1,-1),10), ('BOTTOMPADDING',(0,0),(-1,-1),10)]))
story.extend([code, Spacer(1,12)])
step(3, '检查预览，再确认导入', '点击“检查并预览”，核对英文、词性、中文对应是否正确；无法识别的行不会导入。确认后点“确认导入”。预览只展示前 10 条，确认会导入全部有效内容。')
step(4, '把自己的词库加入计划', '保持自己的词库“加入计划”开关开启；关闭“先试一试 · 示例词库”的开关。回到“今日学习”，软件会自动安排新词。')
sub('单词已经在 Excel 里怎么办？')
add('复制“英文、词性、中文释义”三列，直接粘贴到导入框；只有“英文、中文”两列也支持。当前不能直接上传 .xlsx 文件，请复制单元格，或另存为 CSV UTF-8。')
add('如列顺序不同，或有更多资料，请在第一行写表头：英文、词性、中文释义、音标、例句、例句翻译、搭配、记忆方法、近义词、考试年份。只导入你已有的内容，不必补齐每一列。', 'small')
sub('以后继续追加：沿用同一个入口')
add('再次点“导入单词”，选择原词库，粘贴新内容并确认。新词接在原词后面，已有学习记录保留。同一词库内重复的英文会跳过，不会覆盖旧释义或旧记忆方法；不同词库可以分别收录同一个词。')
add('音标不是发音的前提：没有音标，也可以根据英文朗读。缺少的音标、例句不会凭空补全。', 'small')

# Page 3: actual session semantics and score rules.
page()
heading(2, '每天怎么背、怎么复习', '早上完成正式任务；下午和晚上独立加练薄弱词。')
step(1, '进入“今日学习”', '可点“开始今日学习”完成到期复习和新词，也可分别点“学新词”“去复习”。启用的词库按导入的总体顺序安排新词；到期复习优先显示困难分数高的词。')
step(2, '先回忆，再选择熟悉程度', '卡片先显示英文。选择“不会”“模糊”或“认识”后，显示中文释义、词性与记忆方法；看完点“记好了，继续”。第一遍就认识的词完成本轮。')
step(3, '不会和模糊的词，继续循环', '第一遍结束后，薄弱词再次以英文卡片出现。回忆轮中认识的词，再进入“中文选英文”验证；选错或仍不会，就返回卡片重新练，直到通过。不足 4 个不同选项时改为输入英文。')
step(4, '空闲时进入“薄弱词”', '筛选“今天的薄弱词”或“全部薄弱词”，点击“开始加练”或单词旁的“练一下”。同分按原顺序排列；当天卡住的词，即使后来通过，也保留在当天列表中。')
table(['正式第一遍的回答', '困难分数怎么变'], [
    ['不会', '0 分变 1 分；之后每次再加 2，形成 1、3、5……'],
    ['模糊', '加 1 分，也进入当天循环练习'],
    ['认识', '默认减半并向下取整；设置中也可选择减 3，最低为 0'],
    ['当天重复 / 四选一选错', '只记录当天练习次数，不再改变分数或日期'],
], [145, CONTENT - 145])
sub('发音和记忆方法')
add('英文卡片出现时自动读一次；中文选英文在作答前不读，公布答案后读正确单词。可点“听发音 / 再听一次”重播，在“学习设置”关闭自动朗读。记忆方法位于答案区，包含构词拆解或情境联想；未收录的词使用自带记忆方法或释义联想提示。')
add('<b>计划说明：</b>默认每天新词数 = 启用词库总词数 ÷ 20，向上取整；例如 1,000 词每天约 50 词。20 天是新词学习周期，复习仍会继续。正式复习默认为首次学习后的第 1、2、4、7、15、30 天，之后每 30 天继续。', 'small')
add('退出或刷新后可继续剩余练习。跨日继续旧队列按独立加练处理，新到期的正式任务仍需完成。', 'small')

# Page 4: LAN use and the important current limitation.
page()
heading(3, '安卓手机连接使用', '当前是手机浏览器版。手机打开界面，需要电脑提供本地服务。')
step(1, '在电脑启动拾词', '双击“启动拾词.cmd”，等待窗口显示电脑地址和手机地址。保持这个窗口打开；电脑需要开机，不能进入休眠。')
step(2, '手机和电脑连接同一个 Wi-Fi', '手机不要只使用移动数据；电脑与手机应在可互相访问的同一局域网。')
step(3, '在手机 Chrome 输入手机地址', '使用启动窗口显示的地址，格式为 http://电脑局域网IP:4173。例如 http://192.168.1.181:4173 只是本次启动曾显示的地址；实际以你启动窗口里的地址为准。')
box('不要在手机输入 localhost', '电脑的 http://localhost:4173 只指向电脑自己。手机输入 localhost 会指向手机自己，所以必须使用电脑的局域网 IP 地址。')
step(4, '处理首次连接提示', '如 Windows 防火墙提示 Node.js 的网络访问，在自己信任的家庭网络中允许“专用网络”访问。若仍打不开，先确认电脑浏览器能打开拾词，再核对 Wi-Fi 和手机地址。')
sub('下次怎么打开？')
add('电脑重新启动拾词后，手机访问窗口里显示的地址即可。可以把地址加入手机浏览器书签；如果电脑 IP 变化，更新书签。关闭电脑或启动窗口后，当前局域网方式就不能继续提供页面。')
sub('手机打开后，为什么看不到电脑词库？')
add('这是正常的：学习数据存于各自设备的浏览器，不存于电脑服务端。首次在手机打开，会看到示例词库。请按第 5 页用“完整备份”迁移，或直接在手机端导入自己的单词。')
box('关于安装与离线使用', '当前没有 APK 安装包。局域网 HTTP 地址不支持安装离线应用；以后部署到 HTTPS 地址后，可在安卓 Chrome 中安装到主屏幕，成功缓存后离线访问。当前使用以“电脑保持运行、同一 Wi-Fi”为准。')
add('手机与电脑各自记录日期，请保持设备的时间、日期和时区正确。', 'small')

# Page 5: backup formats, migration, and safe subsequent additions.
page()
heading(4, '备份、迁移与更换设备', '带走词库和学习记录，请选择完整 JSON 备份。')
table(['导出方式', '带走什么', '适合什么用途'], [
    ['完整备份（JSON）', '全部词库、学习进度、设置、当前练习队列', '迁移设备、恢复记录、保存副本'],
    ['词库 / 薄弱词（CSV）', '单词、释义及已有可选资料；没有学习进度', '整理单词、查看薄弱词、再导入内容'],
], [115, 212, CONTENT - 327])
sub('把电脑上的词库搬到手机')
step(1, '电脑导出完整备份', '进入“学习设置”，点击“导出完整备份”。文件通常名为“拾词-完整备份-日期.json”，保存在浏览器的下载位置。')
step(2, '把 JSON 文件传给自己的手机', '使用你习惯的文件传输方式，把原文件完整传过去，不要改扩展名或手工修改内容。')
step(3, '手机恢复备份', '手机打开拾词 → “学习设置” → “恢复备份”，选择收到的 JSON 文件，核对数量后确认。完成后检查词库和学习进度。')
box('恢复会替换当前数据', '完整备份恢复是“替换”，不是合并。目标设备如果已有自己的学习记录，先导出一份备份保存；再恢复你决定作为最新版的那份数据。')
sub('以后主要用手机背，怎么继续加词？')
add('<b>最省事：</b>在手机端直接导入新词、继续学习，并定期导出完整备份。这样手机始终保留最新进度。')
add('如果必须在电脑整理并追加：先从手机导出最新备份 → 电脑恢复这份备份 → 电脑追加新词 → 电脑导出完整备份 → 手机恢复。这样可以把最新进度和新词一起带回手机。', 'small')
add('不要用较旧的电脑备份覆盖较新的手机进度。电脑和手机之间目前没有账号同步，也不会自动合并两个设备分别产生的记录。', 'small')
sub('什么情况下应该保存备份？')
add('导入一大批单词后、每周固定一次、更换设备或浏览器之前。关闭浏览器不会主动清空记录，但清理网站数据、更换浏览器或使用另一网址，可能看不到原来的本地数据。')

# Page 6: useful troubleshooting and a daily checklist.
page()
heading(5, '常见问题与每日速查', '遇到问题，先按下面几项检查。')
faqs = [
    ('电脑打不开页面', '先运行“启动拾词.cmd”，保持窗口打开，再访问 http://localhost:4173。如果提示未找到 Node.js，需要先安装 Node.js；当前电脑已具备运行环境。'),
    ('手机打不开页面', '确认电脑没有休眠、服务窗口仍开着、两台设备连同一 Wi-Fi。使用启动窗口里的手机地址，并检查 Windows 防火墙的专用网络访问。'),
    ('每天只出现 1 个新词', '示例词库只有 20 词，20 天计划自动分配为每天 1 词。导入自己的词库后会重新计算；也可在“学习设置”手动填写每日新词数，填 0 恢复自动分配。'),
    ('没有声音 / 自动发音没启动', '确认“自动朗读英文”已勾选，检查设备音量。先点一次“听发音”；若仍无声，检查设备是否有英文语音，或换到 Chrome / Edge。'),
    ('导入显示重复，或数量比粘贴少', '同一词库内重复英文会跳过；无法识别的行也不会导入。检查预览结果。文件乱码时，请另存为 UTF-8 后再导入。'),
    ('原来的词库或进度不见了', '先确认使用同一个设备、浏览器和访问地址。localhost 与局域网 IP 是不同地址，保存的数据可能各自独立。需要迁移时，用对应浏览器导出的完整备份恢复。'),
    ('新建词库或改名按钮没有弹框', '请在电脑 Chrome 或 Edge 中打开拾词再操作；部分内嵌浏览器不支持这类输入弹框。'),
]
for title, detail in faqs:
    story.append(KeepTogether([p(title, 'h2'), p(detail, 'small')]))
story.append(Spacer(1,8))
box('每天的 3 件事', '早上：完成新词与到期正式复习。<br/>下午或晚上：进入“薄弱词”独立加练。<br/>定期：从主要学习设备导出一份完整备份。')
add('手册根据当前软件功能编写。后续若增加 APK、账号同步或在线记忆方法生成，使用方式将相应更新。', 'small')

def chrome(c, doc):
    c.saveState()
    c.setFillColor(GREEN)
    c.roundRect(46, HEIGHT - 42, 22, 22, 5, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('YaHeiBold', 12)
    c.drawCentredString(57, HEIGHT - 35, '拾')
    c.setFillColor(INK)
    c.setFont('YaHeiBold', 10)
    c.drawString(78, HEIGHT - 34, '拾词 · 使用教程')
    c.setFillColor(MUTED)
    c.setFont('YaHei', 8)
    c.drawRightString(WIDTH - 46, HEIGHT - 34, '2026.10.02 / 当前版本')
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.line(46, 42, WIDTH - 46, 42)
    c.setFillColor(MUTED)
    c.setFont('YaHei', 8)
    c.drawString(46, 27, '按天复习 · 独立加练 · 保留自己的节奏')
    c.drawRightString(WIDTH - 46, 27, f'{doc.page} / 6')
    c.restoreState()

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=46, leftMargin=46, topMargin=66, bottomMargin=57,
    title='拾词使用教程手册', author='拾词', subject='词库导入、复习、安卓连接与备份迁移', pageCompression=1)
doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
print(OUTPUT)
