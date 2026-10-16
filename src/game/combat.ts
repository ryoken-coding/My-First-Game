// Combat: player melee, ability casting, enemy AI, projectiles and effects.
import { ABILITIES, AFFS, potency, masteryLevel, type AbilityId, type AffId } from '../data/affinities';
import { t } from '../i18n';
import type { Enemy, Projectile } from './types';
import type { Game } from './game';
import { dist, clamp } from '../core/util';
import { solidAt } from '../world/level';

export const ENEMY_STATS: Record<Enemy['type'], { hp: number; speed: number; aggro: number; xp: number; dmg: number }> = {
  slime: { hp: 18, speed: 1.1, aggro: 6, xp: 4, dmg: 6 },
  boar: { hp: 34, speed: 0.9, aggro: 7, xp: 8, dmg: 12 },
  sentry: { hp: 30, speed: 0.7, aggro: 8, xp: 12, dmg: 8 },
  wisp: { hp: 22, speed: 1.0, aggro: 7, xp: 10, dmg: 9 },
  crawler: { hp: 26, speed: 0.7, aggro: 6, xp: 7, dmg: 5 },
  guardian: { hp: 240, speed: 0.9, aggro: 12, xp: 150, dmg: 18 },
};

export function makeEnemy(type: Enemy['type'], x: number, y: number, spawnIndex: number, boss = false): Enemy {
  const s = ENEMY_STATS[type];
  return {
    type, x, y, hp: s.hp, maxHp: s.hp,
    shield: type === 'wisp' ? 22 : type === 'guardian' ? 1 : 0,
    stun: 0, cd: 1, windup: 0, charge: 0, cdx: 0, cdy: 0, flash: 0,
    home: { x, y }, spawnIndex, dead: false, respawn: 0, boss, meleeHits: 0, phase: 0, bob: Math.random() * 6, revealed: false,
  };
}

/** Potency for an affinity including mastery. */
export function affPower(g: Game, aff: AffId): number {
  const i = AFFS.indexOf(aff);
  return potency(g.save.pcts[i], masteryLevel(g.save.affXp[i]));
}

/** Effective raw strength including the Enhancement bonus when Iron Stance is active. */
export function effStrength(g: Game): number {
  const base = g.save.stats.str;
  if (g.player.ironT > 0) return base * (1 + (0.4 * g.save.pcts[1]) / 100);
  return base;
}

export function meleeDamage(g: Game): number {
  return 4 + effStrength(g) * 0.14;
}

export function strike(g: Game): void {
  const p = g.player;
  if (p.atkCd > 0 || p.stamina < 8 || g.mode !== 'play') return;
  p.stamina -= 8;
  p.atkCd = 0.38;
  p.attackT = 0.18;
  g.audio.play('hit');
  let hit = false;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) continue;
    const dot = (dx * p.dirX + dy * p.dirY) / (d || 1);
    if (dot < 0.35 && d > 0.6) continue;
    hit = true;
    damageEnemy(g, e, meleeDamage(g), false, 'melee');
    e.x += p.dirX * 0.3;
    e.y += p.dirY * 0.3;
  }
  if (!hit) g.floatText(g.player.x, g.player.y, '~', '#c9d6e0');
}

/** Applies damage with the game-world rules: magic vs. Ley-dampened machines, shields, bosses. */
export function damageEnemy(g: Game, e: Enemy, dmg: number, magic: boolean, kind: 'melee' | 'magic' | 'anti' | 'boss'): void {
  if (e.dead) return;
  if (e.shield > 0) {
    if (kind === 'anti') {
      e.shield = 0;
      g.floatText(e.x, e.y, t('ui.unravelled'), '#ff9ad5');
      g.audio.play('discover');
      g.effect({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.6, color: '#ff9ad5' });
    } else if (e.type === 'guardian' && kind === 'melee') {
      e.meleeHits += 1;
      g.floatText(e.x, e.y, `${e.meleeHits}/12`, '#c9d6e0');
      if (e.meleeHits >= 12) {
        e.shield = 0;
        g.toast(t('ui.unravelled'), 'ok');
      }
      return;
    } else {
      g.floatText(e.x, e.y, t('ui.blocked'), '#c9b8ff');
      g.effect({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.25, color: '#c9b8ff' });
      return;
    }
  }
  let d = dmg;
  if (e.type === 'sentry') {
    if (magic) d *= 0.5;
    if (kind === 'melee') d *= 1.3;
  }
  if (e.type === 'wisp' && magic) d *= 1.25;
  d = Math.round(d);
  e.hp -= d;
  e.flash = 0.12;
  e.stun = Math.max(e.stun, kind === 'melee' ? 0.12 : 0);
  g.effect({ kind: 'text', x: e.x, y: e.y - 0.6, t: 0, life: 0.8, text: `${d}`, color: magic ? '#7ad7ff' : '#ffffff' });
  g.audio.play('hit');
  if (e.type === 'sentry' && magic) g.toast(t('ui.physicalOnly'), 'info', 1800);
  if (e.hp <= 0) killEnemy(g, e);
}

