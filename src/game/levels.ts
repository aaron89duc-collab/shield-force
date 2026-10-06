import { E } from './enemy';
import { BOSSES } from './boss';
import { HZ, PU } from './entities';
import { Level } from './level';

/**
 * The 10 levels (GDD §9). Structure per §9.1:
 * Start → 3–5 combat/platform segments → checkpoint → 1–3 segments → boss gate → boss → reward.
 */
export const LEVEL_INFO = [
  { name: 'City Under Attack', place: 'Thành phố đêm', boss: 'Iron Beast' },
  { name: 'Abandoned Factory', place: 'Nhà máy bỏ hoang', boss: 'Mecha Titan' },
  { name: 'Dark Forest', place: 'Rừng tối', boss: 'Forest Beast' },
  { name: 'Desert Base', place: 'Căn cứ sa mạc', boss: 'Sand Worm' },
  { name: 'Ice Mountain', place: 'Núi băng', boss: 'Frozen Golem' },
  { name: 'Underground Lab', place: 'Phòng thí nghiệm ngầm', boss: 'Bio-Titan' },
  { name: 'Volcanic World', place: 'Thế giới núi lửa', boss: 'Lava Dragon' },
  { name: 'Alien Planet', place: 'Hành tinh lạ', boss: 'Alien Queen' },
  { name: 'Dark Fortress', place: 'Pháo đài bóng tối', boss: '3 Mini-boss' },
  { name: 'Final War', place: 'Căn cứ cuối cùng', boss: 'Overlord' },
];

export function buildLevel(n: number): Level {
  const info = LEVEL_INFO[n - 1];
  const L = new Level(n, info.name, info.place, n - 1);
  L.reward = 100 + n * 20;
  switch (n) {
    case 1: level1(L); break;
    case 2: level2(L); break;
    case 3: level3(L); break;
    case 4: level4(L); break;
    case 5: level5(L); break;
    case 6: level6(L); break;
    case 7: level7(L); break;
    case 8: level8(L); break;
    case 9: level9(L); break;
    default: level10(L); break;
  }
  return L.finish();
}

/** Level 1 — vertical slice reference (GDD §11). */
function level1(L: Level) {
  // Start: tutorial movement + 2 Mutant
  L.ground(-4, 46);
  L.hint(3, 'Kéo cần bên trái để chạy • Phím: ← → / A D');
  L.hint(9, 'JUMP để nhảy — nhấn thêm lần nữa trên không để NHẢY ĐÔI');
  L.hint(15, 'Giữ FIRE để bắn liên tục • Kéo cần lên để bắn chéo / lên trời');
  L.many(E.MUTANT, [16, 21]);
  L.coins(10, 8.6, 4);
  // S1: street — 3 Mutant + 1 Drone
  L.hint(24, 'Chạm SHIELD: ném khiên (boomerang) • Kéo lên + SHIELD: khiên nảy');
  L.prop('car', 30); L.block(30, 9.1, 2.6, 0.9);
  L.plat(34, 7.4, 3.5);
  L.pk(PU.DOUBLE, 35.7, 6.6);
  L.many(E.MUTANT, [28, 33, 40]); L.e(E.DRONE, 37, 6);
  L.hint(42, 'Giữ SHIELD để ĐỠ đạn phía trước — đỡ đúng lúc = PHẢN ĐẠN');
  // S2: explosive barrels — 2 Shield Soldier + 2 Mutant
  L.ground(46, 74);
  L.barrel(50); L.barrel(51);
  L.hint(48, 'Bắn thùng nổ để hạ quái xung quanh');
  L.e(E.SHIELDER, 55); L.many(E.MUTANT, [58, 62]); L.e(E.SHIELDER, 68);
  L.hint(56, 'Lính khiên chặn đạn phía trước: dùng SMASH, ném khiên hoặc bắn từ phía sau');
  L.barrel(66); L.crate(71);
  L.coins(76, 7.4, 4, 0.8);
  // checkpoint
  L.ground(78, 98); L.cp(80);
  // S3: overpass — 4 Mutant + 2 Drone
  L.ground(98, 120, 8); L.prop('pillar', 100, 8); L.prop('pillar', 114, 8);
  L.many(E.MUTANT, [92, 104, 110, 116], 10); L.spawns[L.spawns.length - 3].y = 8; L.spawns[L.spawns.length - 2].y = 8; L.spawns[L.spawns.length - 1].y = 8;
  L.e(E.DRONE, 102, 4); L.e(E.DRONE, 112, 4);
  L.pk(PU.ULT, 108, 6.5);
  L.hint(118, 'Thanh tím đầy → bấm SPECIAL: đòn tối thượng');
  // S4: mini encounter — Shield Soldier + Drone
  L.ground(123, 150);
  L.e(E.SHIELDER, 132); L.e(E.DRONE, 136, 5); L.barrel(128);
  L.pk(PU.HEALTH, 140, 8.6);
  L.arena(153, { type: BOSSES.IRON_BEAST });
}

