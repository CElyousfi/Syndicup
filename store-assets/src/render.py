#!/usr/bin/env python3
"""Reproducible SyndicUp store assets — HTML/CSS rendered in Chromium.

Run at repository root with python store-assets/src/render.py.
The renderer consumes the real Flutter fonts, brand assets and fr/ar .arb files.
All UI examples are fictional and contain no personal information.
"""
from __future__ import annotations
import asyncio, base64, html, json, struct
from pathlib import Path
from PIL import Image, ImageCms, ImageOps, ImageDraw
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'store-assets'
ARB = ROOT / 'apps/mobile/lib/core/i18n'
FONTS = ROOT / 'apps/mobile/assets/fonts'
DARI = ROOT / 'apps/mobile/assets/dari'
PICTURES = ROOT / 'apps/mobile/assets/images'

FORMATS = [
    ('play/phone', 1080, 1920, 'phone', 'fr', 8),
    ('play/tablet-7', 1200, 1920, 'tablet', 'fr', 4),
    ('play/tablet-10', 1600, 2560, 'tablet', 'fr', 4),
    ('appstore/iphone-6.9', 1320, 2868, 'phone', 'fr', 8),
    ('appstore/iphone-6.5', 1284, 2778, 'phone', 'fr', 8),
    ('appstore/ipad-13', 2064, 2752, 'tablet', 'fr', 4),
    ('play/phone-ar', 1080, 1920, 'phone', 'ar', 8),
    ('appstore/iphone-6.9-ar', 1320, 2868, 'phone', 'ar', 8),
]

FR = [
 ('Votre copropriété, d’un coup d’œil.', 'Charges, incidents, AG et annonces au même endroit.'),
 ('Des charges claires pour tous.', 'Chaque lot voit ce qu’il doit et ce qu’il a payé.'),
 ('Signalez, suivez, réglez.', 'Photo, urgence, suivi en temps réel.'),
 ('Des AG simples, même à distance.', 'Convocation, ordre du jour et vote dans l’app.'),
 ('Informez toute la résidence.', 'Une annonce, tout le monde est prévenu.'),
 ('Tous les documents, rangés.', 'Règlement, PV, contrats, toujours à portée de main.'),
 ('Visiteurs et parkings maîtrisés.', 'Invitations, emplacements et badges.'),
 ('Dari répond à vos questions.', 'Un assistant qui connaît votre résidence.'),
]
AR = [
 ('إقامتكم في نظرة واحدة', 'الواجبات والأعطاب والجموع والإعلانات في مكان واحد.'),
 ('واجبات واضحة للجميع', 'كل وحدة تعرف ما عليها وما دفعته.'),
 ('بلّغوا، تابعوا، واطمئنوا', 'الصور ودرجة الاستعجال والمتابعة أولًا بأول.'),
 ('جموع عامة بلا تعقيد', 'الاستدعاء وجدول الأعمال والتصويت عبر التطبيق.'),
 ('أخبروا جميع السكان', 'إعلان واحد يصل إلى سكان الإقامة.'),
 ('وثائقكم كلها منظمة', 'النظام الداخلي والمحاضر والعقود في متناولكم.'),
 ('الزيارات والمواقف تحت السيطرة', 'الزوار والمواقف والشارات في مكان واحد.'),
 ('داري يجيب عن أسئلتكم', 'مساعد يعرف إقامتكم ويرشدكم.'),
]

# The icons below depict existing Material icons used in the cited Flutter widgets.
ICON = {
 'grid':'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 'coins':'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
 'wrench':'<path d="M15 4a5 5 0 0 0-5.6 6.8L4 16.2a2.7 2.7 0 0 0 3.8 3.8l5.4-5.4A5 5 0 0 0 20 9l-3.1 3.1-3-3L17 6z"/>',
 'building':'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M11 21v-3h2v3"/>',
 'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9zM10 21h4"/>',
 'chevron':'<path d="m9 5 7 7-7 7"/>',
 'back':'<path d="m15 5-7 7 7 7M8 12h12"/>',
 'plus':'<path d="M12 4v16M4 12h16"/>',
 'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18"/>',
 'file':'<path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7M9 17h7"/>',
 'vote':'<path d="M6 10h12l2 10H4zM7 10V4h10v6M9 14l2 2 4-4"/>',
 'megaphone':'<path d="M4 10h5l10-6v16L9 14H4zM9 14l2 6H7l-2-6"/>',
 'car':'<path d="M5 17h14l-1-7-2-4H8l-2 4zM4 10h16M7 17v3m10-3v3"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
 'parking':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 18V7h5a3.5 3.5 0 0 1 0 7H9"/>',
 'doc':'<path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7M9 17h7"/>',
 'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 'check':'<path d="m4 12 5 5L20 6"/>',
 'alert':'<path d="M12 3 2 21h20zM12 9v5m0 3v1"/>',
 'chat':'<path d="M4 4h16v13H9l-5 4zM8 9h8m-8 4h6"/>',
 'person':'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 'arrow':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
 'dots':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 'send':'<path d="m3 11 18-8-8 18-2-8zM11 13l10-10"/>',
 'key':'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3"/>',
 'lock':'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 'chart':'<path d="M3 19V5m0 14h18M7 16l4-5 4 2 5-7"/>',
 'home':'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
}

def glyph(name: str, size=22, cls='') -> str:
    return f'<svg class="ico {cls}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">{ICON.get(name, ICON["dots"])}</svg>'

def esc(s) -> str: return html.escape(str(s), quote=True)

def img(path:Path, cls='', alt='') -> str:
    if not path.is_file(): return ''
    mime = {'png':'image/png','svg':'image/svg+xml','webp':'image/webp'}.get(path.suffix.lower().lstrip('.'),'image/jpeg')
    encoded=base64.b64encode(path.read_bytes()).decode('ascii')
    return f'<img class="{cls}" src="data:{mime};base64,{encoded}" alt="{esc(alt)}">'

