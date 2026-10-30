from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, PageBreak, Table, TableStyle, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
SCREEN_DIR = ROOT / 'docs' / 'screens'
OUT = ROOT / 'public' / 'BrandLens-Product-Guide.pdf'
SCREEN_DIR.mkdir(parents=True, exist_ok=True)
W, H = 1440, 900
FONT_DIR = Path('/usr/share/fonts/truetype/dejavu')
FONT_REG = ImageFont.truetype(str(FONT_DIR/'DejaVuSans.ttf'), 20)
FONT_BOLD = ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'), 20)
FONT_SMALL = ImageFont.truetype(str(FONT_DIR/'DejaVuSans.ttf'), 15)
FONT_SMALL_B = ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'), 15)
FONT_TINY = ImageFont.truetype(str(FONT_DIR/'DejaVuSans.ttf'), 12)
FONT_H1 = ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'), 31)
FONT_H2 = ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'), 23)

C = {
 'bg':'#F4F6F8','surface':'#FFFFFF','surface2':'#F7F8FA','line':'#E5E9EE','text':'#202A36','muted':'#74808D',
 'sidebar':'#FBFCFD','primary':'#5A6FD6','primary_soft':'#EDF0FF','teal':'#238B7A','teal_soft':'#E8F6F2',
 'coral':'#D66A56','coral_soft':'#FFF0EC','amber':'#BB8128','amber_soft':'#FFF6E8','dark':'#151E29','dark_surface':'#19222D'
}