function level2(L: Level) {
  L.ground(-4, 30);
  L.many(E.ROBOT, [18, 27]); L.e(E.BUG, 23);
  L.coins(8, 8.6, 5);
  L.belt(30, 46, -2.2);
  L.hint(31, 'Băng chuyền đẩy bạn — chạy ngược hoặc nhảy');
  L.many(E.BUG, [38, 44]); L.e(E.DRONE, 40, 5);
  L.ground(46, 70);
  L.hz(HZ.CRUSHER, 52, 2.5, 1.8, 7.5, 2.6, 0);
  L.hz(HZ.CRUSHER, 60, 2.5, 1.8, 7.5, 2.6, 1.3);
  L.hint(48, 'Máy nghiền! Chờ nó nâng lên rồi chạy qua');
  L.e(E.ROBOT, 66); L.crate(56); L.pk(PU.TRIPLE, 64, 6.2); L.plat(62, 7.2, 4);
  L.ground(74, 96); L.cp(76);
  L.many(E.BUG, [84, 88, 92]); L.e(E.SHIELDER, 94); L.barrel(86);
  L.belt(96, 116, 2.5);
  L.e(E.ROBOT, 106); L.e(E.ROBOT, 114); L.e(E.DRONE, 110, 5);
  L.plat(100, 7, 3); L.plat(108, 6, 3); L.coins(108.4, 5.2, 3);
  L.ground(116, 140);
  L.hz(HZ.CRUSHER, 122, 2.5, 1.8, 7.5, 2.2, 0.5);
  L.many(E.BUG, [128, 131]); L.e(E.ROBOT, 136); L.e(E.MUTANT, 133);
  L.ground(143, 152);
  L.pk(PU.HEALTH, 147, 8.6);
  L.arena(155, { type: BOSSES.MECHA_TITAN });
}

function level3(L: Level) {
  L.ground(-4, 22);
  L.many(E.RAT, [14, 17, 20]);
  L.hint(10, 'Rừng tối: cẩn thận vực sâu và nhện thả từ trên cao');
  L.ground(25, 38); L.e(E.SPIDER, 31, 5.5); L.e(E.WEREWOLF, 36);
  L.plat(38.5, 8, 2.5);
  L.ground(42, 58); L.e(E.TREE, 52); L.many(E.RAT, [46, 48]);
  L.plat(46, 7, 3); L.pk(PU.SUPER, 47.5, 6.2);
  L.ground(61, 64); L.ground(67, 82);
  L.e(E.SPIDER, 70, 5); L.e(E.SPIDER, 75, 5); L.e(E.WEREWOLF, 80);
  L.cp(72);
  L.plat(84, 8.6, 2.6); L.plat(88, 7.6, 2.6); L.plat(92, 8.5, 2.6);
  L.coins(84.3, 7.8, 3); L.coins(88.3, 6.7, 3);
  L.ground(96, 120); L.e(E.TREE, 108); L.e(E.WEREWOLF, 104); L.many(E.RAT, [113, 116]); L.e(E.SPIDER, 117, 5);
  L.ground(123, 128); L.ground(131, 150);
  L.e(E.WEREWOLF, 138); L.e(E.TREE, 145); L.pk(PU.HEALTH, 133, 8.6);
  L.arena(153, { type: BOSSES.FOREST_BEAST });
}

function level4(L: Level) {
  L.sandstorm = true;
  L.ground(-4, 40);
  L.hint(8, 'Bão cát định kỳ thổi bạn lùi lại — giữ chạy về phía trước');
  L.many(E.SCORPION, [18, 30]); L.e(E.DRONE, 25, 5); L.e(E.SANDMON, 35);
  L.prop('dune', 20); L.coins(22, 8.6, 5);
  L.ground(43, 70);
  L.block(48, 8.5, 3, 1.5); L.block(56, 8.0, 3, 2.0);
  L.e(E.SHIELDER, 53); L.e(E.SCORPION, 57.5, 8.0); L.e(E.SANDMON, 64); L.pk(PU.PLASMA, 49.5, 7.6);
  L.ground(73, 98); L.cp(75);
  L.many(E.SANDMON, [84, 92]); L.e(E.SCORPION, 96); L.e(E.DRONE, 88, 5);
  L.ground(101, 128); L.many(E.SCORPION, [108, 118]); L.e(E.SHIELDER, 114); L.e(E.DRONE, 122, 4.5);
  L.crate(105); L.barrel(116);
  L.ground(131, 150); L.e(E.SANDMON, 138); L.pk(PU.HEALTH, 145, 8.6);
  L.arena(153, { type: BOSSES.SAND_WORM });
}