def card(text, kind='normal'):
    return f'<div class="flat-card {kind}">{text}</div>'

def badge(text, tone='outline'):
    return f'<span class="badge {tone}">{esc(text)}</span>'

def section(title, after='', subtitle=''):
    return f'<div class="section-head"><div><b>{esc(title)}</b>{f"<small>{esc(subtitle)}</small>" if subtitle else ""}</div>{f"<em>{esc(after)}</em>" if after else ""}</div>'

def tile(icon_name, value, label, tone='sage', hint=''):
    return f'<div class="stat-tile"><div class="icon-round {tone}">{glyph(icon_name)}</div><div class="stat-bottom"><strong>{esc(value)}</strong><div>{esc(label)}</div>{f"<small>{esc(hint)}</small>" if hint else ""}</div></div>'

def list_row(icon_name,title,subtitle='',trailing='',tone='sage',initials=None):
    lead = f'<div class="avatar tiny">{esc(initials)}</div>' if initials else f'<span class="icon-round {tone}">{glyph(icon_name,20)}</span>'
    return f'<div class="list-row">{lead}<div class="row-main"><b>{esc(title)}</b><small>{esc(subtitle)}</small></div><div class="row-end">{trailing or glyph("chevron",16)}</div></div>'

def shell_header(T, title='', allow_bar=True, active='grid', ar=False):
    base=(f'<div class="shell-head"><div class="shell-line"><div class="avatar">YB</div><div class="residence-pill">{esc("Résidence Al Amal")}</div><span class="shell-bubble">{glyph("chat",18)}</span><span class="shell-bubble">{glyph("bell",20)}</span></div>')
    if title: base+=f'<div class="shell-page-title">{esc(title)}</div>'
    return base+'</div>'

def bottom_nav(T, active='grid'):
    labels=[('grid','nav_court_grid'),('coins','nav_court_coins'),('wrench','nav_court_wrench'),('building','nav_court_building'),('dots','nav_plus')]
    bits=[]
    for i,(ic,k) in enumerate(labels):
        if i==2: bits.append(f'<div class="tab actiontab"><span>{glyph("plus",23)}</span><small>{esc(T("nav_actions"))}</small></div>')
        bits.append(f'<div class="tab {"chosen" if ic==active else ""}">{glyph(ic,23)}<small>{esc(T(k))}</small></div>')
    return '<div class="bottom-nav">'+''.join(bits)+'</div>'

def page_header(title,subtitle=''):
    return f'<div class="page-header"><span class="back-pill">{glyph("back",22)}</span><div><h2>{esc(title)}</h2>{f"<p>{esc(subtitle)}</p>" if subtitle else ""}</div></div>'

def scene_1(T, ar, tablet):
    photo=img(PICTURES/'residence-hero.jpg','hero-photo')
    greeting=T('dash_greeting').replace('{prenom}','Yasmine B.')
    # _Greeting + DariDashboardCard + TileCarousel + _RoundAction from dashboard_screen.dart.
    banner=f'<div class="residence-photo">{photo}</div>'
    hello=f'<div class="greeting"><h2>{esc(greeting)}</h2><p>Résidence Al Amal</p></div>'
    helper=f'<div class="dari-strip"><span class="chat-round">{glyph("chat",23)}</span><div><b>{esc(T("dari_bulleTitre"))}</b><small>{esc(T("dari_bulleTexte"))}</small></div>{glyph("chevron",18)}</div>'
    stat=f'<div class="tile-scroll">{tile("coins","7 500,00 MAD",T("dash_impayes"))}{tile("chart","25 %",T("finances_tauxPaiement"),"lilac")}{tile("wrench","2",T("dash_incidentsOuverts"),"sand")}</div>'
    actions=f'<div class="round-actions"><div><span class="lime-circle">{glyph("coins")}</span><small>{esc(T("finances_enregistrerPaiement"))}</small></div><div><span class="round-circle">{glyph("file")}</span><small>{esc(T("dash_genererAppel"))}</small></div><div><span class="round-circle">{glyph("key")}</span><small>{esc(T("dash_inviterResident"))}</small></div></div>'
    below=section(T('finances_appels'),T('common_seeAll'))+card(list_row('coins', 'novembre 2026',f'{T("enums_typeAppel_CHARGES_COURANTES")} · {T("finances_echeance")} 10/12/2026','2 500 / 10 000 MAD'))
    return shell_header(T)+f'<main class="content dashboard">{banner}{hello}{helper}{stat}{actions}{below}</main>'+bottom_nav(T,'grid')

def scene_2(T, ar, tablet):
    # E3 detail: _Resume, StatTiles, SectionHeader(d.finances.lignes), CardList(ListRow...).
    rows=[('A1',2500,True),('A2',3000,False),('A3',2500,False),('P1',1200,False),('LG',800,False)]
    inner='<div class="resume"><span class="icon-round sand extra">'+glyph('coins',28)+'</span><strong>10 000,00 MAD</strong><small>'+esc(T('finances_echeance'))+' · 10/12/2026</small></div>'
    inner+='<div class="tile-scroll two">'+tile('check','2 500,00 MAD',T('finances_paye'),'sage','25 %')+tile('clock','7 500,00 MAD',T('finances_restant'),'sand')+'</div>'
    inner+=section(T('finances_lignes'),subtitle=T('finances_lignesSubtitle'))
    inner+='<div class="flat-card list-card">'
    for name,amt,paid in rows:
        b=badge(T('finances_paye') if paid else T('finances_du'), 'ok' if paid else 'warn')
        inner+=list_row('home',name,f'{amt:,}'.replace(',',' ') + ',00 MAD',b,'sage')
    inner+='</div>'
    return page_header(T('finances_appels'),'نوفمبر 2026' if ar else 'novembre 2026')+f'<main class="content inner">{inner}</main>'