def rr(d, box, radius=16, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def txt(d, xy, s, font=FONT_REG, fill=None):
    d.text(xy, s, font=font, fill=fill or C['text'])

def line(d, xy, fill=None, width=1):
    d.line(xy, fill=fill or C['line'], width=width)

def label(d, x, y, s):
    txt(d, (x,y), s.upper(), FONT_TINY, C['muted'])

def pill(d, x, y, s, bg, fg):
    w=d.textbbox((0,0),s,font=FONT_TINY)[2]+22
    rr(d,(x,y,x+w,y+28),14,bg)
    txt(d,(x+11,y+7),s,FONT_TINY,fg)
    return w

def wrap_lines(text, font, max_width, draw):
    words=text.split(); lines=[]; cur=''
    for word in words:
        cand=(cur+' '+word).strip()
        if draw.textbbox((0,0),cand,font=font)[2] <= max_width: cur=cand
        else:
            if cur: lines.append(cur)
            cur=word
    if cur: lines.append(cur)
    return lines

def draw_base(active='Overview', dark=False):
    bg = '#111720' if dark else C['bg']
    surface = C['dark_surface'] if dark else C['surface']
    sidebar = C['dark'] if dark else C['sidebar']
    textc = '#EDF2F7' if dark else C['text']
    muted = '#A1ADBB' if dark else C['muted']
    linec = '#2A3746' if dark else C['line']
    img=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(img)
    d.rectangle((0,0,260,H),fill=sidebar)
    line(d,(259,0,259,H),linec,2)
    rr(d,(24,27,64,67),12,'#5A6FD6')
    d.rectangle((34,44,41,59),fill='white');d.rectangle((45,35,52,59),fill='white');d.rectangle((56,41,61,59),fill='white')
    txt(d,(79,28),'brandlens',ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'),26),textc)
    txt(d,(80,58),'GOVERNANCE STUDIO',FONT_TINY,muted)
    rr(d,(18,95,242,164),13,'#202B38' if dark else '#F7F8FA',linec)
    rr(d,(29,110,67,148),10,'#403526' if dark else C['amber_soft'])
    txt(d,(40,119),'N',FONT_BOLD,'#E6BA72' if dark else C['amber'])
    txt(d,(80,111),'Northstar Demo',FONT_SMALL_B,textc)
    txt(d,(80,135),'Demo workspace',FONT_TINY,muted)
    navs=[('WORKSPACE',['Overview','New review','Review library','Brand knowledge','Asset library','Approval queue']),('GOVERNANCE',['Insights','Audit trail','Team & roles']),('',['Settings'])]
    yy=193
    for group,items in navs:
        if group: txt(d,(26,yy),group,FONT_TINY,muted); yy+=30
        for item in items:
            if item==active: rr(d,(14,yy-3,245,yy+42),9,'#293452' if dark else C['primary_soft'])
            col=('#A9B4FF' if dark else C['primary']) if item==active else muted
            txt(d,(30,yy+6),'◦',FONT_H2,col); txt(d,(58,yy+10),item,FONT_SMALL_B if item==active else FONT_SMALL,textc if item==active else muted)
            yy+=48
        yy+=17
    line(d,(20,770,240,770),linec)
    rr(d,(20,788,56,824),18,'#293452' if dark else C['primary_soft'])
    txt(d,(30,797),'G',FONT_SMALL_B,'#A9B4FF' if dark else C['primary'])
    txt(d,(68,790),'Guest user',FONT_SMALL_B,textc)
    txt(d,(68,813),'Local workspace',FONT_TINY,muted)
    # top bar
    d.rectangle((260,0,W,86),fill=surface)
    line(d,(260,85,W,85),linec,1)
    txt(d,(300,30),'Workspace   /',FONT_SMALL,muted)
    txt(d,(430,30),active,FONT_SMALL_B,textc)
    rr(d,(930,18,1213,66),12,'#202B38' if dark else C['surface2'],linec)
    txt(d,(950,32),'⌕   Search anything...',FONT_SMALL,muted)
    rr(d,(1230,18,1276,66),13,'#202B38' if dark else C['surface2'],linec)
    txt(d,(1243,31),'☼' if dark else '☾',FONT_H2,'#E6BA72' if dark else C['primary'])
    rr(d,(1290,18,1420,66),12,'#202B38' if dark else C['surface2'],linec)
    txt(d,(1305,33),'G  Guest',FONT_SMALL,textc)
    return img,d,surface,textc,muted,linec

def card(d, box, dark=False, fill=None):
    rr(d,box,15,fill or (C['dark_surface'] if dark else C['surface']), '#2A3746' if dark else C['line'])

def draw_screen(kind, title, active, dark=False):
    img,d,surface,textc,muted,linec=draw_base(active,dark)
    x=300; y=120
    txt(d,(x,y),title,FONT_H1,textc)
    captions={
      'overview':'A quick view of your team’s content governance work.',
      'review':'Check a draft before it reaches a public channel.',
      'knowledge':'Keep approved facts, words and tone guidance in one place.',
      'assets':'Find approved images and understand how they may be used.',
      'approvals':'Human reviewers make the final decisions.',
      'insights':'Learn from the patterns appearing in your reviews.',
      'settings':'Set up your workspace and personal preferences.'}
    txt(d,(x,y+48),captions[kind],FONT_SMALL,muted)
    if kind=='overview':
        for i,(v,l,cx,bg) in enumerate([('12','Total reviews',C['primary'], '#293452' if dark else C['primary_soft']),('7','Open findings',C['coral'],'#422D2D' if dark else C['coral_soft']),('18','Knowledge sources',C['teal'],'#1E3B39' if dark else C['teal_soft']),('84','Brand readiness',C['amber'],'#403526' if dark else C['amber_soft'])]):
            xx=x+i*276; card(d,(xx,215,xx+258,350),dark)
            txt(d,(xx+20,238),l,FONT_SMALL,muted);txt(d,(xx+20,273),v,ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'),42),textc)
            pill(d,xx+20,316,'WORKSPACE SIGNAL',bg,cx)
        card(d,(x,370,875,645),dark)
        txt(d,(x+24,393),'Keep every message true to your brand.',FONT_H2,textc)
        txt(d,(x+24,435),'Review copy against approved facts, terminology and tone rules.',FONT_SMALL,muted)
        txt(d,(x+24,463),'Understand why something was flagged, make the call,',FONT_SMALL,muted)
        txt(d,(x+24,491),'and keep a clear approval trail.',FONT_SMALL,muted)
        rr(d,(x+24,540,x+218,590),12,C['primary']);txt(d,(x+41,555),'＋  New review',FONT_SMALL_B,'white')
        rr(d,(x+230,540,x+430,590),12,'#293452' if dark else C['primary_soft']);txt(d,(x+248,555),'Manage knowledge',FONT_SMALL_B,'#A9B4FF' if dark else C['primary'])
        card(d,(900,370,1418,645),dark)
        txt(d,(925,393),'Recent activity',FONT_H2,textc)
        for i,(a,b) in enumerate([('Review submitted','Spring campaign · 10:42 AM'),('Knowledge updated','Support policy · Yesterday'),('Review approved','Product update · Monday')]):
            yy=450+i*57;rr(d,(926,yy,966,yy+38),11,'#293452' if dark else C['primary_soft']);txt(d,(939,yy+8),'↗',FONT_SMALL_B,'#A9B4FF' if dark else C['primary']);txt(d,(982,yy+1),a,FONT_SMALL_B,textc);txt(d,(982,yy+25),b,FONT_TINY,muted)
        card(d,(x,670,1418,850),dark)
        txt(d,(x+22,690),'Recent reviews',FONT_H2,textc)
        for i,(a,b,c) in enumerate([('Website launch announcement','Website','In review'),('Spring campaign social copy','Social','Approved'),('Customer support email','Email','Changes requested')]):
            yy=733+i*37;txt(d,(x+24,yy),a,FONT_SMALL,textc);txt(d,(x+620,yy),b,FONT_SMALL,muted);pill(d,x+760,yy-4,c,'#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
    elif kind=='review':
        card(d,(x,215,1040,850),dark)
        txt(d,(x+24,238),'Review setup',FONT_H2,textc)
        label(d,x+24,290,'Review title');rr(d,(x+24,315,x+690,365),9,'#202B38' if dark else C['surface2'],linec);txt(d,(x+40,332),'Website launch announcement',FONT_SMALL,muted)
        label(d,x+720,290,'Channel');rr(d,(x+720,315,x+1004,365),9,'#202B38' if dark else C['surface2'],linec);txt(d,(x+738,332),'Website  ▾',FONT_SMALL,muted)
        label(d,x+24,395,'Draft content');rr(d,(x+24,420,x+1004,690),10,'#202B38' if dark else C['surface2'],linec)
        for i,t in enumerate(['Welcome to our portal! Northstar Studio was founded in 2018.','We are the #1 platform and guarantee 100% results for every team.','Our support team is available Monday to Friday, 9:00 AM to 6:00 PM IST.']):
            txt(d,(x+44,450+i*54),t,FONT_SMALL,muted)
        pill(d,x+24,720,'50,000 CHARACTER LIMIT', '#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
        rr(d,(x+24,780,x+254,830),12,C['primary']);txt(d,(x+42,795),'Run brand preflight →',FONT_SMALL_B,'white')
        card(d,(1060,215,1418,850),dark)
        txt(d,(1084,240),'What gets checked?',FONT_H2,textc)
        checks=['Tone & voice','Terminology','Facts & freshness','Promotional claims','Visual consistency','Accessibility']
        for i,t in enumerate(checks):
            yy=300+i*70;rr(d,(1084,yy,1128,yy+42),12,'#293452' if dark else C['primary_soft']);txt(d,(1098,yy+11),'✓',FONT_SMALL_B,'#A9B4FF' if dark else C['primary']);txt(d,(1145,yy+10),t,FONT_SMALL_B,textc)
        txt(d,(1084,755),'The original copy is kept until',FONT_TINY,muted);txt(d,(1084,775),'you choose to apply a correction.',FONT_TINY,muted)
    elif kind=='knowledge':
        card(d,(x,215,1418,850),dark)
        txt(d,(x+24,238),'Approved knowledge library',FONT_H2,textc)
        rr(d,(x+24,280,x+360,325),10,'#202B38' if dark else C['surface2'],linec);txt(d,(x+42,294),'⌕  Search approved sources...',FONT_TINY,muted)
        pill(d,x+390,288,'ALL TYPES','#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
        pill(d,x+510,288,'ACTIVE', '#1E3B39' if dark else C['teal_soft'], '#63C7B4' if dark else C['teal'])
        items=[('FACT','Company founding year','Northstar Studio was founded in 2018.','Corporate fact sheet'),('GLOSSARY','Preferred product term','Use “workspace” instead of “portal”.','Messaging guide'),('TONE','Voice and tone','Clear, helpful, calm and confident.','Brand voice guide'),('GUIDELINE','Evidence before promotion','Performance and ranking claims need approved proof.','Claims policy')]
        for i,(typ,head,body,src) in enumerate(items):
            cx=x+24+(i%2)*548;cy=360+(i//2)*220
            card(d,(cx,cy,cx+520,cy+192),dark)
            pill(d,cx+18,cy+17,typ,'#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
            pill(d,cx+400,cy+17,'ACTIVE','#1E3B39' if dark else C['teal_soft'],'#63C7B4' if dark else C['teal'])
            txt(d,(cx+18,cy+65),head,FONT_H2,textc)
            for j,ln in enumerate(wrap_lines(body,FONT_SMALL,475,d)[:2]):txt(d,(cx+18,cy+107+j*26),ln,FONT_SMALL,muted)
            txt(d,(cx+18,cy+160),'Source: '+src,FONT_TINY,muted)
    elif kind=='assets':
        card(d,(x,215,1418,850),dark)
        txt(d,(x+24,238),'Approved brand assets',FONT_H2,textc)
        cards=[('PRIMARY LOGO','Wordmark · light background','#5A6FD6'),('CAMPAIGN IMAGE','Spring launch photograph','#238B7A'),('PRODUCT ICON','App icon · square','#BB8128')]
        for i,(tag,name,color) in enumerate(cards):
            xx=x+24+i*365; yy=300
            card(d,(xx,yy,xx+338,yy+390),dark)
            rr(d,(xx+18,yy+18,xx+320,yy+226),12,'#202B38' if dark else C['surface2'],linec)
            if i==0:
                rr(d,(xx+104,yy+77,xx+232,yy+166),18,color)
                txt(d,(xx+125,yy+99),'NORTH',FONT_H2,'white')
            elif i==1:
                for k in range(5):
                    rr(d,(xx+42+k*46,yy+68,xx+86+k*46,yy+182),18,['#A5B8A4','#B6C7C2','#D7B58B','#6D897A','#9DABC0'][k])
                txt(d,(xx+96,yy+115),'IMAGE',FONT_H2,'white')
            else:
                rr(d,(xx+120,yy+62,xx+218,yy+180),25,color);txt(d,(xx+148,yy+98),'B',FONT_H1,'white')
            pill(d,xx+18,yy+246,tag,'#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
            txt(d,(xx+18,yy+290),name,FONT_SMALL_B,textc)
            txt(d,(xx+18,yy+324),'Alt text and usage notes',FONT_TINY,muted)
            txt(d,(xx+18,yy+350),'Basic metadata check available',FONT_TINY,muted)
    elif kind=='approvals':
        card(d,(x,215,1418,850),dark)
        txt(d,(x+24,238),'Pending review decisions',FONT_H2,textc)
        items=[('Website launch announcement','Creator: Alex Morgan','3 findings · 2 high','In review'),('Customer support email','Creator: Alex Morgan','1 finding · 1 high','Changes requested'),('Spring campaign post','Creator: Alex Morgan','No open high findings','Ready for approval')]
        for i,(title,creator,findings,status) in enumerate(items):
            yy=300+i*168;card(d,(x+22,yy,1418-22,yy+142),dark)
            txt(d,(x+44,yy+22),title,FONT_H2,textc);txt(d,(x+44,yy+62),creator,FONT_TINY,muted);txt(d,(x+44,yy+96),findings,FONT_SMALL,muted)
            pill(d,1125,yy+26,status,'#293452' if dark else C['primary_soft'],'#A9B4FF' if dark else C['primary'])
            rr(d,(1130,yy+76,1368,yy+119),10,C['primary'] if i==2 else ('#422D2D' if dark else C['coral_soft']))
            txt(d,(1148,yy+89),'Review decision' if i==2 else 'Open review',FONT_TINY,'white' if i==2 else C['coral'])
    elif kind=='insights':
        for i,(value,lab,col) in enumerate([('42','Findings reviewed',C['primary']),('86%','Evidence-backed',C['teal']),('3','High-risk open',C['coral']),('18','Active knowledge',C['amber'])]):
            xx=x+i*276;card(d,(xx,215,xx+258,340),dark);txt(d,(xx+20,235),lab,FONT_SMALL,muted);txt(d,(xx+20,270),value,ImageFont.truetype(str(FONT_DIR/'DejaVuSans-Bold.ttf'),40),textc)
        card(d,(x,365,930,850),dark);txt(d,(x+24,390),'Issue distribution',FONT_H2,textc)
        names=['Tone & voice','Terminology','Facts & freshness','Promotional claims','Visual consistency','Accessibility'];vals=[7,12,9,15,3,6]
        for i,(n,v) in enumerate(zip(names,vals)):
            yy=460+i*55;txt(d,(x+24,yy),n,FONT_SMALL,muted);rr(d,(x+215,yy+2,x+535,yy+25),10,'#26364D' if dark else '#EDF1F5');rr(d,(x+215,yy+2,x+215+320*v/15,yy+25),10,'#92A0F2' if dark else C['primary']);txt(d,(x+555,yy),str(v),FONT_SMALL_B,textc)
        card(d,(955,365,1418,850),dark);txt(d,(980,390),'Repeated issues',FONT_H2,textc)
        for i,(s,v) in enumerate([('Unsupported superlative',5),('Missing source owner',4),('Prohibited wording',3)]):
            yy=465+i*85;txt(d,(980,yy),s,FONT_SMALL_B,textc);pill(d,980,yy+28,f'{v} times','#293452' if dark else C['amber_soft'],'#E6BA72' if dark else C['amber'])
        txt(d,(980,740),'Patterns point to unclear rules,',FONT_TINY,muted);txt(d,(980,762),'training gaps or expired sources.',FONT_TINY,muted)
    elif kind=='settings':
        sections=[('Personal preferences',['Appearance  ·  Light / dark mode','Guided product tour','Illustrated PDF product guide']),('Workspace details',['Workspace name','Firebase cloud / local mode','Current account and sign out']),('Data and exports',['Export workspace JSON','Export reviews CSV','Reset local demo data']),('Privacy and responsible AI',['Firebase manages sign-in','AI is optional and advisory','Human approval remains required'])]
        for i,(heading,items) in enumerate(sections):
            xx=x+(i%2)*560;yy=215+(i//2)*320
            card(d,(xx,yy,xx+530,yy+285),dark)
            txt(d,(xx+22,yy+22),heading,FONT_H2,textc)
            for j,item in enumerate(items):
                y2=yy+88+j*58;rr(d,(xx+22,y2,xx+62,y2+36),10,'#293452' if dark else C['primary_soft']);txt(d,(xx+35,y2+8),'✓',FONT_SMALL_B,'#A9B4FF' if dark else C['primary']);txt(d,(xx+80,y2+9),item,FONT_SMALL,muted)
        card(d,(x,865-4,1418,880),dark)
    # small guide tag
    txt(d,(W-230,H-33),'BRANDLENS  ·  UI GUIDE',FONT_TINY,muted)
    path=SCREEN_DIR/f'screen_{kind}.png';img.save(path,optimize=True)
    return path

screens={
 'overview':draw_screen('overview','Good afternoon, Alex.','Overview'),
 'review':draw_screen('review','Create a content review','New review'),
 'knowledge':draw_screen('knowledge','Approved knowledge library','Brand knowledge'),
 'assets':draw_screen('assets','Brand asset library','Asset library'),
 'approvals':draw_screen('approvals','Approval queue','Approval queue'),
 'insights':draw_screen('insights','Insights & patterns','Insights'),
 'settings':draw_screen('settings','Workspace settings','Settings',dark=True),
}

# Register a clear TrueType font for all text in the PDF.
pdfmetrics.registerFont(TTFont('DV', str(FONT_DIR/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DV-Bold', str(FONT_DIR/'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DV-Oblique', str(FONT_DIR/'DejaVuSans-Oblique.ttf')))

NAVY=colors.HexColor('#1E2B3A'); PURPLE=colors.HexColor('#5A6FD6'); TEAL=colors.HexColor('#238B7A'); MUTE=colors.HexColor('#687685'); LINE=colors.HexColor('#E2E7ED'); PALE=colors.HexColor('#F3F5F8'); CORAL=colors.HexColor('#C85F50'); AMBER=colors.HexColor('#A77529')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle',fontName='DV-Bold',fontSize=31,leading=37,textColor=NAVY,spaceAfter=8))
styles.add(ParagraphStyle(name='CoverSub',fontName='DV',fontSize=13,leading=19,textColor=MUTE,spaceAfter=14))
styles.add(ParagraphStyle(name='H1x',fontName='DV-Bold',fontSize=22,leading=28,textColor=NAVY,spaceBefore=0,spaceAfter=8))
styles.add(ParagraphStyle(name='H2x',fontName='DV-Bold',fontSize=13,leading=17,textColor=PURPLE,spaceBefore=8,spaceAfter=4))
styles.add(ParagraphStyle(name='Bodyx',fontName='DV',fontSize=9.2,leading=14,textColor=NAVY,spaceAfter=5))
styles.add(ParagraphStyle(name='Smallx',fontName='DV',fontSize=8,leading=11,textColor=MUTE,spaceAfter=4))
styles.add(ParagraphStyle(name='Captionx',fontName='DV-Oblique',fontSize=7.5,leading=10,textColor=MUTE,alignment=TA_CENTER,spaceBefore=3,spaceAfter=8))
styles.add(ParagraphStyle(name='Calloutx',fontName='DV',fontSize=8.8,leading=13,textColor=NAVY,backColor=colors.HexColor('#EDF0FF'),borderColor=colors.HexColor('#D8DDFB'),borderWidth=.6,borderPadding=8,spaceBefore=4,spaceAfter=8))
styles.add(ParagraphStyle(name='Cellx',fontName='DV',fontSize=7.7,leading=10,textColor=NAVY))
styles.add(ParagraphStyle(name='CellBoldx',fontName='DV-Bold',fontSize=7.7,leading=10,textColor=NAVY))

def P(text, style='Bodyx'):
    return Paragraph(text,styles[style])
def bullets(items):
    return [P('• '+x,'Bodyx') for x in items]
def image(path,width=170*mm):
    im=Image.open(path); ratio=im.height/im.width
    return RLImage(str(path),width=width,height=width*ratio)
def callout(text):
    t=Table([[P(text,'Calloutx')]],colWidths=[174*mm])
    t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,colors.HexColor('#D8DDFB')),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#EDF0FF')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    return t
def table(rows,widths=None):
    t=Table(rows,colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EDF0FF')),('TEXTCOLOR',(0,0),(-1,0),NAVY),
      ('FONTNAME',(0,0),(-1,0),'DV-Bold'),('GRID',(0,0),(-1,-1),.35,LINE),
      ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
      ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)
    ]))
    return t

story=[]
# Cover
story += [Spacer(1,8*mm),P('brandlens®  /  GOVERNANCE STUDIO','H2x'),Spacer(1,8*mm),P('The simple guide to<br/>BrandLens','CoverTitle'),P('A practical guide to checking content, keeping brand rules up to date and making careful human decisions before publication.','CoverSub'),Spacer(1,3*mm),image(screens['overview'],174*mm),P('Illustrative picture of the BrandLens workspace. Your live reviews and counts will be different.','Captionx'),Spacer(1,2*mm),callout('<b>What BrandLens does:</b> It compares a draft with approved brand information, explains possible issues and helps the right people review the content. It does not publish content by itself.'),Spacer(1,5*mm),P('Product guide · Version 2.1 · October 2026','Smallx'),PageBreak()]

# 1 Overview and navigation
story += [P('1. Start with the workspace','H1x'),P('When BrandLens opens, you see a workspace. A workspace is the shared area for one company or team. It holds reviews, brand rules, approved images, team roles and activity records.'),image(screens['overview'],174*mm),P('Picture 1. The overview screen and navigation.','Captionx'),P('What the main areas mean','H2x')]
rows=[[P('Area','CellBoldx'),P('What it is for','CellBoldx')]]
for a,b in [
 ('Overview','A summary of review work, open findings, active knowledge and a readiness signal.'),
 ('New review','Start a check on a new piece of copy or an imported document.'),
 ('Review library','Find all saved reviews and open their details.'),
 ('Brand knowledge','Store facts, approved wording, tone rules and guidelines.'),
 ('Asset library','Keep brand images and record their use, alternative text and rights notes.'),
 ('Approval queue','See reviews waiting for a reviewer or manager decision.'),
 ('Insights','See repeated issues and the types of findings being recorded.'),
 ('Audit trail','Read the history of actions recorded in the workspace.'),
 ('Team & roles','See team members and the permissions assigned to each role.'),
 ('Settings','Change your theme, rename the workspace and export data.')]: rows.append([P(a,'CellBoldx'),P(b,'Cellx')])
story += [table(rows,[43*mm,131*mm]),P('Click a navigation item to open that section. BrandLens shows one main section at a time so the page is easier to use. On a small screen, use the menu button to open the navigation.','Bodyx'),PageBreak()]

# 2 Guest accounts
story += [P('2. Guest mode, accounts and workspaces','H1x'),P('BrandLens has two ways to use it. Guest mode lets you try the sample workspace. A signed-in account lets you create or join a private workspace in Firebase.'),P('Guest mode','H2x')]
story += bullets(['The account name shows “Guest user”.','The sample workspace contains example reviews, example rules and example team members.','Changes made as a guest are saved in this browser only. They do not appear on another computer.','Do not enter confidential company content while using a shared computer or a guest session.'])
story += [P('Create an account or sign in','H2x')]
story += bullets(['Choose Sign in / create account from the account menu or Settings.','To make an account, enter your name, work email and a strong password. The first account creates a new workspace administrator.','You can also choose Continue with Google when the Google provider is enabled in Firebase.','For password recovery, type your email address and choose Forgot password. Firebase sends the reset email.','After signing in, create a workspace or join one using the workspace ID supplied by an administrator.'])
story += [callout('<b>Important:</b> BrandLens uses Firebase Authentication. It does not save your password in the application local storage. Firebase providers and authorised website domains must be enabled in the Firebase project.'),P('Workspace menu','H2x'),P('The workspace button near the logo shows the workspace that is open. It displays whether you are in guest mode or a signed-in Firebase workspace. A signed-in user can switch to another workspace or create one. A workspace is private to its active members according to the deployed access rules.'),PageBreak()]

# 3 Create review
story += [P('3. Create a content review','H1x'),P('A review is a saved check of a draft that may be published on a website, social channel, email, paid campaign or product page.'),image(screens['review'],174*mm),P('Picture 2. New review screen.','Captionx'),P('How to run your first check','H2x')]
story += bullets(['Click New review in the left navigation.','Give the review a clear title, such as “Spring product announcement”.','Choose the channel where the content will appear. This helps the team understand the context.','Paste the text in the large draft box, or import a file.','Choose Run brand preflight. The checker reviews the draft and displays the findings below.','Read the results. Open the full review to manage each finding and work with your team.'])
story += [P('Supported document files','H2x'),P('TXT, Markdown (MD), HTML, CSV and Word DOCX files can be imported. The file must be 10 MB or smaller. The extracted draft must be no longer than 50,000 characters. Images and PDFs are not extracted as review text in this version. You can still upload approved image assets in the Asset library.'),callout('<b>Keep the original:</b> BrandLens stores the original copy. It does not silently replace your wording. You decide whether to apply a suggested correction.'),PageBreak()]

# 4 Findings
story += [P('4. Understand a finding and make a correction','H1x'),P('A finding is a possible problem that the checker noticed. Each finding explains the phrase, the reason it was flagged and the approved information that was used.'),P('You may see these evidence labels:','H2x')]
story += [table([
 [P('Label','CellBoldx'),P('Plain English meaning','CellBoldx')],
 [P('Supported','CellBoldx'),P('An active approved knowledge item supports the finding. The source name and source text are shown.','Cellx')],
 [P('Unsupported','CellBoldx'),P('No active approved source was found for the statement. BrandLens must not invent a source.','Cellx')],
 [P('Expired source','CellBoldx'),P('The linked information has passed its validity date. Ask the source owner to confirm it.','Cellx')],
 [P('Conflict','CellBoldx'),P('The draft appears to disagree with an approved source. Check the exact context with a person.','Cellx')],
], [38*mm,136*mm]),P('What you can do','H2x')]
story += bullets(['Apply suggestion: replace the flagged phrase with the suggested wording. A creator edit remains pending until an authorised reviewer accepts or resolves the high-risk finding.','Mark accepted: record that an authorised reviewer has considered the finding.','Dismiss with reason: explain why the finding does not apply. A reason is required for an audit record.','Add a comment: leave a note for the creator or reviewer.','Save a version: keep a snapshot before a large edit. You can compare or restore an earlier version from the review page.'])
story += [callout('<b>Remember:</b> A high-risk finding must be accepted, dismissed with a reason or resolved by an authorised reviewer before approval. The checker is not a legal adviser and a clean result is not a guarantee that the content is true or safe.'),PageBreak()]

# 5 Knowledge
story += [P('5. Brand knowledge: the source of truth','H1x'),P('Brand knowledge is the information your team has approved. BrandLens checks draft content against active items in this library. Better source information helps create better reviews.'),image(screens['knowledge'],134*mm),P('Picture 3. Example knowledge cards.','Captionx'),P('Five types of knowledge','H2x')]
story += [table([
 [P('Type','CellBoldx'),P('What to store','CellBoldx'),P('Example','CellBoldx')],
 [P('Fact','CellBoldx'),P('Confirmed details, dates, hours, prices or product facts.','Cellx'),P('“Support is open Monday to Friday, 9 AM to 6 PM IST.”','Cellx')],
 [P('Glossary','CellBoldx'),P('Preferred terms and words the team should avoid.','Cellx'),P('Use “workspace”, not “portal”.','Cellx')],
 [P('Tone','CellBoldx'),P('How the brand should sound.','Cellx'),P('Clear, helpful, calm and confident.','Cellx')],
 [P('Guideline','CellBoldx'),P('Rules for claims, messaging and approval.','Cellx'),P('Ranking claims need an approved source.','Cellx')],
 [P('Asset','CellBoldx'),P('A reference record for an approved brand asset.','Cellx'),P('Primary logo for a white background.','Cellx')],
], [26*mm,75*mm,73*mm])]
story += [P('How to add a useful source','H2x')]
story += bullets(['Choose Brand knowledge, then Add knowledge.','Choose the type and write a clear title.','Enter the approved rule or fact in plain English.','Add the source name, exact source text, preferred term or prohibited terms when they apply.','Add an expiry date when the information may change.','Save the item and keep its status Active only while it is approved and current. Archive old items instead of deleting the history.'])
story += [callout('<b>Good practice:</b> Use an official document, page or policy as the source. Name the owner who can confirm it later. Do not mark an unverified statement as approved.'),PageBreak()]

# 6 Assets
story += [P('6. Brand asset library','H1x'),P('The Asset library keeps approved logos, photographs, illustrations, icons and templates together. It also records basic information that helps people use the asset correctly.'),image(screens['assets'],174*mm),P('Picture 4. Example asset cards.','Captionx'),P('How to add an asset','H2x')]
story += bullets(['Choose Asset library, then Add an asset.','Upload a PNG, JPEG, WebP or SVG file. A file must be 5 MB or smaller.','Give it a clear name and choose its type.','Write alternative text that explains why the image is there.','Add usage and rights notes. For example, say where the image can be used and who owns it.','Use Check asset to see basic reminders about file type, size, dimensions, alternative text and ownership notes.'])
story += [callout('<b>Current limitation:</b> Asset checking is not full visual AI. It does not compare a logo against every approved master file, verify trademarks, detect every layout error or confirm image rights. A person must inspect the final design.'),PageBreak()]

# 7 Review library & approvals
story += [P('7. Review library and approval workflow','H1x'),P('The Review library contains saved drafts and their current status. Open a review to read its content, findings, comments, versions and approval history.'),image(screens['approvals'],174*mm),P('Picture 5. Example approval queue.','Captionx'),P('The normal workflow','H2x')]
story += [table([
 [P('Step','CellBoldx'),P('Who acts','CellBoldx'),P('What happens','CellBoldx')],
 [P('1. Draft','CellBoldx'),P('Creator','Cellx'),P('Creates a review and runs the preflight check.','Cellx')],
 [P('2. Specialist review','CellBoldx'),P('Specialist reviewer','Cellx'),P('Checks risky claims, source evidence and important context. May request changes.','Cellx')],
 [P('3. Approval','CellBoldx'),P('Brand manager or administrator','Cellx'),P('Approves a review after checking that no high-risk finding remains unresolved. A creator cannot approve their own review.','Cellx')],
 [P('4. Publish','CellBoldx'),P('Publish owner, manager or administrator','Cellx'),P('Confirms the final approved version and creates a workspace publication record.','Cellx')],
], [32*mm,57*mm,85*mm])]
story += [P('Approval is not publication. The app records a human decision, but the review checker does not post to social media or change a live website. The publishing team must complete its normal publishing process outside BrandLens.'),PageBreak()]

# 8 Team roles
story += [P('8. Team and roles','H1x'),P('Roles help give each person the right level of access. The rules should be tested with separate Firebase accounts before the workspace is used for real company work.')]
story += [table([
 [P('Role','CellBoldx'),P('Main responsibilities','CellBoldx')],
 [P('Administrator','CellBoldx'),P('Manages workspace settings, member roles, knowledge, reviews, approvals and publishing.','Cellx')],
 [P('Brand manager','CellBoldx'),P('Manages approved knowledge, reviews issues and approves content.','Cellx')],
 [P('Specialist reviewer','CellBoldx'),P('Reviews specialist or high-risk content and can request changes or dismiss findings with a reason.','Cellx')],
 [P('Creator','CellBoldx'),P('Submits drafts, reads findings and edits their own content. Cannot approve their own review.','Cellx')],
 [P('Publish owner','CellBoldx'),P('Performs the final publish/export action after approval.','Cellx')],
], [42*mm,132*mm])]
story += [P('Inviting a teammate','H2x')]
story += bullets(['An administrator or brand manager opens Team & roles and chooses Invite member.','Enter the teammate’s Firebase user UID, display name, optional email and role.','The workspace creates a pending invitation record.','Share the workspace ID with the teammate. They sign in with the invited Firebase account and join that workspace.'])
story += [callout('<b>Invitation limitation:</b> This build does not send an email invitation. It creates a pending record for a known Firebase UID. A trusted email/Cloud Function invitation service is a future production improvement.'),PageBreak()]

# 9 Insights and audit
story += [P('9. Insights and audit trail','H1x'),P('Insights help a team learn from the reviews stored in its workspace. It groups findings by their category, shows repeated phrases or problems and highlights knowledge that may have expired.'),image(screens['insights'],174*mm),P('Picture 6. Example insight charts.','Captionx'),P('How to use insights','H2x')]
story += bullets(['Look at the category counts to see what kind of issues appear most often.','Read repeated issues. If the same problem appears many times, the rule may be unclear or team members may need training.','Check knowledge freshness and ask source owners to update expired details.','Export the insight summary for a team discussion.'])
story += [P('Audit trail','H2x'),P('The audit trail lists actions, people, roles, reasons and times. In a signed-in Firebase workspace, the supplied Firestore rules make audit events append-only: a member can add an event but cannot update or delete an existing event. Guest/local audit information is stored in the browser and is not tamper-proof.'),callout('<b>Important:</b> Counts and readiness indicators describe the records in the current workspace only. They are not customer metrics, industry comparisons or proof that business risk has been reduced.'),PageBreak()]

# 10 Search and tour
story += [P('10. Search, tour and light/dark mode','H1x'),P('Global search','H2x'),P('Use the Search anything box at the top of the page. It can find workspace sections, review titles, findings, knowledge items, assets, team members and audit events. Choose a search result to open the relevant page. Press Ctrl + K on Windows/Linux or Command + K on Mac to focus the search box.'),P('Guided tour','H2x'),P('Choose Start guided tour from the left sidebar or from Settings. The seven steps take you to the overview, new review, brand knowledge, assets, approvals, insights and settings. A highlighted area shows what the tour is explaining. Choose Next to continue or Exit tour to stop.'),P('Light and dark mode','H2x'),P('Use the sun/moon button in the top bar or the Appearance setting to switch themes. Your selected theme is saved in this browser. The theme changes colours only; it does not change review permissions or the data in your workspace.'),image(screens['settings'],174*mm),P('Picture 7. Settings in the dark theme.','Captionx'),PageBreak()]

# 11 Settings and exports
story += [P('11. Settings and downloads','H1x'),P('Settings contains personal options, workspace details, exports and privacy notes.'),P('Useful controls','H2x')]
story += bullets(['Appearance: switch between the light and dark themes.','Guided product tour: replay the walkthrough.','Product guide: download this PDF again.','Workspace name: administrators and brand managers can rename the workspace.','Current account: check the signed-in email or sign out.','Export workspace JSON: save a copy of reviews, findings, knowledge items, team and audit data.','Export review CSV: download a spreadsheet-friendly list of reviews and their states.','Export review report: download one review as a JSON record.','Reset local data: resets guest/sample information in this browser. It does not delete documents in a cloud workspace.'])
story += [callout('<b>Exports contain sensitive information.</b> Store downloaded review files in an approved company location. Do not send confidential drafts to personal email or public file-sharing links.'),P('About the readiness number','H2x'),P('The overview readiness value is a simple internal signal calculated from recorded open findings and expired knowledge. It is not an audit score, certification or promise of compliance. Use the underlying findings and decisions, not just the number.'),PageBreak()]

# 12 privacy
story += [P('12. Privacy, security and responsible AI','H1x'),P('Brand governance work can contain confidential company information. Choose the right workspace and confirm your organisation’s data rules before adding content.'),P('Where information is stored','H2x')]
story += bullets(['Guest/sample data is saved in the browser local storage on that device. Anyone with access to the same browser profile may be able to see it.','Signed-in workspace data is saved in the configured Firebase Firestore database. Approved image files are stored in Firebase Storage. This build does not mirror cloud workspace documents into localStorage.','The server verifies the Firebase ID token and active workspace membership before a signed-in preflight review. It loads approved knowledge from Firestore; it does not trust a list of sources sent by the browser.','The Gemini key is a server-side variable. Never add it to app.js or another browser file.'])
story += [P('When AI is enabled','H2x'),P('If the server has a Gemini API key, a signed-in cloud review can send the draft and selected approved knowledge summaries to Google for review. Google returns possible findings; BrandLens checks that quoted text is actually in the draft and that any source IDs point to active approved knowledge. If AI is not configured or fails, deterministic rules remain available. Guest reviews run in the browser and do not send the draft to Gemini.'),P('Human control','H2x'),P('AI suggestions are not automatic decisions. A person must read the draft, check the evidence and decide what to change. Authorised people approve and publish content. No draft is published automatically.'),callout('<b>Do not assume that “no findings” means “safe”.</b> Automated checks can miss context, legal requirements, privacy issues, false statements and visual problems. A person remains accountable for the final content.'),PageBreak()]

# 13 production limits
story += [P('13. Before a commercial launch','H1x'),P('This package provides a stronger MVP foundation, but the organisation must complete the following work before it uses BrandLens for real customer or confidential content.'),P('Technical setup','H2x')]
story += bullets(['Enable Firebase Email/Password and Google providers. Add all production and staging website domains to Firebase authorised domains.','Deploy and test Firestore and Storage security rules against the correct named Firestore database and Storage bucket. Use Firebase Emulator Suite tests with every role.','Set FIREBASE_WEB_API_KEY on the server and restrict the key to the Identity Toolkit API. Set GEMINI_API_KEY only in a secret manager if AI is required.','Set APP_ORIGIN to the exact public origin. Add HTTPS, monitoring, backups, retention, incident response and rate limits at the edge.','Run browser end-to-end tests, accessibility tests, load tests and an independent security assessment.'])
story += [P('Product work to plan','H2x')]
story += bullets(['Add email invitations and managed membership recovery using a trusted server or Cloud Function.','Add a full visual similarity engine for logos, colours, placement and image comparisons. The current checks are basic metadata checks.','Improve numeric fact checking and freshness handling. Test against real organisation-approved examples.','Run a formal accessibility audit. The current readability and link checks do not prove WCAG conformance.','Add a trusted server-side approval transaction that re-reads every finding and recalculates unresolved high-risk items; the current client-maintained counter is an MVP guard, not tamper-proof.' ,'Define privacy, consent, retention, deletion and AI vendor policies with the organisation’s legal and security teams.'])
story += [P('Final reminder','H2x'),P('Only publish claims that are supported by current and approved information. Keep the evidence source and the human decision together. When a rule is unclear, update the knowledge library instead of relying on an AI guess.'),Spacer(1,4*mm),callout('<b>BrandLens: Review before you publish. Keep people in control.</b>'),Spacer(1,6*mm),P('End of product guide · BrandLens version 2.1','Smallx')]

# Header and footer on all pages except the cover, using a clear printed page number.
def page_decor(canvas, doc):
    canvas.saveState()
    page=doc.page
    if page>1:
        canvas.setStrokeColor(LINE);canvas.setLineWidth(.5);canvas.line(18*mm, A4[1]-14*mm, A4[0]-18*mm, A4[1]-14*mm)
        canvas.setFont('DV-Bold',7);canvas.setFillColor(PURPLE);canvas.drawString(18*mm,A4[1]-11*mm,'BRANDLENS  /  PRODUCT GUIDE')
        canvas.setFont('DV',7);canvas.setFillColor(MUTE);canvas.drawRightString(A4[0]-18*mm,A4[1]-11*mm,'Simple English · v2.1')
    canvas.setStrokeColor(LINE);canvas.line(18*mm, 13*mm, A4[0]-18*mm, 13*mm)
    canvas.setFont('DV',7);canvas.setFillColor(MUTE);canvas.drawString(18*mm,8*mm,'BrandLens · Evidence-first brand governance')
    canvas.drawRightString(A4[0]-18*mm,8*mm,f'Page {page}')
    canvas.restoreState()

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=21*mm,bottomMargin=19*mm,title='BrandLens Product Guide',author='BrandLens',subject='Simple English illustrated user guide')
doc.build(story,onFirstPage=page_decor,onLaterPages=page_decor)
print(f'Created {OUT} ({OUT.stat().st_size:,} bytes)')
print('Illustrations:')
for key,path in screens.items(): print(key, path, path.stat().st_size)