function level5(L: Level) {
  L.ice = true;
  L.ground(-4, 34);
  L.hint(6, 'Mặt băng trơn: dừng và đổi hướng chậm hơn');
  L.e(E.MUTANT, 16); L.e(E.ICEMON, 26); L.coins(10, 8.6, 4);
  L.hz(HZ.ICICLE, 21, 3.5, 0.5, 1.0); L.prop('overhang', 19.5, 3.5, 3);
  L.ground(37, 62, 9);
  L.e(E.ICEMON, 48, 9); L.e(E.DRONE, 44, 4); L.e(E.MUTANT, 56, 9);
  L.hz(HZ.ICICLE, 52, 2.5, 0.5, 1.0); L.prop('overhang', 50.5, 2.5, 3);
  L.pk(PU.DOUBLE, 40, 7.6);
  L.ground(65, 90); L.cp(67);
  L.hz(HZ.SPIKES, 74, 9.6, 2.5, 0.4);
  L.many(E.ICEMON, [80, 88]); L.e(E.SHIELDER, 84);
  L.plat(92, 8.4, 2.4); L.plat(96, 7.4, 2.4);
  L.ground(100, 126); L.e(E.ICEMON, 110); L.many(E.MUTANT, [116, 120]); L.e(E.DRONE, 114, 4);
  L.hz(HZ.ICICLE, 106, 3.5, 0.5, 1.0); L.prop('overhang', 104.5, 3.5, 3);
  L.ground(129, 150); L.pk(PU.HEALTH, 140, 8.6); L.e(E.ICEMON, 138);
  L.arena(153, { type: BOSSES.FROZEN_GOLEM });
}

function level6(L: Level) {
  L.ground(-4, 36);
  L.many(E.CYBORG, [18, 30]); L.e(E.MUTANT, 24);
  L.hint(10, 'Bẫy laser: quan sát vạch cảnh báo rồi vượt qua khi tắt');
  L.hz(HZ.LASER, 14, 2, 0.15, 8, 2.4, 0);
  L.ground(36, 64);
  L.hz(HZ.LASER, 42, 9.3, 6, 0.15, 2.0, 0.6);
  L.e(E.SPIDER, 50, 5); L.e(E.ROBOT, 56); L.e(E.DRONE, 60, 5);
  L.hz(HZ.LASER, 62, 2, 0.15, 8, 2.4, 1.2);
  L.pk(PU.PLASMA, 52, 8.6);
  L.ground(67, 92); L.cp(69);
  L.many(E.CYBORG, [80, 88]); L.e(E.MUTANT, 76); L.e(E.SPIDER, 84, 5); L.barrel(78);
  L.ground(95, 128);
  L.hz(HZ.LASER, 100, 2, 0.15, 8, 2.2, 0); L.hz(HZ.LASER, 106, 2, 0.15, 8, 2.2, 1.1);
  L.many(E.CYBORG, [114, 124]); L.e(E.DRONE, 118, 4.5); L.e(E.MUTANT, 120);
  L.ground(131, 150); L.pk(PU.HEALTH, 140, 8.6); L.e(E.ROBOT, 144);
  L.arena(153, { type: BOSSES.BIO_TITAN });
}

function level7(L: Level) {
  L.ground(-4, 26);
  L.hint(6, 'Dung nham gây sát thương lớn — nhảy qua thật chuẩn!');
  L.many(E.FIREDEMON, [18]); L.e(E.BUG, 23);
  L.lava(26, 29.5); L.ground(29.5, 50);
  L.hz(HZ.GEYSER, 36, 5.5, 1.0, 4.5, 3, 0); L.e(E.LAVAMON, 44);
  L.lava(50, 54); L.ground(54, 74);
  L.e(E.FIREDEMON, 64); L.many(E.BUG, [68, 71]); L.pk(PU.BOMB, 58, 8.6);
  L.lava(74, 77); L.ground(77, 96); L.cp(79);
  L.e(E.LAVAMON, 90); L.hz(HZ.GEYSER, 85, 5.5, 1.0, 4.5, 2.6, 1.0);
  L.lava(96, 100); L.plat(97, 8.2, 2);
  L.ground(100, 128); L.many(E.FIREDEMON, [110, 122]); L.e(E.BUG, 116); L.e(E.DRONE, 114, 4.5);
  L.hz(HZ.GEYSER, 105, 5.5, 1.0, 4.5, 3, 0.5);
  L.lava(128, 131); L.ground(131, 150); L.pk(PU.HEALTH, 140, 8.6); L.e(E.LAVAMON, 145);
  L.arena(153, { type: BOSSES.LAVA_DRAGON });
}

