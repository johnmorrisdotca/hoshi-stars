// A few facts about each of the 88 constellations that the star tables do not hold, typed by hand (facts, in our own words; no text is copied from any book, atlas or web page). Sources and the date read: NOTICE.md.
// ORIGINS: who made the constellation and when. Codes: p Ptolemy (the Almagest, about AD 150), a a part of Ptolemy's Argo Navis (split by Lacaille, 1756), v the southern constellations of the voyages (Keyser and
// de Houtman, 1595 to 1597), l Lacaille (1756), h Hevelius (1687), c d e Plancius (1592, 1612, 1598), f Vopel (1536).
export const ORIGINS = `p|ancient|150|Ptolemy|プトレマイオス
a|ancient|150|Ptolemy (as part of Argo Navis; Lacaille split it in 1756)|プトレマイオス (アルゴ座の一部。1756年にラカイユが分けた)
v|voyages|1597|Keyser and de Houtman|カイザーとデ・ハウトマン
l|modern|1756|Lacaille|ラカイユ
h|early|1687|Hevelius|ヘベリウス
c|early|1592|Plancius|プランシウス
d|early|1612|Plancius|プランシウス
e|early|1598|Plancius|プランシウス
f|early|1536|Vopel|ヴォペル`;

// One row a constellation: abbreviation | origin code | what the name means, in Japanese (a short everyday phrase, our own translation of the English meaning).
export const FACT_ROWS = `And|p|鎖につながれた王女
Ant|l|空気ポンプ
Aps|v|極楽鳥
Aqr|p|水がめを持つ人
Aql|p|ワシ
Ara|p|祭壇
Ari|p|雄ひつじ
Aur|p|馬車を操る人
Boo|p|牛を追う人
Cae|l|彫刻の道具
Cam|d|キリン
Cnc|p|カニ
CVn|h|2ひきの猟犬
CMa|p|大きな犬
CMi|p|小さな犬
Cap|p|海のヤギ
Car|a|船の竜骨 (底の骨組み)
Cas|p|いすに座った女王
Cen|p|半人半馬
Cep|p|王さま
Cet|p|海の怪物
Cha|v|カメレオン
Cir|l|コンパス
Col|c|ハト
Com|f|ベレニケの髪
CrA|p|南の冠
CrB|p|北の冠
Crv|p|カラス
Crt|p|杯
Cru|e|南の十字
Cyg|p|白鳥
Del|p|イルカ
Dor|v|カジキ
Dra|p|竜
Equ|p|子馬
Eri|p|川
For|l|化学の炉
Gem|p|双子
Gru|v|ツル
Her|p|英雄ヘルクレス
Hor|l|振り子時計
Hya|p|雌の海ヘビ
Hyi|v|雄の水ヘビ
Ind|v|インディアン
Lac|h|トカゲ
Leo|p|ライオン
LMi|h|小さなライオン
Lep|p|ウサギ
Lib|p|天びん
Lup|p|オオカミ
Lyn|h|ヤマネコ
Lyr|p|たて琴
Men|l|テーブル山
Mic|l|顕微鏡
Mon|d|一角獣
Mus|v|ハエ
Nor|l|直角定規
Oct|l|八分儀
Oph|p|ヘビを持つ人
Ori|p|狩人
Pav|v|クジャク
Peg|p|翼のある馬
Per|p|英雄ペルセウス
Phe|v|不死鳥
Pic|l|画家のイーゼル
Psc|p|2ひきの魚
PsA|p|南の魚
Pup|a|船のとも
Pyx|l|船の羅針盤
Ret|l|十字線
Sge|p|矢
Sgr|p|射手
Sco|p|サソリ
Scl|l|彫刻家の仕事場
Sct|h|盾
Ser|p|ヘビ
Sex|h|六分儀
Tau|p|雄牛
Tel|l|望遠鏡
Tri|p|三角形
TrA|v|南の三角形
Tuc|v|オオハシ
UMa|p|大きなクマ
UMi|p|小さなクマ
Vel|a|船の帆
Vir|p|乙女
Vol|v|トビウオ
Vul|h|子ギツネ`;

// ASTERISMS: a well-known pattern of stars that is not a constellation. English name | Japanese name | the constellations it uses, by abbreviation (a pattern across several is listed under each).
export const ASTERISM_ROWS = `Big Dipper (the Plough)|北斗七星|UMa
Little Dipper|小北斗|UMi
Orion's Belt|オリオンの三つ星|Ori
Northern Cross|北十字|Cyg
Summer Triangle|夏の大三角|Lyr,Cyg,Aql
Winter Triangle|冬の大三角|CMa,CMi,Ori
Winter Hexagon|冬のダイヤモンド|CMa,CMi,Gem,Aur,Tau,Ori
Spring Triangle|春の大三角|Boo,Vir,Leo
Spring Arc|春の大曲線|UMa,Boo,Vir
Spring Diamond|春のダイヤモンド|Boo,CVn,Vir,Leo
Great Square of Pegasus|秋の四辺形|Peg,And
Teapot|ティーポット|Sgr
Southern Dipper (Milk Dipper)|南斗六星|Sgr
The Sickle|ししの大がま|Leo
Keystone|キーストーン|Her
Circlet|うおのわっか|Psc
Water Jar|水がめ (Yの字)|Aqr
Coathanger|コートハンガー|Vul
Fish Hook|さそりの釣り針|Sco
False Cross|にせ十字|Car,Vel
Job's Coffin|ヨブの棺|Del
Pointers|南のポインター|Cen
The W|Wの字|Cas`;

// METEOR SHOWERS: the shower's IAU name in English | in Japanese | the usual peak (month-day; it shifts by a day or so from year to year) | the constellation its radiant lies in (the point the meteors seem to come from).
export const SHOWER_ROWS = `Quadrantids|しぶんぎ座流星群|01-04|Boo
Lyrids|こと座流星群|04-22|Lyr
Eta Aquariids|みずがめ座η流星群|05-06|Aqr
Southern Delta Aquariids|みずがめ座δ南流星群|07-30|Aqr
Alpha Capricornids|やぎ座α流星群|07-30|Cap
Perseids|ペルセウス座流星群|08-12|Per
Draconids|りゅう座流星群|10-08|Dra
Orionids|オリオン座流星群|10-21|Ori
Taurids|おうし座流星群|11-05|Tau
Leonids|しし座流星群|11-17|Leo
Geminids|ふたご座流星群|12-14|Gem
Ursids|こぐま座流星群|12-22|UMi`;
