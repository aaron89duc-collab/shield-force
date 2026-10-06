import { World } from '../src/game/world';
import { E, Enemy } from '../src/game/enemy';
// Player stands still and holds FIRE; low enemies walk in. Count kills.
for (const [name, type] of [['rat', E.RAT], ['bug', E.BUG], ['spider(ground)', E.ALIENSPIDER], ['scorpion', E.SCORPION]] as const) {
  for (const crouch of [false, true]) {
    const w = new World(1); w.god = true; w.viewW = 25;
    w.enemies = [new Enemy(type, 9, 10), new Enemy(type, 12, 10)];
    const c = { moveX: 0, moveY: crouch ? 1 : 0, fireHeld: true, jumpHeld: false, shieldHeld: false, takeJump: () => false, takeShieldPress: () => false, takeShieldRelease: () => false, takeSmash: () => false, takeSpecial: () => false };
    for (let i = 0; i < 60 * 6; i++) w.update(1 / 60, c);
    console.log(name.padEnd(16), crouch ? 'crouch' : 'stand ', 'killed', w.enemies.filter(e => !e.alive).length, '/ 2');
  }
}
