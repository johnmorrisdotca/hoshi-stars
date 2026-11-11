#!/usr/bin/env python3
"""Write src/data/culture-chinese.ts: the traditional Chinese sky (the Three Enclosures and the Twenty-Eight Mansions) as asterisms of Bright Star Catalogue stars.

Source: Wikidata (https://www.wikidata.org), whose data is CC0 1.0 (public domain dedication), read through its SPARQL endpoint https://query.wikidata.org/sparql on 2026-11-09. For
every star that Wikidata gives a Bright Star Catalogue number (P528 qualified by catalogue Q499138, "HR 5056") it reads the Chinese label and aliases (`角宿一` is the first star of the asterism
`角宿`: an asterism's name and the star's number in it). A second query, read on 2026-11-11, lists the items that are an instance of "Chinese constellation" (Q1074076) with their Chinese and
English labels and their "part of" (P361) statements: an asterism's English name and the enclosure or mansion it belongs to come only from there. Nothing is copied from Stellarium, Wikipedia text or
any book: only which star carries which traditional name, a fact, and the NAMES table below (our own table of the asterism names with their Traditional spelling and pinyin, typed for this package).

What it keeps
- A name that ends in a Chinese number (`一` to `卅`) is star N of the asterism before it; a name with `增` before the number is an "added" star the 1752 catalogue put near the asterism, and is left
  out of the figure. The asterism name is looked up through FORMS (Traditional and Simplified spellings) in NAMES; a name that is not in NAMES is left out.
- Wikidata also uses the Simplified spelling in places and some stars carry the same name twice (a double star); every HR number found is kept.
- Some asterism names are used twice in the sky (`柱`, `天田`, `杵`, `五诸侯`): the stars of one name are split into groups that lie within 30 degrees of each other, each group one asterism.
- SUPPLEMENT adds the stars that are known by a proper name rather than by a number (the seven stars of the Northern Dipper, Sirius as 天狼, Canopus as 老人, Arcturus as 大角).
- MERGE joins names that the same asterism goes by (三台 is the pairs 上台, 中台 and 下台).
- The lines are our own: the stars of an asterism joined by their minimum spanning tree (the shortest set of lines that reaches every star, by angle on the sky), not the traditional drawing.
- `missing` is the largest star number found minus the stars held: the asterism has at least that many stars fainter than visual magnitude 6.0, which the catalogue does not hold.
- Names with a character outside the Basic Multilingual Plane (rare characters most phones cannot draw) are left out.
- An asterism is matched to its Wikidata item by the item's Chinese label (zh, zh-hant or zh-hans): a label equal to one of the asterism's spellings first, else one equal once a bracketed note such as
  `(星官)` is taken off. Where that finds two items, or the name is split into two asterisms on the sky, nothing is taken. The English label is kept unless it is only the pinyin written out
  (`Qigong`), an older romanization (ROMANIZED) or the title of an article (`... in Chinese astronomy`); CAPITALS gives one
  label a capital on each word, as the others have. The part of statement is kept when it names exactly one of the Three Enclosures or one mansion;
  a statement that names a Western constellation is a different fact and is not used.

    python3 -I scripts/make-culture-data.py                # runs the query (needs the network)
    python3 -I scripts/make-culture-data.py --from FILE    # reads an answer saved earlier
    python3 -I scripts/make-culture-data.py --save FILE    # ... and keeps the answer in FILE
    --items-from FILE and --items-save FILE do the same for the second query (the asterism items).

None of this runs in the test.
"""
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "culture-chinese.ts"
STARS = ROOT / "src" / "data" / "stars.ts"

QUERY = """SELECT ?hr (SAMPLE(?zhl) AS ?zh) (GROUP_CONCAT(DISTINCT ?zha; separator="|") AS ?zhAlias) WHERE {
  ?item p:P528 ?st . ?st ps:P528 ?hr . ?st pq:P972 wd:Q499138 .
  OPTIONAL { ?item rdfs:label ?zhl FILTER(lang(?zhl)="zh") }
  OPTIONAL { ?item skos:altLabel ?zha FILTER(lang(?zha)="zh") }
} GROUP BY ?item ?hr"""