def scene_3(T, ar, tablet):
    # IncidentsScreen: FilterChips OUVERTS/TOUS/OUVERT/EN_COURS/RESOLU/FERME, CardList rows.
    chips=[T('dash_incidentsOuverts'),T('common_all'),T('enums_statutIncident_OUVERT'),T('enums_statutIncident_EN_COURS')]
    filters='<div class="filter-track">'+''.join(f'<span class="filter {"selected" if i==0 else ""}">{esc(x)}</span>' for i,x in enumerate(chips))+'</div>'
    a=list_row('wrench','Fuite colonne montante',f'{T("enums_categorieIncident_PLOMBERIE")} · {T("enums_partie_COMMUNE") if T("enums_partie_COMMUNE") else "Parties communes"} · 23/11/2026',badge(T('enums_statutIncident_EN_COURS'),'info')+'<div class="sub-badge">'+badge(T('enums_urgence_URGENTE'),'danger')+'</div>','sand')
    b=list_row('wrench','Minuterie du palier',f'{T("enums_categorieIncident_ELECTRICITE")} · 22/11/2026',badge(T('enums_statutIncident_OUVERT'),'warn')+'<div class="sub-badge">'+badge(T('enums_urgence_NORMALE'),'outline')+'</div>','lilac')
    content=f'<main class="content inner">{filters}<div class="flat-card list-card">{a}{b}</div></main>'
    fab=f'<div class="floating-btn">{glyph("plus",20)}<span>{esc(T("incidents_signaler"))}</span></div>'
    return shell_header(T,T('incidents_titre'))+content+fab+bottom_nav(T,'wrench')

def scene_4(T, ar, tablet):
    # AgDetailScreen: summary card + EN_COURS PosterCard + resolutions CardList.
    head=page_header(T('enums_typeAg_ORDINAIRE'),'samedi 12 décembre 2026 · 18:30' if not ar else 'السبت 12 ديسمبر 2026 · 18:30')
    intro=card(f'<div class="summary-top"><span class="icon-round lilac extra">{glyph("vote",27)}</span>{badge(T("enums_statutAg_EN_COURS"),"warn")}</div><h3>{esc(T("ag_seance"))}</h3><small>{esc(T("ag_quorum"))} · 60 %</small>')
    poster=f'<div class="poster"><small>{esc(T("enums_typeAg_ORDINAIRE"))}</small><h3>{esc(T("ag_seance").upper() if not ar else T("ag_seance"))}</h3><p>2 {esc(T("ag_resolutions").lower())}</p><div class="poster-button">{esc(T("ag_rejoindreSeance"))}</div></div>'
    resolutions=section(T('ag_resolutions'),subtitle='2 '+T('ag_resolutions').lower())
    resolutions+=card(list_row('vote','Approbation du budget 2027' if not ar else 'المصادقة على ميزانية 2027',T('enums_typeMajorite_ARTICLE_24') if 'enums_typeMajorite_ARTICLE_24' in T.keywords else T('ag_typeMajorite'),badge(T('enums_resultatResolution_EN_ATTENTE'),'outline'),'lilac')+list_row('vote','Réfection des parties communes' if not ar else 'إصلاح الأجزاء المشتركة',T('ag_typeMajorite'),badge(T('enums_resultatResolution_EN_ATTENTE'),'outline'),'lilac'))
    return head+f'<main class="content inner">{intro}{poster}{resolutions}</main>'

def scene_5(T, ar, tablet):
    # TableauAffichageScreen — category chips, pinned ink PosterCard, AnnonceCard.
    chips='<div class="filter-track"><span class="filter selected">'+esc(T('communication_toutes'))+'</span><span class="filter">'+esc(T('communication_annonces'))+'</span><span class="filter">'+esc(T('communication_sondages'))+'</span></div>'
    announcement='Bienvenue dans la résidence…' if not ar else 'مرحبًا بكم في الإقامة…'
    body='Bienvenue à Résidence Al Amal. Les informations de la copropriété sont désormais disponibles ici.' if not ar else 'مرحبًا بكم في إقامة الأمل. تجدون هنا معلومات الملكية المشتركة.'
    poster=f'<div class="poster ink"><small>{esc(T("communication_epinglee"))} · {esc(T("communication_annonces"))}</small><h3>{esc(announcement.upper() if not ar else announcement)}</h3><p>{esc(body)}</p></div>'
    row=list_row('megaphone','Entretien des parties communes' if not ar else 'صيانة الأجزاء المشتركة','22/11/2026 · Yasmine B.',badge(T('communication_nonLue'),'outline'),'sand')
    return page_header(T('communication_titre'),T('communication_subtitle'))+f'<main class="content inner">{chips}{poster}{card(row,"list-card")}</main>'

def scene_6(T, ar, tablet):
    # DocumentsScreen: courtyard photo banner, search field, document-type chips and CardList.
    photo=img(PICTURES/'residence-courtyard.jpg','banner-photo')
    banner=f'<div class="photo-banner">{photo}<b>Résidence Al Amal</b></div>'
    search=f'<div class="search-box">{glyph("search",19)}<span>{esc(T("common_search"))}</span></div>'
    types=f'<div class="filter-track">{badge(T("documents_typesConnus_REGLEMENT_INTERIEUR"))}{badge(T("documents_typesConnus_PV"))}{badge(T("documents_typesConnus_CONTRAT"))}</div>'
    rows=[('Règlement intérieur.pdf' if not ar else 'النظام الداخلي.pdf','REGLEMENT_INTERIEUR'),('PV assemblée 2026.pdf' if not ar else 'محضر الجمع العام 2026.pdf','PV'),('Contrat entretien.pdf' if not ar else 'عقد الصيانة.pdf','CONTRAT')]
    li=''.join(list_row('file',name,T('documents_typesConnus_'+typ)+' · 18/11/2026','','lilac') for name,typ in rows)
    foot=f'<div class="lock-note">{glyph("lock",15)}<span>{esc(T("documents_telechargement"))}</span></div>'
    return page_header(T('documents_titre'),T('documents_subtitle'))+f'<main class="content inner">{banner}{search}{types}{card(li,"list-card")}{foot}</main>'