function killEnemy(g: Game, e: Enemy): void {
  e.dead = true;
  const stats = ENEMY_STATS[e.type];
  g.gainXp(stats.xp);
  g.save.kills[e.type] = (g.save.kills[e.type] ?? 0) + 1;
  g.effect({ kind: 'burst', x: e.x, y: e.y, t: 0, life: 0.5, color: '#fff2a8' });
  if (e.boss) {
    g.save.flags.guardian_dead = true;
    g.bossDefeated();
    return;
  }
  e.respawn = 60;
  const drops: Record<string, [string, number]> = {
    slime: ['ley_shard', 0.15], boar: ['salt_pork', 0.3], sentry: ['scrap_metal', 0.6], wisp: ['ley_shard', 0.6], crawler: ['herbs', 0.4], guardian: ['', 0],
  };
  const [item, chance] = drops[e.type];
  if (item && g.rand() < chance) g.addItem(item, 1);
  if (e.type === 'sentry') {
    if (g.rand() < 0.25) g.addItem('valve_gasket', 1);
    if (g.rand() < 0.25) g.addItem('copper_wire', 1);
    if (g.rand() < 0.2) g.addItem('iron_nails', 1);
  }
}

// ---------- abilities ----------
export function cast(g: Game, id: AbilityId): void {
  const def = ABILITIES[id];
  const p = g.player;
  if (g.mode !== 'play') return;
  if (!g.abilityUnlocked(id)) {
    g.toast(t('ui.notAvailable'), 'fail');
    return;
  }
  if ((p.cool[id] ?? 0) > 0) {
    g.toast(t('ui.onCooldown'), 'fail', 900);
    return;
  }
  if (p.mana < def.cost) {
    g.toast(t('ui.cantCast'), 'fail', 1200);
    return;
  }
  p.mana -= def.cost;
  p.cool[id] = def.cooldown;
  g.audio.play('cast');
  g.markAffUse(def.aff);
  const pw = Array.isArray(def.aff)
    ? (affPower(g, def.aff[0]) + affPower(g, def.aff[1])) / 2
    : affPower(g, def.aff);
  const dx = p.dirX;
  const dy = p.dirY;
  const shoot = (kind: Projectile['kind'], speed: number, dmg: number, magic: boolean, life: number, knock = 0, stun = 0) => {
    g.projectiles.push({ x: p.x + dx * 0.6, y: p.y + dy * 0.6, vx: dx * speed, vy: dy * speed, dmg, team: 'player', life, magic, kind, knock, stun });
  };
  switch (id) {
    case 'ward':
      p.ward = { amt: 30 * pw, t: 3 };
      g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.5, color: '#ff9ad5' });
      break;
    case 'unravel': {
      g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.6, color: '#ff9ad5' });
      for (const e of g.enemies) {
        if (e.dead || dist(e.x, e.y, p.x, p.y) > 3.5) continue;
        if (e.shield > 0) {
          e.shield = 0;
          g.toast(t('ui.unravelled'), 'ok');
        }
        e.stun = Math.max(e.stun, 1.5);
        e.revealed = true;
        damageEnemy(g, e, 4 * pw, true, 'anti');
      }
      g.discoverConcept('anti_reveal');
      break;
    }
    case 'iron':
      p.ironT = 8;
      break;
    case 'surge':
      p.dashT = 0.22;
      p.dashVx = dx * 9;
      p.dashVy = dy * 9;
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, p.x, p.y) < 2.2) damageEnemy(g, e, 6 * pw, true, 'magic');
      }
      break;
    case 'bolt':
      shoot('bolt', 9, 9 * pw, true, 1.2);
      break;
    case 'pulse':
      g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.45, color: '#7ad7ff', size: 2.5 });
      for (const e of g.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 2.5) {
          damageEnemy(g, e, 5 * pw, true, 'magic');
          const k = (2.5 - d) / 2.5;
          e.x += ((e.x - p.x) / (d || 1)) * k * 1.5;
          e.y += ((e.y - p.y) / (d || 1)) * k * 1.5;
        }
      }
      break;
    case 'shot':
      shoot('shot', 6.5, 14 * pw, true, 1.6, 0, 0.6);
      break;
    case 'pull': {
      let best: (typeof g.enemies)[number] | null = null;
      for (const e of g.enemies) if (!e.dead && dist(e.x, e.y, p.x, p.y) < 6 && (!best || dist(e.x, e.y, p.x, p.y) < dist(best.x, best.y, p.x, p.y))) best = e;
      if (best) {
        const d = dist(best.x, best.y, p.x, p.y);
        best.x = p.x + ((best.x - p.x) / d) * Math.max(1.2, d - 3);
        best.y = p.y + ((best.y - p.y) / d) * Math.max(1.2, d - 3);
        best.stun = 0.3;
        g.effect({ kind: 'line', x: p.x, y: p.y, x2: best.x, y2: best.y, t: 0, life: 0.3, color: '#b89bff' });
      } else g.toast(t('ui.notAvailable'), 'fail', 900);
      break;
    }
    case 'push':
      for (const e of g.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 2.2) {
          e.x += ((e.x - p.x) / (d || 1)) * 2;
          e.y += ((e.y - p.y) / (d || 1)) * 2;
          e.windup = 0;
          e.stun = 0.5;
        }
      }
      g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.35, color: '#b89bff', size: 2.2 });
      break;
    case 'shield':
      g.barriers.push({ x: p.x + dx * 1.6, y: p.y + dy * 1.6, hp: 40 * pw, t: 4 });
      break;
    case 'familiar':
      g.familiars.push({ x: p.x, y: p.y, t: 10, cd: 0 });
      break;
    case 'lance': {
      g.effect({ kind: 'line', x: p.x, y: p.y, x2: p.x + dx * 4.5, y2: p.y + dy * 4.5, t: 0, life: 0.35, color: '#ffb36b' });
      for (const e of g.enemies) {
        if (e.dead) continue;
        const ex = e.x - p.x;
        const ey = e.y - p.y;
        const along = clamp(ex * dx + ey * dy, 0, 4.5);
        const off = Math.hypot(ex - dx * along, ey - dy * along);
        if (off < 0.8) damageEnemy(g, e, 26 * pw, true, 'magic');
      }
      break;
    }
    case 'gravity':
      g.wells.push({ x: p.x + dx * 3, y: p.y + dy * 3, t: 3 });
      break;
    case 'null':
      p.guardT = 4;
      for (const e of g.enemies) if (!e.dead && dist(e.x, e.y, p.x, p.y) < 3) { e.shield = 0; }
      g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.5, color: '#ff9ad5', size: 3 });
      break;
    case 'gale':
      shoot('gale', 9, 8 * pw, true, 1.2, 2.0, 0.2);
      break;
  }
  // Mastery grows with use; combinations grow both affinities
  if (Array.isArray(def.aff)) {
    for (const a of def.aff) g.addAffXp(a, 1);
    if (!g.save.combos.includes(id)) {
      g.save.combos.push(id);
      g.toast(`${t('ui.discoveredCombo')}: ${t(`ability.${id}.name`)}`, 'ok', 3500);
      g.audio.play('levelup');
    }
  } else {
    g.addAffXp(def.aff, 1);
  }
  g.afterCastSave();
}