ITEMS_QUERY = """SELECT ?item ?zh ?hant ?hans ?en (GROUP_CONCAT(DISTINCT ?part; separator="|") AS ?parts) WHERE {
  ?item wdt:P31 wd:Q1074076 .
  OPTIONAL { ?item rdfs:label ?zh FILTER(lang(?zh)="zh") }
  OPTIONAL { ?item rdfs:label ?hant FILTER(lang(?hant)="zh-hant") }
  OPTIONAL { ?item rdfs:label ?hans FILTER(lang(?hans)="zh-hans") }
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") }
  OPTIONAL { ?item wdt:P361 ?part }
} GROUP BY ?item ?zh ?hant ?hans ?en"""

# The Three Enclosures by Wikidata item: our id for each.
ENCLOSURES = {"Q1145852": "purple-forbidden", "Q1145944": "supreme-palace", "Q1145862": "heavenly-market"}

# English labels that are an older romanization of the Chinese, not an English name.
ROMANIZED = {"Teen Ta Tseang Keun"}

# English labels written with a capital on each word, as the other names are.
CAPITALS = {"Flying serpent": "Flying Serpent"}

# The 28 mansions in their order, with the Symbol (the quarter of the sky) each belongs to: the Azure Dragon (east), the Black Tortoise (north), the White Tiger (west), the Vermilion Bird (south).
MANSIONS = {
    "azure-dragon": "角亢氐房心尾箕",
    "black-tortoise": "斗牛女虚危室壁",
    "white-tiger": "奎娄胃昴毕觜参",
    "vermilion-bird": "井鬼柳星张翼轸",
}

MERGE = {"上台": "三台", "中台": "三台", "下台": "三台", "女": "女宿"}

# Stars known by a proper name, by Bright Star Catalogue number: 天枢 Dubhe, 天璇 Merak, 天玑 Phecda, 天权 Megrez, 玉衡 Alioth, 开阳 Mizar, 摇光 Alkaid.
SUPPLEMENT = {
    "北斗": [4301, 4295, 4554, 4660, 4905, 5054, 5191],
    "天狼": [2491],
    "老人": [2326],
    "大角": [5340],
}