function level8(L: Level) {
  L.gravity = 20;
  L.ground(-4, 34);
  L.hint(6, 'Trọng lực thấp: nhảy cao và xa hơn');
  L.many(E.ALIEN, [18, 28]); L.e(E.ALIENSPIDER, 23);
  L.ground(38, 62);
  L.hz(HZ.GEYSER, 44, 5.5, 1.0, 4.5, 2.8, 0);
  L.plat(48, 6.5, 3); L.pk(PU.TRIPLE, 49.5, 5.7);
  L.many(E.ALIENSPIDER, [52, 58]); L.e(E.DRONE, 55, 4);
  L.ground(67, 92); L.cp(69);
  L.many(E.ALIEN, [78, 88]); L.e(E.ALIENSPIDER, 84); L.e(E.SHIELDER, 74);
  L.plat(94, 7.5, 2.5); L.plat(99, 6.5, 2.5);
  L.ground(104, 130); L.hz(HZ.GEYSER, 112, 5.5, 1.0, 4.5, 2.4, 1.2);
  L.many(E.ALIEN, [118, 126]); L.e(E.ALIENSPIDER, 122); L.e(E.DRONE, 115, 4.5);
  L.ground(133, 150); L.pk(PU.HEALTH, 140, 8.6);
  L.arena(153, { type: BOSSES.ALIEN_QUEEN });
}

function level9(L: Level) {
  L.ground(-4, 40);
  L.hint(6, 'Pháo đài: boss rush — 3 mini-boss liên tiếp');
  L.many(E.SHIELDER, [16, 30]); L.e(E.ROBOT, 24); L.e(E.CYBORG, 36);
  L.ground(44, 70); L.many(E.MUTANT, [50, 54]); L.e(E.DRONE, 58, 4.5); L.e(E.CYBORG, 66);
  L.hz(HZ.LASER, 46, 9.3, 4, 0.15, 2.2, 0); L.pk(PU.SUPER, 62, 8.6);
  L.ground(74, 100); L.cp(76);
  L.e(E.ROBOT, 86); L.e(E.SHIELDER, 92); L.e(E.DRONE, 96, 4.5); L.hz(HZ.CRUSHER, 82, 2.5, 1.8, 7.5, 2.4, 0);
  L.ground(103, 130); L.many(E.CYBORG, [112, 124]); L.e(E.SHIELDER, 118); L.barrel(115);
  L.ground(133, 150); L.pk(PU.HEALTH, 140, 8.6); L.pk(PU.ULT, 144, 8.6);
  L.arena(153,
    { type: BOSSES.IRON_BEAST, hp: 700, name: 'IRON BEAST MK-II' },
    { type: BOSSES.MECHA_TITAN, hp: 800, name: 'MECHA TITAN MK-II' },
    { type: BOSSES.FROZEN_GOLEM, hp: 900, name: 'FROZEN GOLEM MK-II' });
}

function level10(L: Level) {
  L.ground(-4, 36);
  L.hint(6, 'Trận chiến cuối cùng — tiêu diệt Overlord!');
  L.many(E.ALIEN, [16, 30]); L.e(E.CYBORG, 24); L.e(E.DRONE, 20, 4.5);
  L.ground(40, 66); L.hz(HZ.LASER, 46, 2, 0.15, 8, 2.2, 0);
  L.e(E.SHIELDER, 52); L.e(E.FIREDEMON, 58); L.e(E.ICEMON, 63); L.pk(PU.TRIPLE, 50, 8.6);
  L.lava(66, 69.5); L.ground(69.5, 96); L.cp(72);
  L.many(E.WEREWOLF, [82]); L.e(E.ALIENSPIDER, 88); L.e(E.DRONE, 85, 4.5); L.e(E.CYBORG, 93);
  L.ground(99, 128); L.hz(HZ.CRUSHER, 104, 2.5, 1.8, 7.5, 2.2, 0);
  L.e(E.LAVAMON, 114); L.many(E.BUG, [118, 121]); L.e(E.ALIEN, 125);
  L.ground(131, 150); L.pk(PU.HEALTH, 138, 8.6); L.pk(PU.SUPER, 144, 8.6);
  L.arena(153, { type: BOSSES.OVERLORD });
}
