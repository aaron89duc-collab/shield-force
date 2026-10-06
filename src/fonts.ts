// Bundled webfonts with full Vietnamese coverage (diacritics such as Ầ Ữ Ợ render and stack correctly).
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/700.css';

export const FONT_TITLE = "'Baloo 2', 'Be Vietnam Pro', sans-serif";
export const FONT_BODY = "'Be Vietnam Pro', 'Baloo 2', sans-serif";
/** Taller-than-Latin sample used by Phaser to measure ascent/descent so stacked Vietnamese marks are not clipped. */
export const TEST_STRING = '|MÉqgyẦỮỢỄẬỴ';

/** Wait (max ~3 s) for the fonts so canvas/text objects never render with a fallback font. */
export async function loadFonts() {
  const sample = 'Đậu Đội trưởng Mỹ ẦỮỢ';
  const loads = [
    `800 32px 'Baloo 2'`, `600 20px 'Baloo 2'`, `400 16px 'Be Vietnam Pro'`, `700 16px 'Be Vietnam Pro'`,
  ].map(f => document.fonts.load(f, sample).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 3000))]);
}