NAMES = {
    "七公": ("七公", "qī gōng"),
    "丈人": ("丈人", "zhàng rén"),
    "三台": ("三臺", "sān tái"),
    "三师": ("三師", "sān shī"),
    "三角形": ("三角形", "sān jiǎo xíng"),
    "东咸": ("東咸", "dōng xián"),
    "九卿": ("九卿", "jiǔ qīng"),
    "九坎": ("九坎", "jiǔ kǎn"),
    "九州殊口": ("九州殊口", "jiǔ zhōu shū kǒu"),
    "九斿": ("九斿", "jiǔ yóu"),
    "云雨": ("雲雨", "yún yǔ"),
    "五诸侯": ("五諸侯", "wǔ zhū hóu"),
    "五车": ("五車", "wǔ chē"),
    "井宿": ("井宿", "jǐng xiù"),
    "亢宿": ("亢宿", "kàng xiù"),
    "亢池": ("亢池", "kàng chí"),
    "人": ("人", "rén"),
    "从官": ("從官", "cóng guān"),
    "代": ("代", "dài"),
    "伐": ("伐", "fá"),
    "传舍": ("傳舍", "chuán shè"),
    "八谷": ("八穀", "bā gǔ"),
    "八魁": ("八魁", "bā kuí"),
    "六甲": ("六甲", "liù jiǎ"),
    "内厨": ("內廚", "nèi chú"),
    "内平": ("內平", "nèi píng"),
    "内阶": ("內階", "nèi jiē"),
    "军井": ("軍井", "jūn jǐng"),
    "军市": ("軍市", "jūn shì"),
    "刍蒿": ("芻蒿", "chú hāo"),
    "列肆": ("列肆", "liè sì"),
    "势": ("勢", "shì"),
    "勾陈": ("勾陳", "gōu chén"),
    "北斗": ("北斗", "běi dǒu"),
    "北极": ("北極", "běi jí"),
    "北河": ("北河", "běi hé"),
    "十字架": ("十字架", "shí zì jià"),
    "华盖": ("華蓋", "huá gài"),
    "南河": ("南河", "nán hé"),
    "南船": ("南船", "nán chuán"),
    "南门": ("南門", "nán mén"),
    "危宿": ("危宿", "wēi xiù"),
    "卷舌": ("捲舌", "juǎn shé"),
    "厕": ("廁", "cè"),
    "参宿": ("參宿", "shēn xiù"),
    "参旗": ("參旗", "cān qí"),
    "右垣": ("右垣", "yòu yuán"),
    "右摄提": ("右攝提", "yòu shè tí"),
    "右旗": ("右旗", "yòu qí"),
    "右更": ("右更", "yòu gēng"),
    "司危": ("司危", "sī wēi"),
    "司怪": ("司怪", "sī guài"),
    "司禄": ("司祿", "sī lù"),
    "司非": ("司非", "sī fēi"),
    "周": ("周", "zhōu"),
    "周鼎": ("周鼎", "zhōu dǐng"),
    "咸池": ("咸池", "xián chí"),
    "哭": ("哭", "kū"),
    "四渎": ("四瀆", "sì dú"),
    "四辅": ("四輔", "sì fǔ"),
    "土公": ("土公", "tǔ gōng"),
    "土公吏": ("土公吏", "tǔ gōng lì"),
    "坟墓": ("墳墓", "fén mù"),
    "垒壁阵": ("壘壁陣", "lěi bì zhèn"),
    "壁宿": ("壁宿", "bì xiù"),
    "外厨": ("外廚", "wài chú"),
    "外屏": ("外屏", "wài píng"),
    "大角": ("大角", "dà jiǎo"),
    "大陵": ("大陵", "dà líng"),
    "天仓": ("天倉", "tiān cāng"),
    "天厕": ("天廁", "tiān cè"),
    "天厨": ("天廚", "tiān chú"),
    "天厩": ("天廄", "tiān jiù"),
    "天右": ("天右", "tiān yòu"),
    "天园": ("天園", "tiān yuán"),
    "天囷": ("天囷", "tiān qūn"),
    "天垒城": ("天壘城", "tiān lěi chéng"),
    "天大将军": ("天大將軍", "tiān dà jiāng jūn"),
    "天市右垣": ("天市右垣", "tiān shì yòu yuán"),
    "天市左垣": ("天市左垣", "tiān shì zuǒ yuán"),
    "天床": ("天床", "tiān chuáng"),
    "天廪": ("天廩", "tiān lǐn"),
    "天弁": ("天弁", "tiān biàn"),
    "天枪": ("天槍", "tiān qiāng"),
    "天柱": ("天柱", "tiān zhù"),
    "天桴": ("天桴", "tiān fú"),
    "天棓": ("天棓", "tiān bàng"),
    "天樽": ("天樽", "tiān zūn"),
    "天江": ("天江", "tiān jiāng"),
    "天津": ("天津", "tiān jīn"),
    "天渊": ("天淵", "tiān yuān"),
    "天溷": ("天溷", "tiān hùn"),
    "天潢": ("天潢", "tiān huáng"),
    "天牢": ("天牢", "tiān láo"),
    "天狗": ("天狗", "tiān gǒu"),
    "天狼": ("天狼", "tiān láng"),
    "天理": ("天理", "tiān lǐ"),
    "天田": ("天田", "tiān tián"),
    "天相": ("天相", "tiān xiāng"),
    "天社": ("天社", "tiān shè"),
    "天纪": ("天紀", "tiān jì"),
    "天船": ("天船", "tiān chuán"),
    "天节": ("天節", "tiān jié"),
    "天苑": ("天苑", "tiān yuàn"),
    "天街": ("天街", "tiān jiē"),
    "天辐": ("天輻", "tiān fú"),
    "天钩": ("天鉤", "tiān gōu"),
    "天门": ("天門", "tiān mén"),
    "天阴": ("天陰", "tiān yīn"),
    "天高": ("天高", "tiān gāo"),
    "天龠": ("天龠", "tiān yuè"),
    "太微右垣": ("太微右垣", "tài wēi yòu yuán"),
    "夹白": ("夾白", "jiā bái"),
    "奎宿": ("奎宿", "kuí xiù"),
    "奚仲": ("奚仲", "xī zhòng"),
    "女宿": ("女宿", "nǚ xiù"),
    "女床": ("女床", "nǚ chuáng"),
    "娄宿": ("婁宿", "lóu xiù"),
    "子": ("子", "zǐ"),
    "孔雀": ("孔雀", "kǒng què"),
    "孙": ("孫", "sūn"),
    "宗": ("宗", "zōng"),
    "宗人": ("宗人", "zōng rén"),
    "宗正": ("宗正", "zōng zhèng"),
    "室宿": ("室宿", "shì xiù"),
    "宦者": ("宦者", "huàn zhě"),
    "小斗": ("小斗", "xiǎo dǒu"),
    "尚书": ("尚書", "shàng shū"),
    "尾宿": ("尾宿", "wěi xiù"),
    "屏": ("屏", "píng"),
    "屠肆": ("屠肆", "tú sì"),
    "左摄提": ("左攝提", "zuǒ shè tí"),
    "左旗": ("左旗", "zuǒ qí"),
    "左更": ("左更", "zuǒ gēng"),
    "市楼": ("市樓", "shì lóu"),
    "帛度": ("帛度", "bó dù"),
    "帝席": ("帝席", "dì xí"),
    "常陈": ("常陳", "cháng chén"),
    "平": ("平", "píng"),
    "平道": ("平道", "píng dào"),
    "库楼": ("庫樓", "kù lóu"),
    "建": ("建", "jiàn"),
    "异雀": ("異雀", "yì què"),
    "张宿": ("張宿", "zhāng xiù"),
    "弧矢": ("弧矢", "hú shǐ"),
    "御女": ("御女", "yù nǚ"),
    "心宿": ("心宿", "xīn xiù"),
    "房宿": ("房宿", "fáng xiù"),
    "扶筐": ("扶筐", "fú kuāng"),
    "折威": ("折威", "zhé wēi"),
    "文昌": ("文昌", "wén chāng"),
    "斗": ("斗", "dǒu"),
    "斗宿": ("斗宿", "dǒu xiù"),
    "斛": ("斛", "hú"),
    "星宿": ("星宿", "xīng xiù"),
    "昴宿": ("昴宿", "mǎo xiù"),
    "杠": ("槓", "gàng"),
    "杵": ("杵", "chǔ"),
    "柱": ("柱", "zhù"),
    "柳宿": ("柳宿", "liǔ xiù"),
    "梗河": ("梗河", "gěng hé"),
    "毕宿": ("畢宿", "bì xiù"),
    "氐宿": ("氐宿", "dī xiù"),
    "水位": ("水位", "shuǐ wèi"),
    "水委": ("水委", "shuǐ wěi"),
    "水府": ("水府", "shuǐ fǔ"),
    "河鼓": ("河鼓", "hé gǔ"),
    "波斯": ("波斯", "bō sī"),
    "泣": ("泣", "qì"),
    "海山": ("海山", "hǎi shān"),
    "海石": ("海石", "hǎi shí"),
    "渐台": ("漸臺", "jiàn tái"),
    "火鸟": ("火鳥", "huǒ niǎo"),
    "爟": ("爟", "guàn"),
    "牛宿": ("牛宿", "niú xiù"),
    "狗国": ("狗國", "gǒu guó"),
    "玉井": ("玉井", "yù jǐng"),
    "王良": ("王良", "wáng liáng"),
    "璃瑜": ("璃瑜", "lí yú"),
    "瓠瓜": ("瓠瓜", "hù guā"),
    "盖屋": ("蓋屋", "gài wū"),
    "砺石": ("礪石", "lì shí"),
    "离宫": ("離宮", "lí gōng"),
    "离珠": ("離珠", "lí zhū"),
    "秦": ("秦", "qín"),
    "积卒": ("積卒", "jī zú"),
    "箕宿": ("箕宿", "jī xiù"),
    "织女": ("織女", "zhī nǚ"),
    "罗堰": ("羅堰", "luó yàn"),
    "羽林军": ("羽林軍", "yǔ lín jūn"),
    "翼宿": ("翼宿", "yì xiù"),
    "老人": ("老人", "lǎo rén"),
    "胃宿": ("胃宿", "wèi xiù"),
    "臼": ("臼", "jiù"),
    "虚宿": ("虛宿", "xū xiù"),
    "蛇尾": ("蛇尾", "shé wěi"),
    "蛇腹": ("蛇腹", "shé fù"),
    "蛇首": ("蛇首", "shé shǒu"),
    "蜜蜂": ("蜜蜂", "mì fēng"),
    "螣蛇": ("螣蛇", "téng shé"),
    "衡": ("衡", "héng"),
    "角宿": ("角宿", "jiǎo xiù"),
    "觜宿": ("觜宿", "zī xiù"),
    "诸王": ("諸王", "zhū wáng"),
    "败瓜": ("敗瓜", "bài guā"),
    "败臼": ("敗臼", "bài jiù"),
    "贯索": ("貫索", "guàn suǒ"),
    "车府": ("車府", "chē fǔ"),
    "车肆": ("車肆", "chē sì"),
    "车骑": ("車騎", "chē jì"),
    "轩辕": ("軒轅", "xuān yuán"),
    "轸宿": ("軫宿", "zhěn xiù"),
    "辇道": ("輦道", "niǎn dào"),
    "近附白": ("近附白", "jìn fù bái"),
    "造父": ("造父", "zào fù"),
    "郎位": ("郎位", "láng wèi"),
    "金鱼": ("金魚", "jīn yú"),
    "阁道": ("閣道", "gé dào"),
    "阳门": ("陽門", "yáng mén"),
    "阴德": ("陰德", "yīn dé"),
    "附白": ("附白", "fù bái"),
    "雷电": ("雷電", "léi diàn"),
    "霹雳": ("霹靂", "pī lì"),
    "青丘": ("青丘", "qīng qiū"),
    "顿顽": ("頓頑", "dùn wán"),
    "飞鱼": ("飛魚", "fēi yú"),
    "马尾": ("馬尾", "mǎ wěi"),
    "马腹": ("馬腹", "mǎ fù"),
    "骑官": ("騎官", "qí guān"),
    "鬼宿": ("鬼宿", "guǐ xiù"),
    "鳖": ("鱉", "biē"),
    "鸟喙": ("鳥喙", "niǎo huì"),
    "鹤": ("鶴", "hè"),
    "龟": ("龜", "guī"),
}

