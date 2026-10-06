/** Wardrobe catalog: tops (áo), pants (quần), shoes (giày dép). Purely cosmetic, bought with coins. */
export type Slot = 'top' | 'pants' | 'shoes';

export interface TopDef {
  id: string; slot: 'top'; name: string; price: number;
  style: 'armor' | 'shirt' | 'hoodie' | 'ninja' | 'camo';
  base: number; light: number; dark: number; trim: number; emblem: number;
  hand: number; handStyle: 'glove' | 'skin'; pattern?: 'camo' | 'stripes' | 'shine'; text?: string;
}
export interface PantsDef {
  id: string; slot: 'pants'; name: string; price: number;
  base: number; dark: number; belt: number; buckle: number;
  pattern?: 'camo' | 'stripes' | 'denim' | 'shine'; kneePad?: number;
}
export interface ShoeDef {
  id: string; slot: 'shoes'; name: string; price: number;
  style: 'boot' | 'sneaker' | 'sandal' | 'jet' | 'paw';
  base: number; sole: number; trim: number;
}
export type Item = TopDef | PantsDef | ShoeDef;

const SKIN = 0xf2c6a0;

export const TOPS: TopDef[] = [
  { id: 'top_navy', slot: 'top', name: 'Giáp Xanh Đội Trưởng', price: 0, style: 'armor', base: 0x24448c, light: 0x3c6ad0, dark: 0x16295a, trim: 0x1fb59b, emblem: 0xf08a24, hand: 0x1d6f66, handStyle: 'glove' },
  { id: 'top_red', slot: 'top', name: 'Giáp Đỏ Chiến Binh', price: 300, style: 'armor', base: 0xa82a2a, light: 0xe0504a, dark: 0x5a1414, trim: 0xf2c94c, emblem: 0xffffff, hand: 0x3a2a2a, handStyle: 'glove' },
  { id: 'top_cat', slot: 'top', name: 'Áo Nỉ "Đậu"', price: 400, style: 'shirt', base: 0xd8dce4, light: 0xf4f6fa, dark: 0x9aa2b0, trim: 0xb8bec8, emblem: 0xe0566a, hand: SKIN, handStyle: 'skin', text: 'Đậu' },
  { id: 'top_hoodie', slot: 'top', name: 'Hoodie Mèo Mướp', price: 600, style: 'hoodie', base: 0xb8bcc4, light: 0xe0e4ea, dark: 0x7a808c, trim: 0x8a909c, emblem: 0xf4a0b0, hand: SKIN, handStyle: 'skin', pattern: 'stripes' },
  { id: 'top_camo', slot: 'top', name: 'Áo Rằn Ri Đặc Nhiệm', price: 500, style: 'camo', base: 0x5a6a3a, light: 0x7a8a4a, dark: 0x3a4424, trim: 0x2a3018, emblem: 0xf2c94c, hand: 0x2a2a22, handStyle: 'glove', pattern: 'camo' },
  { id: 'top_ninja', slot: 'top', name: 'Áo Ninja Bóng Đêm', price: 800, style: 'ninja', base: 0x24242e, light: 0x3a3a48, dark: 0x111118, trim: 0xc0392b, emblem: 0xc0392b, hand: 0x1a1a22, handStyle: 'glove' },
  { id: 'top_gold', slot: 'top', name: 'Giáp Hoàng Kim', price: 1500, style: 'armor', base: 0xd8a020, light: 0xffe070, dark: 0x8a5a10, trim: 0xffffff, emblem: 0xc0392b, hand: 0xb07818, handStyle: 'glove', pattern: 'shine' },
];

export const PANTS: PantsDef[] = [
  { id: 'pants_navy', slot: 'pants', name: 'Quần Giáp Xanh', price: 0, base: 0x2f55a8, dark: 0x1a3270, belt: 0x7a4a26, buckle: 0xf2c94c, kneePad: 0x16295a },
  { id: 'pants_jeans', slot: 'pants', name: 'Quần Jean Bụi', price: 200, base: 0x4a6aa8, dark: 0x2a3e6a, belt: 0x5a3a1e, buckle: 0xc0c8d0, pattern: 'denim' },
  { id: 'pants_camo', slot: 'pants', name: 'Quần Rằn Ri', price: 300, base: 0x5a6a3a, dark: 0x3a4424, belt: 0x2a3018, buckle: 0xb0b080, pattern: 'camo', kneePad: 0x2a3018 },
  { id: 'pants_cat', slot: 'pants', name: 'Quần Mèo Mướp', price: 400, base: 0xc0c4cc, dark: 0x80868f, belt: 0xe0566a, buckle: 0xffffff, pattern: 'stripes' },
  { id: 'pants_black', slot: 'pants', name: 'Quần Tactical Đen', price: 450, base: 0x2a2a32, dark: 0x16161c, belt: 0x4a4a54, buckle: 0xc0392b, kneePad: 0x3a3a44 },
  { id: 'pants_gold', slot: 'pants', name: 'Quần Giáp Hoàng Kim', price: 1000, base: 0xd8a020, dark: 0x8a5a10, belt: 0x5a3a10, buckle: 0xffffff, pattern: 'shine', kneePad: 0xffe070 },
];

export const SHOES: ShoeDef[] = [
  { id: 'shoes_boot', slot: 'shoes', name: 'Ủng Chiến Đấu', price: 0, style: 'boot', base: 0x2a2236, sole: 0x0d0f1a, trim: 0xf08a24 },
  { id: 'shoes_sandal', slot: 'shoes', name: 'Dép Tổ Ong', price: 100, style: 'sandal', base: 0xdfeaf2, sole: 0x7ab0d8, trim: 0x5a8ab0 },
  { id: 'shoes_sneaker', slot: 'shoes', name: 'Giày Thể Thao Đỏ', price: 250, style: 'sneaker', base: 0xd83a3a, sole: 0xf4f4f4, trim: 0xffffff },
  { id: 'shoes_paw', slot: 'shoes', name: 'Dép Chân Mèo', price: 350, style: 'paw', base: 0xeeeeee, sole: 0xb8bcc4, trim: 0xf4a0b0 },
  { id: 'shoes_gold', slot: 'shoes', name: 'Giày Hoàng Kim', price: 700, style: 'boot', base: 0xd8a020, sole: 0x5a3a10, trim: 0xffffff },
  { id: 'shoes_jet', slot: 'shoes', name: 'Giày Phản Lực', price: 1200, style: 'jet', base: 0x8a96a8, sole: 0x3a4250, trim: 0x35d0ff },
];

export const ALL_ITEMS: Item[] = [...TOPS, ...PANTS, ...SHOES];
export const itemById = (id: string) => ALL_ITEMS.find(i => i.id === id);

export interface Outfit { top: TopDef; pants: PantsDef; shoes: ShoeDef; }
export function resolveOutfit(o: { top: string; pants: string; shoes: string }): Outfit {
  return {
    top: TOPS.find(t => t.id === o.top) ?? TOPS[0],
    pants: PANTS.find(t => t.id === o.pants) ?? PANTS[0],
    shoes: SHOES.find(t => t.id === o.shoes) ?? SHOES[0],
  };
}