// ---------- enemies ----------
function solidFor(x: number, y: number, g: Game): boolean {
  return solidAt(g.map, x, y) || g.barriers.some((b) => b.hp > 0 && dist(b.x, b.y, x, y) < 0.6);
}

function moveToward(g: Game, e: Enemy, tx: number, ty: number, speed: number, dt: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) return;
  const nx = e.x + (dx / d) * speed * dt;
  const ny = e.y + (dy / d) * speed * dt;
  if (!solidFor(nx, e.y, g)) e.x = nx;
  if (!solidFor(e.x, ny, g)) e.y = ny;
}

export function hurtPlayer(g: Game, dmg: number, magic: boolean): void {
  const p = g.player;
  if (p.invuln > 0 || p.dead) return;
  let d = dmg;
  if (p.ward && p.ward.amt > 0) {
    const absorbed = Math.min(p.ward.amt, d);
    p.ward.amt -= absorbed;
    d -= absorbed;
    g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.3, color: '#ff9ad5' });
  }
  if (p.guardT > 0) {
    if (magic) return;
    d *= 0.7;
  }
  if (d <= 0) return;
  g.damagePlayer(Math.round(d));
}

export function updateEnemies(g: Game, dt: number): void {
  const p = g.player;
  for (const e of g.enemies) {
    if (e.dead) {
      if (!e.boss && e.respawn > 0) {
        e.respawn -= dt;
        if (e.respawn <= 0) {
          const s = g.spawnsRef[e.spawnIndex];
          e.dead = false;
          e.x = s.x;
          e.y = s.y;
          e.home = { x: s.x, y: s.y };
          e.hp = e.maxHp;
          e.shield = e.type === 'wisp' ? 22 : 0;
        }
      }
      continue;
    }
    e.flash = Math.max(0, e.flash - dt);
    e.cd = Math.max(0, e.cd - dt);
    e.bob += dt * 4;
    if (e.stun > 0) { e.stun -= dt; continue; }
    const d = dist(e.x, e.y, p.x, p.y);
    const s = ENEMY_STATS[e.type];
    if (e.type === 'guardian' && e.shield > 0) {
      // shielded guardian stays grounded but still acts
    }
    if (e.type === 'boar') {
      if (e.charge > 0) {
        e.charge -= dt;
        moveToward(g, e, e.x + e.cdx, e.y + e.cdy, 3.6, dt);
        if (dist(e.x, e.y, p.x, p.y) < 0.8 && e.cd <= 0) {
          hurtPlayer(g, s.dmg, false);
          e.cd = 1;
          g.effect({ kind: 'burst', x: p.x, y: p.y, t: 0, life: 0.3, color: '#ffd9a0' });
        }
        continue;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          e.charge = 0.7;
          e.cdx = (p.x - e.x) / (d || 1) * 4;
          e.cdy = (p.y - e.y) / (d || 1) * 4;
        }
        continue;
      }
      if (d < 5 && d > 1.5 && e.cd <= 0) {
        e.windup = 0.7;
        e.cd = 2.5;
        g.effect({ kind: 'line', x: e.x, y: e.y, x2: p.x, y2: p.y, t: 0, life: 0.7, color: '#ff6b6b' });
        continue;
      }
    }
    if (e.type === 'guardian') {
      e.phase = e.shield > 0 ? 0 : 1;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          g.effect({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.5, color: '#ffd166', size: 3 });
          if (d < 3.2) hurtPlayer(g, s.dmg, false);
          e.cd = 4;
        }
        continue;
      }
      if (d < s.aggro) {
        if (d < 3.2 && e.cd <= 0) { e.windup = 0.8; continue; }
        if (e.cd <= 0 && d < 6) { e.windup = 0.8; continue; }
        moveToward(g, e, p.x, p.y, s.speed * (e.phase ? 1.4 : 1), dt);
      }
      continue;
    }
    if (d > s.aggro) {
      if (dist(e.x, e.y, e.home.x, e.home.y) > 0.5) moveToward(g, e, e.home.x, e.home.y, s.speed * 0.5, dt);
      continue;
    }
    switch (e.type) {
      case 'slime':
        if (d > 1) moveToward(g, e, p.x, p.y, s.speed, dt);
        else if (e.cd <= 0) { hurtPlayer(g, s.dmg, false); e.cd = 1.1; }
        break;
      case 'crawler':
        if (d > 4) moveToward(g, e, p.x, p.y, s.speed, dt);
        else if (e.cd <= 0) {
          for (const a of [-0.35, 0, 0.35]) {
            const ang = Math.atan2(p.y - e.y, p.x - e.x) + a;
            g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, dmg: s.dmg, team: 'enemy', life: 2, magic: false, kind: 'thorn', knock: 0, stun: 0 });
          }
          e.cd = 2.2;
        }
        break;
      case 'sentry':
        if (d < 4) moveToward(g, e, e.x - (p.x - e.x), e.y - (p.y - e.y), s.speed, dt);
        else if (d > 6) moveToward(g, e, p.x, p.y, s.speed, dt);
        if (e.cd <= 0 && d < 8) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, dmg: s.dmg, team: 'enemy', life: 2.5, magic: false, kind: 'spark', knock: 0, stun: 0 });
          e.cd = 2.4;
        }
        break;
      case 'wisp':
        if (d > 2.5) moveToward(g, e, p.x, p.y, s.speed, dt);
        else moveToward(g, e, e.x - (p.x - e.x), e.y - (p.y - e.y), s.speed * 0.5, dt);
        if (e.cd <= 0 && d < 7) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, dmg: s.dmg, team: 'enemy', life: 2.5, magic: true, kind: 'wisp', knock: 0, stun: 0 });
          e.cd = 2.5;
        }
        break;
      default:
        break;
    }
  }
}