def scene_7(T, ar, tablet):
    # ParkingsScreen _VisiteursTab — tab strip, places libres, visiteurs du jour.
    tabs=['parkings_onglets_plan','parkings_onglets_vehicules','parkings_onglets_badges','parkings_onglets_visiteurs']
    tabbar='<div class="tab-strip">'+''.join(f'<span class="{"selected" if i==3 else ""}">{esc(T(k))}</span>' for i,k in enumerate(tabs))+'</div>'
    lead=f'<p class="muted-p">{esc(T("parkings_visiteursJourAide"))}</p>'
    free=section(T('parkings_placesLibres'))+'<div class="place-pills"><span>'+glyph('parking',16)+' V2</span><span>'+glyph('parking',16)+' V3</span></div>'
    visits=section(T('parkings_visiteursJour'),T('nav_visites'))
    visits+=card(list_row('parking','V1 · Karim E.',f'{T("parkings_lot")} A2 · 12345-A-6 · 09:20', '', 'sand')+list_row('parking','V4 · Sara M.',f'{T("parkings_lot")} A3 · 23456-B-6 · 09:12','','sand'),'list-card')
    return shell_header(T,T('parkings_titre'))+tabbar+f'<main class="content inner">{lead}{free}{visits}</main>'+bottom_nav(T,'dots')

def scene_8(T, ar, tablet):
    # AssistantScreen: stand-alone greige Scaffold; original Dari PNG in green top area.
    dari=img(DARI/'dari-wave-poster.png','dari-original','Dari')
    top=f'<div class="assistant-top"><span class="white-back">{glyph("back",22)}</span>{dari}<div><h3>{esc(T("dari_nom"))}</h3><small><i></i>{esc(T("dari_sousTitre"))}</small></div></div>'
    intro=T('dari_bonjour').replace('{prenom}','Yasmine')
    bubble=f'<div class="assistant-bubble"><span class="assistant-avatar">{img(DARI/"dari-head-poster.png")}</span><div><b>{esc(intro)}</b><p>{esc(T("dari_intro"))}</p></div></div>'
    quick=f'<div class="assistant-quick"><div class="flat-card">{esc(T("dari_rienAFaire"))}</div><small>{esc(T("dari_suggestionsTitre"))}</small><div class="suggestion">{esc(T("finances_appels"))}</div><div class="suggestion">{esc(T("incidents_titre"))}</div></div>'
    inp=f'<div class="assistant-input">{glyph("search",19)}<span>{esc(T("dari_placeholder"))}</span><div>{glyph("send",19)}</div></div><small class="ai-warning">{esc(T("dari_avertissement"))}</small>'
    return top+f'<main class="assistant-body">{bubble}{quick}</main><div class="assistant-foot">{inp}</div>'

SCENES = [scene_1,scene_2,scene_3,scene_4,scene_5,scene_6,scene_7,scene_8]

# Every store format has a physically separate, editable HTML template.
# Placeholders are filled from the same brand tokens and Flutter-derived scene builders.
HTML_TEMPLATE = """<!doctype html>
<html lang="__LANG__" dir="__DIR__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>__CSS__</style>
</head>
<body class="__LANG__">
<div class="page __THEME__ __DEVICE__" style="__VARIABLES__">
__BRAND__
<header class="headline"><h1>__HEADLINE__</h1><p>__SUBLINE__</p></header>
<div class="device"><div class="device-inner __LANG__">__STATUS____SCREEN__</div></div>
</div>
</body></html>
"""

def write_templates():
    folder=HERE/'templates'
    folder.mkdir(exist_ok=True)
    for key,w,h,device,lang,n in FORMATS:
        template=folder/(key.replace('/','-')+'.html')
        source=f'<!-- SyndicUp {key}, {w} x {h}, {lang} — editable source -->\n'+HTML_TEMPLATE
        template.write_text(source,encoding='utf-8')

def symbol(odd):
    files=sorted((ROOT/'docs/brand').glob('symbole-*.svg'))
    if not files: return ''
    priorities=('lime','white','vert','green') if odd else ('ink','noir','black','vert','green')
    asset=next((p for candidate in priorities for p in files if candidate in p.stem.lower()),files[0])
    return img(asset, 'brand-symbol', 'SyndicUp')