FORMS = {
    "三台": "三台",
    "三師": "三师",
    "三臺": "三台",
    "上台": "三台",
    "上臺": "三台",
    "下台": "三台",
    "下臺": "三台",
    "中台": "三台",
    "中臺": "三台",
    "五諸侯": "五诸侯",
    "五車": "五车",
    "傳舍": "传舍",
    "內平": "内平",
    "內廚": "内厨",
    "內階": "内阶",
    "八穀": "八谷",
    "勢": "势",
    "勾陳": "勾陈",
    "北極": "北极",
    "參宿": "参宿",
    "參旗": "参旗",
    "右攝提": "右摄提",
    "司祿": "司禄",
    "四瀆": "四渎",
    "四輔": "四辅",
    "墳墓": "坟墓",
    "壘壁陣": "垒壁阵",
    "外廚": "外厨",
    "天倉": "天仓",
    "天園": "天园",
    "天壘城": "天垒城",
    "天大將軍": "天大将军",
    "天廁": "天厕",
    "天廄": "天厩",
    "天廚": "天厨",
    "天廩": "天廪",
    "天槍": "天枪",
    "天淵": "天渊",
    "天節": "天节",
    "天紀": "天纪",
    "天記": "天记",
    "天鈎": "天钩",
    "天鉤": "天钩",
    "天門": "天门",
    "天關": "天关",
    "夾白": "夹白",
    "女": "女宿",
    "婁宿": "娄宿",
    "孫": "孙",
    "少衛": "少卫",
    "尚書": "尚书",
    "左攝提": "左摄提",
    "市樓": "市楼",
    "常陳": "常陈",
    "庫樓": "库楼",
    "廁": "厕",
    "張宿": "张宿",
    "從官": "从官",
    "敗瓜": "败瓜",
    "敗臼": "败臼",
    "東咸": "东咸",
    "東海": "东海",
    "漸台": "渐台",
    "漸臺": "渐台",
    "火鳥": "火鸟",
    "狗國": "狗国",
    "畢宿": "毕宿",
    "異雀": "异雀",
    "礪石": "砺石",
    "積卒": "积卒",
    "積水": "积水",
    "織女": "织女",
    "羅堰": "罗堰",
    "羽林軍": "羽林军",
    "芻蒿": "刍蒿",
    "華蓋": "华盖",
    "蒭藁": "𫇴藁",
    "蓋屋": "盖屋",
    "虛宿": "虚宿",
    "諸王": "诸王",
    "貫索": "贯索",
    "車府": "车府",
    "車肆": "车肆",
    "車騎": "车骑",
    "軍井": "军井",
    "軍市": "军市",
    "軒轅": "轩辕",
    "軫宿": "轸宿",
    "輔": "辅",
    "輦道": "辇道",
    "近鈇銊": "近𫓧𫓰",
    "郎將": "郎将",
    "金魚": "金鱼",
    "鈇鑕": "𫓧锧",
    "開陽": "开阳",
    "閣道": "阁道",
    "陣車": "阵车",
    "陰德": "阴德",
    "陽門": "阳门",
    "離宮": "离宫",
    "離珠": "离珠",
    "雷電": "雷电",
    "頓頑": "顿顽",
    "飛魚": "飞鱼",
    "馬尾": "马尾",
    "馬腹": "马腹",
    "騎官": "骑官",
    "鱉": "鳖",
    "鳥喙": "鸟喙",
    "鶴": "鹤",
    "龜": "龟",
}


