# Shield Force — web game (Phaser 3 + TypeScript)

2D side-scrolling run-and-gun / action platformer theo GDD v1.0, chạy trên trình duyệt (ưu tiên điện thoại Android, màn hình ngang) và deploy lên Vercel.

- 10 màn, mỗi màn có boss (màn 9 là boss rush 3 mini-boss, màn 10 Overlord 3 phase)
- 17 loại quái, 9 boss với telegraph, phase 66%/33% (hoặc 50% với boss 2 phase), weak point
- Khiên: Shield Shot (auto-fire), Shield Throw (boomerang), Ricochet (kéo lên + SHIELD), Block / Perfect Block (phản đạn), Shield Smash, Ultimate
- Power-up S/D/T/P/B/H/U/C, checkpoint, hồi sinh không giới hạn, không Game Over
- Nâng cấp 5 chỉ số × 5 cấp bằng xu, lưu tiến trình bằng `localStorage`
- Điều khiển cảm ứng (joystick nổi + 5 nút, đa điểm chạm, 3 kiểu bố cục) và bàn phím
- Đồ họa v1.1: sprite vẽ bằng Canvas2D ở độ phân giải 2× (đổ bóng cel-shading, viền đen kiểu sticker), nền 4 lớp parallax, đạo cụ trang trí theo từng màn, hiệu ứng lửa đầu nòng / nổ / phát sáng cộng màu, HUD có ảnh chân dung
- Nhân vật chính: đầu lấy từ ảnh chân dung `public/hero-head.png`, thân chiến binh chibi thiết kế nguyên bản
- Âm thanh được tạo bằng code (không dùng asset bản quyền)

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173 (mở bằng IP LAN trên điện thoại để test cảm ứng)
npm run build      # typecheck + build ra dist/
npm run preview
```

## Deploy lên Vercel

**Cách 1 — CLI**

```bash
npm i -g vercel
vercel login
vercel --prod
```

**Cách 2 — GitHub**: push repo lên GitHub → vercel.com → *Add New Project* → import repo. Vercel tự nhận `vercel.json` (framework Vite, build `npm run build`, output `dist`).

Trên Android: mở link bằng Chrome → menu ⋮ → *Thêm vào màn hình chính* để chơi toàn màn hình như app (có `manifest.webmanifest`, khóa hướng ngang).

## Điều khiển

| Cảm ứng | Bàn phím | Hành động |
|---|---|---|
| Joystick trái | ← → / A D | Di chuyển; kéo xuống = ngồi; kéo lên = ngắm lên/chéo |
| FIRE (giữ) | J / X | Shield Shot liên tục |
| JUMP | K / Space / Z | Nhảy, nhấn lần 2 trên không = nhảy đôi; ngồi + JUMP trên bục = xuống bục |
| SHIELD chạm nhanh | L / C | Ném khiên (boomerang). Kéo lên + SHIELD = khiên nảy (ricochet) |
| SHIELD giữ | giữ L | Đỡ đòn phía trước. Đỡ trong 0.12s trước khi trúng = **Perfect Block** (phản đạn, +10% Ultimate) |
| SMASH | U / V | Lướt húc khiên (60 dmg, đánh bật) |
| SPECIAL | I / B | Ultimate khi thanh tím đầy |
| Nút II | Esc / P | Tạm dừng |

## Cấu trúc

```
src/
  main.ts                 Phaser config, scale (cao 540px, rộng theo tỉ lệ màn hình), auto-pause
  game/                   Logic thuần TS (không phụ thuộc Phaser)
    world.ts              LevelManager: camera, va chạm, đạn, checkpoint, boss gate, pickup, hazard
    player.ts             Player (movement/state) + Shield (OUTBOUND → RETURN → CATCH)
    enemy.ts              17 loại quái + FSM
    boss.ts               9 boss: phase, attack pattern, telegraph, weak point
    level.ts, levels.ts   DSL dựng màn + 10 màn thiết kế tay
    entities.ts           Body/Solid/Proj/Hazard/Pickup/Warn
  scenes/                 Boot, Menu, LevelSelect, Upgrade, Settings, Credits, Game, HUD
  systems/                save (localStorage), sound (WebAudio synth), controls (touch + keyboard)
  art/                    pen.ts (Canvas2D + outline), textures.ts (nhân vật/quái/boss/UI), themes.ts (nền, địa hình, đạo cụ)
public/hero-head.png      Ảnh đầu nhân vật chính — thay file này (PNG nền trong suốt, tỉ lệ ~297×360) để đổi mặt
```

Thông số chính lấy từ GDD: HP 100, speed 5 u/s, jump 11, gravity 25, Shot 10 dmg/0.15s, Throw 35/2.0s, Ricochet 45/2.2s, Smash 60/4.0s, Ultimate 150, hurt i-frame 0.7s, respawn i-frame 2s, bảng nâng cấp §12, HP quái §7 và boss §10.
Điều chỉnh cân bằng ngoài GDD: đạn Double/Triple gây 50% sát thương lên boss (để trận boss không kết thúc trong vài giây).

## Test tự động

- `?level=N&bot&god&speed=8` — bot tự chơi màn N (chỉ dùng để kiểm thử)
- `?sheet=hero_` — xem toàn bộ sprite theo tiền tố (`e_` quái, `b_` boss, `pr_` đạn)
- `npm run test:sim` — chạy bot headless qua cả 10 màn

## Lưu ý IP

Bản này dùng nhân vật và khiên thiết kế nguyên bản (không dùng hình ảnh/tên Marvel). Nếu muốn dùng IP Captain America cho bản phát hành cần có license.