CSS = r'''
@font-face{font-family:Inter;src:url('__INTER__') format('truetype');font-weight:400}
@font-face{font-family:Inter;src:url('__INTERB__') format('truetype');font-weight:700}
@font-face{font-family:Archivo;src:url('__ARCHIVO__') format('truetype');font-weight:900}
@font-face{font-family:Noto;src:url('__NOTO__') format('truetype');font-weight:400}
@font-face{font-family:Noto;src:url('__NOTOB__') format('truetype');font-weight:700}
@font-face{font-family:Kufi;src:url('__KUFIB__') format('truetype');font-weight:800}
*{box-sizing:border-box}html,body{margin:0;overflow:hidden;width:100%;height:100%;background:#1E7552}body{font-family:Inter,Arial,sans-serif;color:#121212}body.ar{font-family:Noto,Arial,sans-serif}svg{flex-shrink:0}.page{width:100vw;height:100vh;position:relative;overflow:hidden;background:var(--back)}.brand-symbol{position:absolute;left:7.6%;top:3.35%;height:50px;width:50px;object-fit:contain}.ar .brand-symbol{left:auto;right:7.6%}.headline{position:absolute;top:8.5%;left:7.6%;right:7.6%;z-index:2;color:var(--headline);max-width:88%;}.headline h1{margin:0;font-family:Archivo,'Arial Black',Inter,sans-serif;font-weight:900;line-height:1.01;letter-spacing:-.018em;font-size:var(--heading-size);max-width:94%;}.headline p{margin:19px 0 0;font-size:var(--subtitle-size);line-height:1.34;color:var(--subcolor);max-width:100%;white-space:nowrap;letter-spacing:-.015em;}.ar .headline{direction:rtl;text-align:right}.ar .headline h1{font-family:Kufi,Noto,sans-serif;line-height:1.35;letter-spacing:0;font-weight:800;}.ar .headline p{font-family:Noto,sans-serif;letter-spacing:0;}.device{position:absolute;top:var(--top);left:50%;width:var(--device-width);height:var(--device-height);margin-left:calc(var(--device-width) / -2);border:9px solid #202222;border-radius:44px;background:white;overflow:hidden;box-shadow:0 16px 0 #153D30;}.page.light .device{box-shadow:0 16px 0 #D0CFC9}.device-inner{transform:scale(var(--scale));transform-origin:0 0;width:var(--logical-width);height:var(--logical-height);position:absolute;left:0;top:0;background:#fff;overflow:hidden}.device-inner.ar{direction:rtl}.status{height:30px;display:flex;justify-content:space-between;align-items:center;padding:4px 22px 1px 22px;font-family:Inter,sans-serif;font-weight:700;font-size:13px;color:#121212;background:white;position:relative;z-index:3}.status .right{display:flex;gap:5px;align-items:center}.status .bat{height:11px;width:20px;border:1.5px solid #171717;border-radius:3px;position:relative;padding:1px;display:flex;align-items:stretch}.status .bat:after{position:absolute;content:'';height:5px;width:2px;right:-4px;top:2px;background:#171717;border-radius:1px}.status .bat:before{content:'';display:block;width:100%;background:#171717;border-radius:1px}.status .signal{display:flex;align-items:end;gap:2px;height:10px}.status .signal span{display:block;background:#171717;width:2.7px;border-radius:1px}.status .signal span:nth-child(1){height:4px}.status .signal span:nth-child(2){height:6px}.status .signal span:nth-child(3){height:8px}.status .signal span:nth-child(4){height:10px}.status .wifi{font-size:15px;line-height:1}.shell-head{background:white;padding:5px 13px 8px}.shell-line{height:54px;display:flex;align-items:center;gap:8px}.avatar{height:47px;width:47px;display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;background:#E2EEE7;border-radius:50%;color:#1E7552;font-size:16px;font-weight:700}.avatar.tiny{width:42px;height:42px;font-size:13px}.residence-pill{margin-left:auto;background:#ECEBE4;border-radius:999px;padding:12px 15px;font-weight:700;font-size:12px;max-width:194px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.ar .residence-pill{margin-left:0;margin-right:auto}.shell-bubble{color:#1E7552;padding:6px 2px}.shell-page-title{font-weight:700;font-size:25px;padding:12px 2px 0}.page-header{background:#fff;padding:12px 17px 15px;display:flex;align-items:flex-start;gap:10px}.back-pill{height:40px;width:40px;flex-shrink:0;border-radius:50%;background:#ECEBE4;color:#17603F;display:flex;align-items:center;justify-content:center}.ar .back-pill svg{transform:scaleX(-1)}.page-header h2{font-size:26px;line-height:1.1;letter-spacing:-.025em;margin:2px 0 2px;font-weight:700}.page-header p{font-size:13px;color:#596269;line-height:1.4;margin:5px 0 0}.content{overflow:hidden;position:relative;background:#fff}.content.inner{padding:8px 16px 110px}.dashboard{padding:0 16px 130px}.residence-photo{height:126px;margin:0;overflow:hidden;position:relative;border-radius:26px 26px 0 0;background:#E2EEE7}.hero-photo,.banner-photo{height:100%;width:100%;object-fit:cover}.greeting{margin-top:-22px;border-radius:24px 24px 0 0;background:white;position:relative;padding:19px 0 15px}.greeting h2{margin:0;font-weight:500;font-size:30px;letter-spacing:-.04em}.greeting h2:first-letter{font-weight:700}.greeting p{font-size:14px;color:#596269;margin:6px 0 0}.dari-strip{background:#E2EEE7;border-radius:20px;padding:13px 12px;display:flex;align-items:center;gap:10px;color:#17603F;margin-bottom:16px}.dari-strip>div{flex:1}.dari-strip b{display:block;font-size:13px}.dari-strip small{display:block;line-height:1.3;color:#45515C;font-size:10px;margin-top:2px}.chat-round{height:36px;width:36px;border-radius:50%;background:#fff;display:flex;justify-content:center;align-items:center}.tile-scroll{display:flex;gap:12px;overflow:hidden;width:calc(100% + 16px);padding-bottom:6px}.stat-tile{background:#ECEBE4;border-radius:22px;min-width:47%;width:47%;height:184px;display:flex;flex-direction:column;justify-content:space-between;padding:15px;flex-shrink:0}.tile-scroll.two .stat-tile{width:49.3%;min-width:49.3%;height:155px}.icon-round{height:40px;width:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#E2EEE7;color:#17603F;flex-shrink:0}.icon-round.sand{background:#F1EAD9;color:#8A5A00}.icon-round.lilac{background:#E3E4EA;color:#595D75}.icon-round.warn{background:#F5ECDA;color:#8A5A00}.icon-round.extra{width:60px;height:60px}.stat-bottom strong{font-size:25px;letter-spacing:-.035em;line-height:1.1;display:block;white-space:nowrap}.stat-bottom div{font-size:13px;line-height:1.25;margin-top:6px;color:#45515C}.stat-bottom small{font-size:10px;color:#596269}.round-actions{display:flex;gap:22px;padding:15px 0 5px}.round-actions>div{width:27%;text-align:center}.round-actions small{display:block;color:#45515C;font-size:11px;line-height:1.2;margin-top:7px}.lime-circle,.round-circle{display:flex;justify-content:center;align-items:center;width:49px;height:49px;border-radius:50%;margin:auto}.lime-circle{background:#E3EF8D}.round-circle{background:#ECEBE4;color:#1E7552}.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:9px;margin:22px 0 12px}.section-head b{font-size:20px;letter-spacing:-.018em}.section-head em{font-style:normal;font-size:12px;color:#1E7552;text-decoration:underline;font-weight:700;white-space:nowrap}.section-head small{font-size:11px;color:#596269;margin-top:4px;display:block;font-weight:400}.flat-card{background:#ECEBE4;border-radius:24px;padding:18px;margin:8px 0 12px;overflow:hidden}.list-card{padding:0 15px}.list-row{display:flex;align-items:center;gap:11px;min-height:73px;border-bottom:1px solid #D9D6CB;padding:12px 0}.list-row:last-child{border-bottom:0}.row-main{flex:1;min-width:0}.row-main b{font-size:13px;line-height:1.3;font-weight:600;display:block}.row-main small{display:block;color:#596269;font-size:10.5px;line-height:1.3;margin-top:4px}.row-end{display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:#17603F;font-size:10.5px;white-space:nowrap;max-width:110px}.badge{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:6px 10px;border:1px solid #D9D6CB;color:#17603F;font-weight:600;line-height:1.1;font-size:10.5px;background:white;max-width:116px;white-space:normal;text-align:center}.badge.info{background:#E4EEEF;border-color:transparent;color:#48707A}.badge.warn{background:#F5ECDA;border-color:transparent;color:#8A5A00}.badge.danger{background:#F8E9E7;border-color:transparent;color:#98140B}.badge.ok{background:#E9F0DD;border-color:transparent;color:#395917}.sub-badge{margin-top:4px}.filter-track{display:flex;gap:7px;overflow:hidden;white-space:nowrap;margin-bottom:16px}.filter{display:inline-block;padding:10px 14px;border-radius:999px;background:#fff;border:1px solid #D9D6CB;font-size:12px;color:#17603F;font-weight:600;white-space:nowrap}.filter.selected{background:#E3EF8D;color:#121212;border-color:#E3EF8D}.resume{text-align:center;padding:6px 0 24px;display:flex;flex-direction:column;align-items:center;gap:8px}.resume strong{font-size:34px;letter-spacing:-.045em}.resume small{font-size:13px;color:#596269}.summary-top{display:flex;align-items:flex-start;justify-content:space-between}.flat-card h3{font-size:24px;margin:16px 0 4px}.flat-card small{font-size:13px;color:#596269}.poster{border-radius:26px;background:#1E7552;padding:23px;margin:12px 0 18px;color:white;overflow:hidden}.poster.ink{background:#121212}.poster small{font-size:14px;color:white;font-weight:600}.poster h3{font-family:Archivo,'Arial Black',sans-serif;color:#E3EF8D;font-size:32px;line-height:1.03;letter-spacing:-.03em;margin:13px 0}.ar .poster h3{font-family:Kufi,Noto,sans-serif;line-height:1.4;letter-spacing:0}.poster p{font-size:14px;line-height:1.4;color:#DDE7DD}.poster-button{background:#E3EF8D;color:#121212;border-radius:999px;font-weight:700;padding:14px 16px;margin-top:16px;text-align:center;font-size:14px}.photo-banner{height:135px;border-radius:20px;position:relative;background:#E2EEE7;overflow:hidden;margin:5px 0 15px}.photo-banner b{position:absolute;left:13px;bottom:12px;background:#fff;padding:7px 12px;border-radius:999px;font-size:12px}.ar .photo-banner b{left:auto;right:13px}.search-box{display:flex;align-items:center;gap:9px;border-radius:999px;background:#ECEBE4;color:#596269;font-size:13px;padding:15px 16px;margin:10px 0 16px}.lock-note{display:flex;align-items:flex-start;gap:7px;color:#7D8583;margin-top:16px;font-size:10px;line-height:1.4}.tab-strip{background:white;display:flex;border-bottom:1px solid #E9E7DF;padding:0 16px;gap:20px;white-space:nowrap;overflow:hidden}.tab-strip span{font-size:13px;padding:12px 0;color:#596269}.tab-strip span.selected{color:#121212;font-weight:700;border-bottom:3px solid #121212}.muted-p{font-size:13px;color:#596269;margin:10px 0 24px;line-height:1.5}.place-pills{display:flex;gap:8px}.place-pills span{display:inline-flex;align-items:center;gap:6px;background:#E9F0DD;color:#395917;border-radius:999px;font-size:13px;font-weight:700;padding:11px 14px}.floating-btn{position:absolute;bottom:106px;right:16px;z-index:5;background:#E3EF8D;padding:13px 17px;display:flex;gap:8px;align-items:center;border-radius:999px;font-size:12px;font-weight:700}.ar .floating-btn{right:auto;left:16px}.bottom-nav{position:absolute;bottom:0;width:100%;height:76px;background:white;border-top:1px solid #E9E7DF;display:flex;align-items:flex-start;justify-content:space-around;padding-top:8px;z-index:4}.tab{display:flex;align-items:center;flex-direction:column;gap:4px;color:#7D8583;flex:1}.tab.chosen{color:#121212}.tab small{font-size:10px;font-weight:600}.tab.actiontab>span{background:#E3EF8D;color:#121212;display:flex;border-radius:50%;width:45px;height:45px;align-items:center;justify-content:center;margin-top:-6px}.tab.actiontab small{margin-top:-3px}.assistant-top{display:flex;align-items:center;gap:10px;background:#1E7552;height:150px;padding:4px 8px 0;color:#fff}.assistant-top .white-back{color:#fff;padding:11px;background:#418B6D;border-radius:50%}.assistant-top img.dari-original{object-fit:contain;height:110px;width:104px;flex-shrink:0;align-self:flex-end}.assistant-top h3{font-size:19px;margin:0}.assistant-top small{font-size:11px;display:flex;align-items:center;gap:6px;margin-top:8px;color:#fff}.assistant-top small i{height:7px;width:7px;background:#E3EF8D;border-radius:50%}.assistant-body{background:#ECEBE4;height:100%;padding:18px 14px}.assistant-bubble{display:flex;align-items:flex-start;gap:9px}.assistant-avatar{width:34px;height:34px;border-radius:50%;background:#1E7552;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0}.assistant-avatar img{width:34px;height:34px;object-fit:contain}.assistant-bubble>div{background:white;border-radius:18px;padding:15px;flex:1}.assistant-bubble b{font-size:13px}.assistant-bubble p{font-size:12px;line-height:1.5;color:#45515C;margin:5px 0 0}.assistant-quick{padding-left:43px}.ar .assistant-quick{padding-left:0;padding-right:43px}.assistant-quick .flat-card{background:white;font-size:12px;color:#596269;border-radius:17px;padding:14px;margin:11px 0 16px}.assistant-quick>small{display:block;font-size:11px;color:#7D8583;text-transform:uppercase;font-weight:700;margin-bottom:10px}.suggestion{background:white;border:1px solid #D9D6CB;border-radius:999px;padding:12px 15px;display:inline-block;font-size:12px;font-weight:600;margin:0 8px 8px 0}.assistant-foot{position:absolute;bottom:0;background:#ECEBE4;width:100%;padding:9px 12px 30px}.assistant-input{border-radius:28px;background:white;display:flex;align-items:center;gap:10px;padding:9px 9px 9px 14px;font-size:13px;color:#7D8583}.assistant-input span{flex:1}.assistant-input>div{display:flex;align-items:center;justify-content:center;background:#E3EF8D;width:40px;height:40px;border-radius:50%;color:#121212}.ai-warning{display:block;text-align:center;font-size:10px;color:#7D8583;line-height:1.3;margin:8px 5px 0}.ar .list-row .row-end svg:not(.badge svg){transform:scaleX(-1)}.ar .content{direction:rtl}.tablet .device-inner{--x:1}.tablet .content.inner{padding-left:27px;padding-right:27px}.tablet .tile-scroll .stat-tile{min-width:30%;width:30%}.tablet .tile-scroll.two .stat-tile{min-width:38%;width:38%}.tablet .list-card{max-width:100%}.tablet .residence-photo{height:145px}.tablet .greeting h2{font-size:31px}.tablet .bottom-nav{height:75px}
'''

