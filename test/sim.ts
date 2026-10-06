// Headless simulation of all levels with the test bot (node). Build with esbuild, run: node sim.cjs [god|nogod] [levels]
import { World, WS } from '../src/game/world';
import { Bot } from '../src/scenes/bot';

const god = process.argv[2] === 'god';
const levels = (process.argv[3] ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
for (const lv of levels) {
  const w = new World(lv);
  w.god = god;
  w.viewW = 1200 / 48;
  const bot = new Bot(w);
  const dt = 1 / 60;
  let t = 0, arenaT = -1, maxX = 0, stuckSince = 0;
  const log: string[] = [];
  while (t < 900 && w.state !== WS.Complete) {
    bot.think(dt);
    w.update(dt, bot);
    t += dt;
    if (w.player.x > maxX + 0.5) { maxX = w.player.x; stuckSince = t; }
    if (w.arenaLocked && arenaT < 0) arenaT = t;
    if (t - stuckSince > 60 && !w.arenaLocked) { log.push(`STUCK near x=${maxX.toFixed(1)} (player x=${w.player.x.toFixed(1)} y=${w.player.y.toFixed(1)})`); break; }
  }
  const b = w.boss;
  console.log(`L${lv} ${w.state === WS.Complete ? 'COMPLETE' : 'NOT DONE'} t=${t.toFixed(0)}s arenaAt=${arenaT.toFixed(0)}s bossFight=${(t - arenaT).toFixed(0)}s deaths=${w.deaths} kills=${w.kills} coins=${w.coinsEarned} boss=${b ? b.name + ' hp ' + b.hp + ' ph' + b.phase : '-'} ${log.join(' ')}`);
}
