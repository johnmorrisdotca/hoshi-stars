// The Western asterisms: the well-known shapes of bright stars that are not constellations or that cross several of them (the Big Dipper, the Summer Triangle), as Bright Star Catalogue (HR) numbers.
// Which stars make each shape is common knowledge, checked against the catalogue's own Bayer letters in `test/cultures.test.ts`; the lines are our own joins, not copied from a book, an atlas or another program's files.
// One row an asterism: id | English name | Japanese name (blank where the usual Japanese name is not sure) | hiragana reading of it | English words on what it is | chains of HR numbers, a chain a run of stars joined one to the next, separated by ;

/** The asterism rows, one per line. */
export const WESTERN_ASTERISM_ROWS = `big-dipper|Big Dipper|北斗七星|ほくとしちせい|the seven bright stars of the Great Bear|4301-4295-4554-4660-4301;4660-4905-5054-5191
little-dipper|Little Dipper|||the Little Bear's seven stars, ending at Polaris|424-6789-6322-5903-6116-5735-5563-5903
pointers|The Pointers|指極星|しきょくせい|Dubhe and Merak, which point to Polaris|4295-4301-424
summer-triangle|Summer Triangle|夏の大三角|なつのだいさんかく|Vega, Altair and Deneb|7001-7557-7924-7001
winter-triangle|Winter Triangle|冬の大三角|ふゆのだいさんかく|Betelgeuse, Sirius and Procyon|2061-2491-2943-2061
winter-hexagon|Winter Hexagon|冬のダイヤモンド|ふゆのだいやもんど|Capella, Aldebaran, Rigel, Sirius, Procyon and Pollux|1708-1457-1713-2491-2943-2990-1708
spring-triangle|Spring Triangle|春の大三角|はるのだいさんかく|Arcturus, Spica and Denebola|5340-5056-4534-5340
diamond-of-virgo|Diamond of Virgo|春のダイヤモンド|はるのだいやもんど|Arcturus, Spica, Denebola and Cor Caroli|5340-5056-4534-4915-5340
spring-arc|Spring Arc|春の大曲線|はるのだいきょくせん|the Dipper's handle curving on to Arcturus and Spica|4905-5054-5191-5340-5056
great-square|Great Square of Pegasus|秋の四辺形|あきのしへんけい|Markab, Scheat, Algenib and Alpheratz|8781-8775-15-39-8781
northern-cross|Northern Cross|北十字|きたじゅうじ|the stars of Cygnus the Swan|7924-7796-7417;7528-7796-7949
teapot|Teapot|ティーポット|てぃーぽっと|the brightest stars of Sagittarius|6746-6879-7194-7234-7121-7039-6913-6859-6879
sickle|Sickle of Leo|獅子の大鎌|ししのおおがま|Regulus curving up to Epsilon Leonis|3982-3975-4057-4031-3905-3873
keystone|Keystone|||the four stars of Hercules' body|6212-6220-6418-6324-6212
kids|The Kids|||three faint stars beside Capella|1605-1612-1641-1605
orions-belt|Orion's Belt|オリオンの三つ星|おりおんのみつぼし|Mintaka, Alnilam and Alnitak|1852-1903-1948
cen-pointers|Pointers of Centaurus|||Alpha and Beta Centauri, which point to the Southern Cross|5267-5459`;