export function updateProjectiles(g: Game, dt: number): void {
  const p = g.player;
  g.projectiles = g.projectiles.filter((pr) => {
    pr.life -= dt;
    if (pr.life <= 0) return false;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (solidAt(g.map, pr.x, pr.y)) return false;
    if (pr.team === 'player') {
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, pr.x, pr.y) < 0.6) {
          damageEnemy(g, e, pr.dmg, pr.magic, pr.magic ? 'magic' : 'melee');
          if (pr.knock) { e.x += (pr.vx / 9) * pr.knock; e.y += (pr.vy / 9) * pr.knock; }
          if (pr.stun) e.stun = Math.max(e.stun, pr.stun);
          return false;
        }
      }
      return true;
    }
    for (const b of g.barriers) {
      if (b.hp > 0 && dist(b.x, b.y, pr.x, pr.y) < 0.5) {
        b.hp -= pr.dmg;
        return false;
      }
    }
    if (dist(p.x, p.y, pr.x, pr.y) < 0.5) {
      if (pr.magic && p.guardT > 0) {
        g.effect({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.3, color: '#ff9ad5' });
        return false;
      }
      hurtPlayer(g, pr.dmg, pr.magic);
      return false;
    }
    return true;
  });
}

export function updateSkills(g: Game, dt: number): void {
  for (const b of g.barriers) b.t -= dt;
  g.barriers = g.barriers.filter((b) => b.t > 0 && b.hp > 0);
  for (const w of g.wells) {
    w.t -= dt;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, w.x, w.y);
      if (d < 3.5 && d > 0.2) {
        e.x += ((w.x - e.x) / d) * 2.2 * dt;
        e.y += ((w.y - e.y) / d) * 2.2 * dt;
        damageEnemy(g, e, 2 * dt * 4, true, 'magic');
      }
    }
  }
  g.wells = g.wells.filter((w) => w.t > 0);
  for (const f of g.familiars) {
    f.t -= dt;
    f.cd -= dt;
    const tgt = nearestEnemy(g, f.x, f.y, 5);
    if (tgt) {
      const d = dist(tgt.x, tgt.y, f.x, f.y);
      f.x += ((tgt.x - f.x) / d) * 3 * dt;
      f.y += ((tgt.y - f.y) / d) * 3 * dt;
      if (f.cd <= 0) {
        f.cd = 1.2;
        damageEnemy(g, tgt, 4 * affPower(g, 'con'), true, 'magic');
      }
    } else {
      f.x += (g.player.x - 0.6 - f.x) * dt * 2;
      f.y += (g.player.y - 0.6 - f.y) * dt * 2;
    }
  }
  g.familiars = g.familiars.filter((f) => f.t > 0);
}

export function nearestEnemy(g: Game, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = range;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, x, y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