NUMERAL = "[一二三四五六七八九十廿卅]"
DIGITS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
PATTERN = re.compile("^(.+?)(增?)(" + NUMERAL + "+)$")
LINK_DEGREES = 30


def number(text):
    total = 0
    for ch in text:
        if ch == "廿":
            total += 20
        elif ch == "卅":
            total += 30
        elif ch == "十":
            total = total + 10 if total == 0 or total % 10 else total * 10
        else:
            total += DIGITS[ch]
    return total


def positions():
    """HR number -> (RA degrees, Dec degrees), from src/data/stars.ts."""
    out = {}
    for line in STARS.read_text(encoding="utf-8").split("`")[1].split("\n"):
        f = line.split("|")
        out[int(f[0])] = (int(f[4]) / 10 / 3600 * 15, int(f[5]) / 3600)
    return out


def separation(a, b):
    ra1, d1, ra2, d2 = (math.radians(x) for x in (*a, *b))
    c = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(ra1 - ra2)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def fetch(path_from, path_save, query=QUERY):
    if path_from:
        return Path(path_from).read_text(encoding="utf-8")
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query})
    request = urllib.request.Request(url, headers={"Accept": "text/tab-separated-values", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=170) as response:
        text = response.read().decode("utf-8")
    if path_save:
        Path(path_save).write_text(text, encoding="utf-8")
    return text


def unquote(cell):
    return re.sub(r'"(@[\w-]+)?$', "", cell[1:]) if cell.startswith('"') else cell


def groups(hrs, where):
    parent = {h: h for h in hrs}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, a in enumerate(hrs):
        for b in hrs[i + 1 :]:
            if separation(where[a], where[b]) <= LINK_DEGREES:
                parent[find(a)] = find(b)
    found = defaultdict(list)
    for h in hrs:
        found[find(h)].append(h)
    return sorted((sorted(g) for g in found.values()), key=lambda g: g[0])


def tree(hrs, where):
    """The minimum spanning tree of the stars by angle (Prim), as edges."""
    if len(hrs) < 2:
        return []
    inside = {hrs[0]}
    edges = []
    while len(inside) < len(hrs):
        best = min(((separation(where[a], where[b]), a, b) for a in inside for b in hrs if b not in inside))
        edges.append((best[1], best[2]))
        inside.add(best[2])
    return edges


def runs(edges):
    """The edges as runs of stars: each run is a chain that goes on while a star has two lines."""
    around = defaultdict(list)
    for a, b in edges:
        around[a].append(b)
        around[b].append(a)
    seen = set()
    out = []
    ends = sorted(x for x in around if len(around[x]) == 1) + sorted(x for x in around if len(around[x]) > 2)
    for start in ends:
        for nxt in around[start]:
            if (min(start, nxt), max(start, nxt)) in seen:
                continue
            chain = [start, nxt]
            seen.add((min(start, nxt), max(start, nxt)))
            while len(around[chain[-1]]) == 2:
                more = [x for x in around[chain[-1]] if (min(chain[-1], x), max(chain[-1], x)) not in seen]
                if not more:
                    break
                seen.add((min(chain[-1], more[0]), max(chain[-1], more[0])))
                chain.append(more[0])
            out.append(chain)
    return out


def plain(pinyin):
    """Pinyin with tone marks as letters and tone numbers, joined by hyphens, so the id is plain ASCII and tells apart names that differ only in tone (`běi dǒu` becomes `bei3-dou3`)."""
    tones = {"\u0304": "1", "\u0301": "2", "\u030c": "3", "\u0300": "4"}
    words = []
    for word in pinyin.split():
        letters, tone = "", ""
        for c in unicodedata.normalize("NFD", word):
            if c in tones:
                tone = tones[c]
            elif not unicodedata.combining(c):
                letters += c
        words.append(letters.lower() + tone)
    return "-".join(words)


def folded(text):
    """Letters only, lower case, accents off: `Zhinyu` and `zhī nǚ` both become plain letters to compare."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if c.isalpha() and c.isascii())


def romanized(english, pinyin):
    """Whether an English label only spells out the pinyin (ü written u, v or yu)."""
    if english in ROMANIZED:
        return True
    plain_letters = unicodedata.normalize("NFD", pinyin.lower())
    return folded(english) in {folded(plain_letters.replace("ü", x).replace("u\u0308", x)) for x in ("u", "v", "yu")}


def items(text):
    """The asterism items: Wikidata id -> (exact labels, labels without a bracketed note, English label, part of ids)."""
    out = {}
    for line in text.splitlines()[1:]:
        cells = line.split("\t")
        q = re.search(r"Q\d+", cells[0]).group(0)
        exact = {unquote(c) for c in cells[1:4] if c}
        bare = {re.sub(r"\s*[(（][^)）]*[)）]\s*$", "", x) for x in exact}
        out[q] = (exact, bare, unquote(cells[4]) if cells[4] else "", re.findall(r"Q\d+", cells[5]))
    return out


def item_of(key, hant, found):
    """The one Wikidata item named by an asterism's spellings, or None: its own two spellings first, then its other forms, then labels without their bracketed note."""
    own = {key, hant}
    every = own | {k for k, v in FORMS.items() if v == key}
    for spellings, labels in ((own, 0), (every, 0), (every, 1)):
        hits = [q for q, it in found.items() if spellings & it[labels]]
        if hits:
            return hits[0] if len(hits) == 1 else None
    return None


def main():
    args = sys.argv[1:]
    path_from = args[args.index("--from") + 1] if "--from" in args else None
    path_save = args[args.index("--save") + 1] if "--save" in args else None
    items_from = args[args.index("--items-from") + 1] if "--items-from" in args else None
    items_save = args[args.index("--items-save") + 1] if "--items-save" in args else None
    where = positions()
    text = fetch(path_from, path_save)
    labelled = items(fetch(items_from, items_save, ITEMS_QUERY))
    members = defaultdict(dict)  # key -> {number: set(hr)} for the stars of the figure
    for line in text.splitlines()[1:]:
        cells = line.split("\t")
        hr = int(re.sub(r"\D", "", unquote(cells[0])))
        if hr not in where:
            continue
        for name in [unquote(cells[1])] + [x for x in unquote(cells[2]).split("|") if x]:
            m = PATTERN.match(name)
            if not m or m.group(2):
                continue
            prefix = FORMS.get(m.group(1), m.group(1))
            if prefix in MERGE:
                prefix = MERGE[prefix]
            if prefix not in NAMES:
                continue
            members[prefix].setdefault(number(m.group(3)), set()).add(hr)
    for key, stars in SUPPLEMENT.items():
        for i, hr in enumerate(stars, 1):
            members[key].setdefault(i, set()).add(hr)
    mansion_group = {m + "宿": symbol for symbol, chars in MANSIONS.items() for m in chars}
    order = [m + "宿" for chars in MANSIONS.values() for m in chars]
    rows = []
    used = set()
    keys = [k for k in order if k in members] + sorted(k for k in members if k not in order)
    split = {key: groups(sorted(set().union(*members[key].values())), where) for key in keys}
    item = {key: item_of(key, NAMES[key][0], labelled) for key in keys if len(split[key]) == 1}
    mansion_of = {}  # Wikidata item of a mansion -> its row id; the mansions come first
    for key in keys:
        q = item.get(key)
        english = "" if q is None or romanized(labelled[q][2], NAMES[key][1]) or labelled[q][2].endswith(" in Chinese astronomy") else CAPITALS.get(labelled[q][2], labelled[q][2])
        parts = [] if q is None or key in mansion_group else [ENCLOSURES.get(x) or mansion_of.get(x) for x in labelled[q][3] if x in ENCLOSURES or x in mansion_of]
        part = parts[0] if len(parts) == 1 else ""
        for found in split[key]:
            largest = max(i for i, hrs in members[key].items() if hrs & set(found))
            missing = max(0, largest - len(found))
            hant, pinyin = NAMES[key]
            base = plain(pinyin)
            ident, n = base, 1
            while ident in used:
                n += 1
                ident = f"{base}-{n}"
            used.add(ident)
            if key in mansion_group and q is not None:
                mansion_of[q] = ident
            chains = runs(tree(found, where)) or [[found[0]]]
            if len(found) > 1 and sum(len(c) - 1 for c in chains) != len(found) - 1:
                raise SystemExit(f"lines of {key} do not join {len(found)} stars")
            covered = {h for c in chains for h in c}
            chains += [[h] for h in found if h not in covered]
            rows.append("|".join([ident, hant, key, pinyin, english, mansion_group.get(key, ""), part, str(missing), ";".join("-".join(str(h) for h in c) for c in chains)]))
    body = "\n".join(rows)
    OUT.write_text(
        "// GENERATED by scripts/make-culture-data.py. Do not edit by hand.\n"
        "// The traditional Chinese sky (the Three Enclosures and the Twenty-Eight Mansions): which Bright Star Catalogue stars carry the name of each asterism, from Wikidata (CC0), read 2026-11-09.\n"
        "// English names and part of statements from Wikidata's asterism items, read 2026-11-11.\n"
        "// One row an asterism: id | name in Traditional characters | name in Simplified characters | pinyin | English name (blank where Wikidata has none) | the Symbol a mansion belongs to (blank for any other asterism) |\n"
        "// the enclosure (purple-forbidden, supreme-palace, heavenly-market) or the id of the mansion Wikidata says it is part of (blank where it says neither) |\n"
        "// stars of the asterism that are fainter than magnitude 6.0 and so not held (at least) | chains of HR numbers, each chain a run of stars joined one to the next, chains separated by ;.\n\n"
        "/** The asterism rows, one per line. */\n"
        f"export const CHINESE_ROWS = `{body}`;\n",
        encoding="utf-8",
    )
    print(f"{len(rows)} asterisms, {sum(1 for r in rows if ';' in r or '-' in r.split('|')[-1])} with lines, {sum(1 for r in rows if r.split('|')[4])} with an English name, {sum(1 for r in rows if r.split('|')[6])} part of an enclosure or mansion")


main()