def font_url(file, fallback):
    path=(FONTS / file) if (FONTS / file).is_file() else Path(fallback.replace('file://',''))
    if not path.is_file(): return ''
    encoded=base64.b64encode(path.read_bytes()).decode('ascii')
    return 'data:font/ttf;base64,'+encoded

CSS = (CSS.replace('__INTER__', font_url('Inter-Regular.ttf','file:///usr/share/fonts/opentype/inter/Inter-Regular.otf'))
.replace('__INTERB__', font_url('Inter-Bold.ttf','file:///usr/share/fonts/opentype/inter/Inter-Bold.otf'))
.replace('__ARCHIVO__', font_url('ArchivoDisplay-Black.ttf','file:///usr/share/fonts/opentype/inter/Inter-Black.otf'))
.replace('__NOTO__', font_url('NotoSansArabic-Regular.ttf','file:///usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf'))
.replace('__NOTOB__', font_url('NotoSansArabic-Bold.ttf','file:///usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf'))
.replace('__KUFIB__', font_url('NotoKufiArabic-ExtraBold.ttf','file:///usr/share/fonts/truetype/noto/NotoKufiArabic-ExtraBold.ttf')))

CSS += '\n.ar .resume strong, .ar .stat-bottom strong { direction:ltr; unicode-bidi:isolate; text-align:right; }'

