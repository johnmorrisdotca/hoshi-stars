// Traditional Japanese star names and figures (和名), as Bright Star Catalogue (HR) numbers. Which star or shape each name is for is a fact; the names, readings and the stars they name are read from the pages credited in NOTICE.md,
// and the lines are our own joins. The 88 constellations with their Japanese names are the constellations table's (`src/data/constellations.ts`), not repeated here.
// One row a figure: id | name | hiragana reading | romaji | other names, separated by / | English words on what it is | chains of HR numbers, a chain a run of stars joined one to the next, separated by ;

/** The figure rows, one per line. */
export const JAPANESE_ROWS = `subaru|昴|すばる|Subaru|六連星/むつらぼし|the Pleiades|1145-1149-1142-1156-1165-1178
hokuto-shichisei|北斗七星|ほくとしちせい|Hokuto Shichisei|七つ星/ななつぼし/四三の星/しそうのほし|the Big Dipper|4301-4295-4554-4660-4301;4660-4905-5054-5191
mitsuboshi|三つ星|みつぼし|Mitsuboshi||Orion's belt|1852-1903-1948
tsuzumi-boshi|鼓星|つづみぼし|Tsuzumi-boshi||Orion, seen as an hourglass drum|1790-2061-1948-2004-1713-1852-1790;1852-1903-1948
genji-boshi|源氏星|げんじぼし|Genji-boshi||Rigel, the white star of Orion|1713
heike-boshi|平家星|へいけぼし|Heike-boshi||Betelgeuse, the red star of Orion|2061
orihime|織姫|おりひめ|Orihime|織女/織女星/しょくじょ/しょくじょせい|Vega, the weaver of the Tanabata tale|7001
hikoboshi|彦星|ひこぼし|Hikoboshi|牽牛星/けんぎゅうせい|Altair, the herdsman of the Tanabata tale|7557
yamagata-boshi|山形星|やまがたぼし|Yamagata-boshi|錨星/いかりぼし|Cassiopeia, the W|21-168-264-403-542
masugata-boshi|枡形星|ますがたぼし|Masugata-boshi|四隅星/よつまぼし|the Great Square of Pegasus|8781-8775-15-39-8781
yotsu-boshi|四つ星|よつぼし|Yotsu-boshi||Corvus, the four stars|4630-4662-4757-4786-4630
mugi-boshi|麦星|むぎぼし|Mugi-boshi||Arcturus, the barley star|5340
shinju-boshi|真珠星|しんじゅぼし|Shinju-boshi||Spica, the pearl star|5056
hitotsu-boshi|一つ星|ひとつぼし|Hitotsu-boshi|青星/あおぼし/大星/おおぼし|Sirius|2491
futatsu-boshi|二つ星|ふたつぼし|Futatsu-boshi||Castor and Pollux, the twin stars|2891-2990
gokaku-boshi|五角星|ごかくぼし|Gokaku-boshi||the pentagon of Auriga|1708-2088-2095-1791-1577-1708
tsurigane-boshi|釣鐘星|つりがねぼし|Tsurigane-boshi||Aldebaran, the hanging bell|1457
hokkyokusei|北極星|ほっきょくせい|Hokkyokusei||Polaris, the pole star|424`;
