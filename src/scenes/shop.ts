import Phaser from 'phaser';
import { buildHeroPortrait, buildHeroTextures, HERO_FX, HERO_FY, HERO_H, HERO_W } from '../art/hero';
import { Item, PANTS, resolveOutfit, SHOES, Slot, TOPS } from '../art/outfits';
import { persist, save } from '../systems/save';
import { play, Sfx } from '../systems/sound';
import { backdrop, button, Btn, FONT, FONT2, header, initCam, panel, txt, VH, VW } from './ui';

const TABS: { slot: Slot; label: string; items: Item[] }[] = [
  { slot: 'top', label: 'ÁO', items: TOPS },
  { slot: 'pants', label: 'QUẦN', items: PANTS },
  { slot: 'shoes', label: 'GIÀY DÉP', items: SHOES },
];

/** Wardrobe shop: buy and wear tops / pants / shoes with coins. Try-on preview before buying. */
export class ShopScene extends Phaser.Scene {
  private tab = 0;
  private selected: Item | null = null;
  private grid: Phaser.GameObjects.GameObject[] = [];
  private preview!: Phaser.GameObjects.Image;
  private nameT!: Phaser.GameObjects.Text;
  private infoT!: Phaser.GameObjects.Text;
  private action!: Btn;
  private setCoins!: (v: number) => void;
  private tabBtns: Btn[] = [];
  private toastT!: Phaser.GameObjects.Text;

  constructor() { super('Shop'); }