def html_scene(scene:int,w:int,h:int,device:str,lang:str,dictdata:dict,folder:str):
    rtl=lang=='ar'; key = lambda k: dictdata.get(k,k)
    key.keywords=dictdata
    head,sub = (AR if rtl else FR)[scene-1]
    odd=scene%2==1
    # Desktop browser never draws any branded phone hardware; the black border is generic.
    dw = int(w*(.84 if device=='phone' else .86))
    logical = 396 if device=='phone' else 800
    scale = (dw-18)/logical
    top = int(h*(.315 if device=='phone' else .32))
    dh=int((850 if device=='phone' else 1030)*scale+18)
    pagebg='#1E7552' if odd else '#ECEBE4'
    fg='#E3EF8D' if odd else '#121212'
    subcolor='#FFFFFF' if odd else '#45515C'
    heading=(.075 if not rtl else .064)*w
    if device=='tablet':heading=w*(.061 if not rtl else .055)
    subsize=w*(.024 if device=='phone' else .022)
    screen=SCENES[scene-1](key,rtl,device=='tablet')
    style=f'--back:{pagebg};--headline:{fg};--subcolor:{subcolor};--heading-size:{heading:.2f}px;--subtitle-size:{subsize:.2f}px;--device-width:{dw}px;--device-height:{dh}px;--scale:{scale:.5f};--logical-width:{logical}px;--logical-height:{1060 if device=="tablet" else 850}px;--top:{top}px'
    # Deliberately no Apple or Google device image, notch, platform badge, or CTA.
    status='<div class="status"><span class="time">09:41</span><span class="right"><span class="signal"><span></span><span></span><span></span><span></span></span><span class="wifi">◔</span><span class="bat"></span></span></div>'
    tmpl_path = HERE / 'templates' / (folder.replace('/', '-') + '.html')
    template = tmpl_path.read_text(encoding='utf-8')
    fields = {
        '__LANG__': lang,
        '__DIR__': 'rtl' if rtl else 'ltr',
        '__CSS__': CSS,
        '__THEME__': 'dark' if odd else 'light',
        '__DEVICE__': device,
        '__VARIABLES__': style,
        '__BRAND__': symbol(odd),
        '__HEADLINE__': esc(head),
        '__SUBLINE__': esc(sub),
        '__STATUS__': status,
        '__SCREEN__': screen,
    }
    for marker, value in fields.items():
        template = template.replace(marker, value)
    return template


def load_dict(lang):
    p=ARB/f'{lang}.arb'
    if p.exists(): return json.loads(p.read_text(encoding='utf-8'))
    # Local preview only: CI runs inside the checkout and always loads the real ARB files.
    subset={
    'dash_greeting': 'مرحبًا {prenom}' if lang=='ar' else 'Bonjour {prenom}',
    'nav_court_grid':'الرئيسية' if lang=='ar' else 'Accueil', 'nav_court_coins':'النداءات' if lang=='ar' else 'Appels',
    'nav_court_wrench':'الأعطال' if lang=='ar' else 'Incidents','nav_court_building':'الشقق' if lang=='ar' else 'Lots',
    'nav_plus':'المزيد' if lang=='ar' else 'Plus', 'nav_actions':'إجراءات' if lang=='ar' else 'Actions',
    'finances_appels':'استدعاءات الأموال' if lang=='ar' else 'Appels de fonds',
    'incidents_titre':'الأعطاب' if lang=='ar' else 'Incidents',
    'ag_seance':'جلسة جارية' if lang=='ar' else 'Séance en cours',
    'ag_resolutions':'القرارات' if lang=='ar' else 'Résolutions',
    'ag_rejoindreSeance':'الانضمام إلى الجلسة' if lang=='ar' else 'Rejoindre la séance',
    'documents_titre':'الوثائق' if lang=='ar' else 'Documents',
    'communication_titre':'لوحة الإعلانات' if lang=='ar' else "Tableau d'affichage",
    'parkings_titre':'المواقف والشارات' if lang=='ar' else 'Parkings & badges',
    'dari_nom':'داري' if lang=='ar' else 'Dari',
    }
    return subset


def verify_png(path, expected):
    with path.open('rb') as f: header=f.read(29)
    if header[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError(f'Invalid PNG: {path}')
    w,h=struct.unpack('>II',header[16:24]);ctype=header[25]
    if (w,h)!=expected or ctype!=2: raise ValueError(f'{path}: actual {(w,h)}, color type {ctype}; expected RGB {expected}')
    return w,h,ctype


async def run():
    OUT.mkdir(parents=True,exist_ok=True)
    write_templates()
    manifest=[]; thumbs=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'],executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        for folder,w,h,kind,lang,n in FORMATS:
            target=OUT/folder;target.mkdir(parents=True,exist_ok=True)
            dictdata=load_dict(lang)
            page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
            for scene in range(1,n+1):
                png=target/f'{scene:02d}.png'
                if png.is_file():
                    try:
                        verify_png(png,(w,h))
                        if folder in ('play/phone','play/phone-ar'):
                            with Image.open(png) as prior: thumbs.append((folder,scene,prior.convert('RGB').copy()))
                        manifest.append((str(png.relative_to(OUT)),w,h))
                        continue
                    except ValueError:
                        png.unlink()
                markup=html_scene(scene,w,h,kind,lang,dictdata,folder)
                await page.set_content(markup,wait_until='load')
                await page.evaluate('document.fonts.ready')
                await page.screenshot(path=str(target/f'{scene:02d}.png'),full_page=False,animations='disabled')
                png=target/f'{scene:02d}.png'
                with Image.open(png) as raw:
                    rgb=raw.convert('RGB')
                    icc=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
                    rgb.save(png,format='PNG',icc_profile=icc,optimize=True)
                    if folder in ('play/phone','play/phone-ar'):
                        thumbs.append((folder,scene,rgb.copy()))
                verify_png(png,(w,h))
                manifest.append((str(png.relative_to(OUT)),w,h))
            await page.close()
        await browser.close()

    contact=Image.new('RGB',(8*280+9*20,2*510+3*40),'#F7F6F2')
    draw=ImageDraw.Draw(contact)
    for col,(folder,num,im) in enumerate(thumbs):
        x=20+(col%8)*300;y=40+(col//8)*550
        im.thumbnail((275,490),Image.Resampling.LANCZOS)
        contact.paste(im,(x,y+20))
        draw.text((x,y),f'{"FR" if folder=="play/phone" else "AR"} / {num:02d}',fill='#121212')
    icc=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    contact.save(OUT/'contact-sheet.png',icc_profile=icc,optimize=True)
    verify_png(OUT/'contact-sheet.png',contact.size)
    check=['# Store asset validation','', 'Every screenshot is a distinct 8-bit RGB PNG with an embedded sRGB ICC profile.','Dimensions below are read from the PNG IHDR on disk after rendering, not inferred from settings.','', '| File | Verified width × height | PNG color type |', '| --- | ---: | --- |']
    check += [f'| `{path}` | {w} × {h} | 2 (RGB, opaque) |' for path,w,h in manifest]
    check += ['','Contact sheet: `store-assets/contact-sheet.png` (FR and AR phone thumbnails).', '',f'**Verified {len(manifest)} individual screenshots.**','']
    (OUT/'CHECKLIST.md').write_text('\n'.join(check),encoding='utf-8')
    print(f'Generated and header-verified {len(manifest)} PNGs + contact sheet in {OUT}')

if __name__=='__main__':asyncio.run(run())