  create() {
    initCam(this);
    const W = VW(this), H = VH(this);
    backdrop(this, 0, 0.55);
    this.setCoins = header(this, 'TỦ ĐỒ');
    this.grid = []; this.tabBtns = [];
    this.selected = null;

    // preview panel
    const px = 178;
    panel(this, px, 300, 320, 430);
    const g = this.add.graphics();
    g.fillStyle(0x1fb59b, 0.12); g.fillCircle(px, 270, 120);
    g.fillStyle(0x000000, 0.45); g.fillEllipse(px, 386, 150, 20);
    this.preview = this.add.image(px, 388, 'hero_portrait').setOrigin(HERO_FX / HERO_W, HERO_FY / HERO_H);
    this.preview.setScale(this.preview.scaleX * 0.86);
    this.nameT = this.add.text(px, 420, '', { fontFamily: FONT, fontSize: '17px', color: '#ffe28a', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5);
    this.infoT = this.add.text(px, 446, '', { fontFamily: FONT2, fontSize: '13px', color: '#9fb0d0', align: 'center' }).setOrigin(0.5);
    this.action = button(this, px, 488, 270, 50, '', () => this.doAction(), 0xe8a13b, 20);

    // tabs
    const gx0 = 350, gw = W - gx0 - 16;
    TABS.forEach((t, i) => {
      const bw = Math.min(150, (gw - 20) / 3);
      const b = button(this, gx0 + bw / 2 + i * (bw + 10), 110, bw, 44, t.label, () => { this.tab = i; this.selected = null; this.refresh(); }, 0x2b6fb3, 18);
      this.tabBtns.push(b);
    });
    this.toastT = this.add.text(W / 2, H - 20, '', { fontFamily: FONT, fontSize: '16px', color: '#ff8a7a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(10);
    this.refresh();
  }

  private outfitWith(item: Item | null) {
    const o = { ...save.outfit };
    if (item) o[item.slot] = item.id;
    return resolveOutfit(o);
  }

  private rebuildPreview() {
    buildHeroPortrait(this, 'hero_preview', 2.4, 'hero', this.outfitWith(this.selected));
    this.preview.setTexture('hero_preview');
  }

  private refresh() {
    for (const o of this.grid) o.destroy();
    this.grid = [];
    const W = VW(this);
    const tab = TABS[this.tab];
    this.tabBtns.forEach((b, i) => b.box.setTint(i === this.tab ? 0xe8553b : 0x2b6fb3));
    const gx0 = 350, gw = W - gx0 - 16, cols = 4;
    const cw = gw / cols, chh = 168;
    const cur = resolveOutfit(save.outfit);
    tab.items.forEach((it, i) => {
      const x = gx0 + cw * (i % cols) + cw / 2, y = 228 + Math.floor(i / cols) * (chh + 12);
      const owned = save.owned.includes(it.id);
      const worn = save.outfit[it.slot] === it.id;
      const sel = this.selected?.id === it.id;
      const g = this.add.graphics();
      const w = cw - 12, l = x - w / 2, t = y - chh / 2;
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(l + 2, t + 5, w, chh, 14);
      g.fillGradientStyle(0x24305a, 0x24305a, 0x0e1428, 0x0e1428, 0.95); g.fillRoundedRect(l, t, w, chh, 14);
      g.lineStyle(sel ? 4 : 2.5, sel ? 0xffffff : worn ? 0xf2c94c : owned ? 0x2bd6b4 : 0x4a5070, 1); g.strokeRoundedRect(l, t, w, chh, 14);
      g.fillStyle(0xffffff, 0.06); g.fillCircle(x, t + 62, 44);
      this.grid.push(g);
      // icon: hero wearing this item
      const key = `icon_${it.id}`;
      const o = { ...cur }; (o as any)[it.slot] = it; // item over the current outfit
      buildHeroPortrait(this, key, 0.8, 'idle', o);
      const icon = this.add.image(x, t + 106, key).setOrigin(HERO_FX / HERO_W, HERO_FY / HERO_H);
      this.grid.push(icon);
      this.grid.push(this.add.text(x, t + 124, it.name, { fontFamily: FONT2, fontSize: '12px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: w - 10 }, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0));
      const status = worn ? 'ĐANG MẶC' : owned ? 'ĐÃ CÓ' : it.price === 0 ? 'MIỄN PHÍ' : `● ${it.price}`;
      this.grid.push(txt(this, x, t + chh - 14, status, 13, worn ? '#f2c94c' : owned ? '#2bd6b4' : '#ffe28a'));
      const z = this.add.zone(x, y, w, chh).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { play(Sfx.CLICK); this.selected = it; this.refresh(); });
      this.grid.push(z);
    });
    this.rebuildPreview();
    // info + action button
    const s = this.selected;
    if (!s) {
      this.nameT.setText('Trang phục hiện tại');
      this.infoT.setText(`${cur.top.name}\n${cur.pants.name} • ${cur.shoes.name}`);
      this.action.setText('Chọn một món đồ'); this.action.setEnabled(false);
    } else {
      const owned = save.owned.includes(s.id), worn = save.outfit[s.slot] === s.id;
      this.nameT.setText(s.name);
      this.infoT.setText(worn ? 'Đang mặc' : owned ? 'Đã sở hữu — mặc thử ngay' : 'Đang thử đồ (xem trước)');
      if (worn) { this.action.setText('ĐANG MẶC'); this.action.setEnabled(false); }
      else if (owned) { this.action.setText('MẶC VÀO'); this.action.setEnabled(true); this.action.box.setTint(0x22a08c); }
      else { this.action.setText(`MUA  ● ${s.price}`); this.action.setEnabled(true); this.action.box.setTint(save.coins >= s.price ? 0xe8a13b : 0x7a5a3a); }
    }
    this.setCoins(save.coins);
  }

  private doAction() {
    const s = this.selected;
    if (!s) return;
    if (!save.owned.includes(s.id)) {
      if (save.coins < s.price) { play(Sfx.HURT); this.toast(`Chưa đủ xu! Cần thêm ${s.price - save.coins} xu`); return; }
      save.coins -= s.price;
      save.owned.push(s.id);
      play(Sfx.PICKUP);
      this.toast(`Đã mua ${s.name}!`, '#7fffe0');
    } else play(Sfx.CHECKPOINT);
    save.outfit[s.slot] = s.id;
    persist();
    const o = resolveOutfit(save.outfit);
    buildHeroTextures(this, o);
    buildHeroPortrait(this, 'hero_portrait', 2.4, 'hero', o);
    this.refresh();
  }

  private toast(s: string, color = '#ff8a7a') {
    this.toastT.setText(s).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toastT);
    this.tweens.add({ targets: this.toastT, alpha: 0, delay: 1600, duration: 500 });
  }
}

export { VH };
