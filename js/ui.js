// ui.js - Screen transitions and UI helpers

// Global flag for skipping battle animation
let skipBattleAnimation = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(id);
  if (s) s.classList.add('active');
}

function hpBarColor(pct) {
  if (pct > 0.5) return '#4caf50';
  if (pct > 0.25) return '#ff9800';
  return '#f44336';
}

function renderHpBar(current, max) {
  const pct = Math.max(0, current / max);
  const color = hpBarColor(pct);
  return `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"></div></div>
          <span class="hp-text">${Math.max(0,current)}/${max}</span>`;
}

function renderPokemonCard(pokemon, onClick, selected) {
  const pct = pokemon.currentHp / pokemon.maxHp;
  const typeHtml = (pokemon.types || ['???']).map(t =>
    `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`
  ).join('');
  return `<div class="poke-card${selected?' selected':''}" ${onClick?`role="button" tabindex="0"`:''}">
    <div class="poke-sprite-wrap">
      <img src="${pokemon.spriteUrl || ''}" alt="${pokemon.name}" class="poke-sprite${pokemon.isShiny?' shiny':''}"
           onerror="this.src='';this.style.display='none'">
      ${pokemon.isShiny ? '<span class="shiny-badge">★ Shiny</span>' : ''}
    </div>
    <div class="poke-name">${pokemon.nickname || pokemon.name}</div>
    <div class="poke-level">Lv. ${pokemon.level}</div>
    <div class="poke-types">${typeHtml}</div>
    <div class="poke-stats">
      HP: ${pokemon.baseStats.hp} | ATK: ${pokemon.baseStats.atk} | DEF: ${pokemon.baseStats.def}<br>
      SPD: ${pokemon.baseStats.speed} | SP: ${pokemon.baseStats.special}
    </div>
    <div class="poke-hp">${renderHpBar(pokemon.currentHp, pokemon.maxHp)}</div>
  </div>`;
}

let _teamBarSelected = null;

function renderTeamBar(team, el) {
  const isMain = !el;
  if (!el) el = document.getElementById('team-bar');
  if (!el) return;
  el.innerHTML = '';
  team.forEach((p, i) => {
    const pct = p.currentHp / p.maxHp;
    const color = hpBarColor(pct);
    const slot = document.createElement('div');
    slot.className = 'team-slot' + (isMain && i === _teamBarSelected ? ' team-slot-selected' : '');
    slot.style.cursor = isMain ? 'pointer' : 'default';
    slot.innerHTML = `
      <img src="${p.spriteUrl||''}" alt="${p.name}" class="team-sprite" onerror="this.src='';this.style.display='none'">
      <div class="team-slot-name">${p.nickname||p.name}</div>
      <div class="team-slot-lv">Lv${p.level}</div>
      <div class="hp-bar-bg sm"><div class="hp-bar-fill" style="width:${Math.floor(pct*100)}%;background:${color}"></div></div>`;
    if (isMain) {
      slot.addEventListener('click', () => {
        if (_teamBarSelected === null) {
          _teamBarSelected = i;
        } else if (_teamBarSelected === i) {
          _teamBarSelected = null;
        } else {
          [team[_teamBarSelected], team[i]] = [team[i], team[_teamBarSelected]];
          _teamBarSelected = null;
        }
        renderTeamBar(team);
      });
    }
    el.appendChild(slot);
  });
}

function renderItemBadges(items) {
  const el = document.getElementById('item-bar');
  if (!el) return;
  el.innerHTML = items.map(it =>
    `<span class="item-badge" data-tooltip="${it.desc}">${it.icon} ${it.name}</span>`
  ).join('');
}

function renderBattleLog(log) {
  const el = document.getElementById('battle-log');
  if (!el) return;
  el.innerHTML = log.map(entry =>
    `<div class="log-entry ${entry.cls||''}">${entry.msg}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

// Render battlefield — first alive pokemon on each side starts as active
function renderBattleField(pTeam, eTeam) {
  const pEl = document.getElementById('player-side');
  const eEl = document.getElementById('enemy-side');
  const pActiveIdx = pTeam.findIndex(p => p.currentHp > 0);
  const eActiveIdx = eTeam.findIndex(p => p.currentHp > 0);

  if (pEl) {
    pEl.innerHTML = pTeam.map((p, i) => {
      const fainted = p.currentHp <= 0;
      const active  = i === pActiveIdx;
      return `<div class="battle-pokemon ${fainted?'fainted':''} ${active?'active-pokemon':''}" data-idx="${i}">
        <img src="${p.spriteUrl||''}" alt="${p.name}" class="battle-sprite" onerror="this.src=''">
        <div class="battle-poke-name">${p.nickname||p.name} Lv${p.level}</div>
        <div class="poke-hp">${renderHpBar(p.currentHp, p.maxHp)}</div>
      </div>`;
    }).join('');
  }
  if (eEl) {
    eEl.innerHTML = eTeam.map((p, i) => {
      const fainted = p.currentHp <= 0;
      const active  = i === eActiveIdx;
      return `<div class="battle-pokemon ${fainted?'fainted':''} ${active?'active-pokemon':''}" data-idx="${i}">
        <img src="${p.spriteUrl||''}" alt="${p.name}" class="battle-sprite" onerror="this.src=''">
        <div class="battle-poke-name">${p.name} Lv${p.level}</div>
        <div class="poke-hp">${renderHpBar(p.currentHp, p.maxHp)}</div>
      </div>`;
    }).join('');
  }
}

// Animate HP bar from fromHp to toHp smoothly
function animateHpBar(containerEl, fromHp, toHp, maxHp, duration = 250) {
  return new Promise(resolve => {
    const fillEl = containerEl.querySelector('.hp-bar-fill');
    const textEl = containerEl.querySelector('.hp-text');
    if (!fillEl) { resolve(); return; }

    if (skipBattleAnimation) {
      const finalPct = Math.max(0, toHp / maxHp);
      fillEl.style.width = `${Math.floor(finalPct * 100)}%`;
      fillEl.style.background = hpBarColor(finalPct);
      if (textEl) textEl.textContent = `${Math.max(0, toHp)}/${maxHp}`;
      resolve();
      return;
    }

    const fromPct = Math.max(0, fromHp / maxHp);
    const toPct = Math.max(0, toHp / maxHp);
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const curPct = fromPct + (toPct - fromPct) * t;
      const curHp = Math.round(fromHp + (toHp - fromHp) * t);

      fillEl.style.width = `${Math.floor(curPct * 100)}%`;
      fillEl.style.background = hpBarColor(curPct);
      if (textEl) textEl.textContent = `${Math.max(0, curHp)}/${maxHp}`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// ─── Attack particle animations ──────────────────────────────────────────────

function playAttackAnimation(moveType, attackerEl, targetEl) {
  const canvas = document.getElementById('battle-anim-canvas');
  if (!canvas || skipBattleAnimation) return Promise.resolve();
  const ctx = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const aR = attackerEl.getBoundingClientRect();
  const tR = targetEl.getBoundingClientRect();
  const from = { x: aR.left + aR.width / 2,  y: aR.top  + aR.height / 2 };
  const to   = { x: tR.left + tR.width  / 2,  y: tR.top  + tR.height / 2 };

  const type = (moveType || 'normal').toLowerCase();
  const particles = buildParticles(type, from, to);
  const duration  = type === 'electric' ? 550 : type === 'psychic' ? 700 : 650;

  return new Promise(resolve => {
    const start = performance.now();

    function frame(now) {
      const elapsed = Math.max(0, now - start); // guard Firefox time-quantization jitter
      const t = Math.min(elapsed / duration, 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let anyAlive = false;
      for (const p of particles) {
        p.tick(elapsed);
        if (p.alive) { p.draw(ctx); anyAlive = true; }
      }

      if (t < 1 || anyAlive) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ── particle factories ── */
function rnd(a, b) { return a + Math.random() * (b - a); }
function lerp(a, b, t) { return a + (b - a) * t; }

function buildParticles(type, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const nx = dx / dist, ny = dy / dist; // normalised direction

  const ps = [];

  if (type === 'fire') {
    // Flamethrower: sustained jet of fire streaming from attacker to target.
    // 60 particles staggered every ~8ms so the stream looks continuous.
    const travelAngle = Math.atan2(dy, dx);
    for (let i = 0; i < 60; i++) {
      const delay = i * 8;
      // Travel close to the target direction with a small cone that widens over time
      const spreadDeg = rnd(-6, 6);
      const spreadRad = spreadDeg * Math.PI / 180;
      const baseSpeed = rnd(1.6, 2.2); // pixels per frame-equivalent
      const vx = Math.cos(travelAngle + spreadRad) * baseSpeed;
      const vy = Math.sin(travelAngle + spreadRad) * baseSpeed;
      const life = rnd(260, 380);
      // size grows as particle ages (flame billows outward)
      const startSize = rnd(3, 6);
      const endSize   = startSize * rnd(2.5, 4.0);
      let px = from.x + rnd(-4, 4), py = from.y + rnd(-4, 4);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) {
          age = ms - delay; if (age < 0) { this.alive = true; return; }
          // slight upward drift (hot air rises)
          px += vx * 2.0;
          py += vy * 2.0 - 0.06 * (age / life) * 20;
          this.alive = age < life;
        },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const a = Math.max(0, t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
          const s = lerp(startSize, endSize, t);
          // colour: white-yellow core → orange → red → transparent
          const grad = ctx.createRadialGradient(px, py, 0, px, py, s);
          grad.addColorStop(0,   `rgba(255,255,200,${a})`);
          grad.addColorStop(0.25,`rgba(255,180,30,${a * 0.95})`);
          grad.addColorStop(0.6, `rgba(220,60,0,${a * 0.7})`);
          grad.addColorStop(1,   `rgba(100,10,0,0)`);
          ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
      });
    }
    // Heat-glow line along the jet axis
    let heatAge = 0;
    ps.push({ alive: true,
      tick(ms) { heatAge = ms; this.alive = ms < 580; },
      draw(ctx) {
        const growT = Math.min(heatAge / 220, 1);
        const fadeA = Math.max(0, 1 - Math.max(0, heatAge - 400) / 180);
        const ex = lerp(from.x, to.x, growT), ey = lerp(from.y, to.y, growT);
        const grad = ctx.createLinearGradient(from.x, from.y, ex, ey);
        grad.addColorStop(0, `rgba(255,220,80,${fadeA * 0.55})`);
        grad.addColorStop(1, `rgba(220,60,0,0)`);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey);
        ctx.strokeStyle = grad; ctx.lineWidth = 8; ctx.stroke();
      }
    });

  } else if (type === 'water') {
    // Water Gun: a coherent pressurised stream (grows like the ice beam but wavy+blue)
    let streamAge = 0;
    ps.push({
      alive: true,
      tick(ms) { streamAge = ms; this.alive = ms < 680; },
      draw(ctx) {
        const growT = Math.min(streamAge / 300, 1);
        const fadeA = Math.max(0, 1 - Math.max(0, streamAge - 420) / 260);
        // Draw the stream as a series of short segments with a sine-wave wobble
        const segs = 40;
        const drawSegs = Math.ceil(growT * segs);
        const waveFreq = 3.5; // oscillations along the stream
        const waveAmp  = 5;   // perpendicular pixels
        const phase = streamAge * 0.012; // scrolling phase = water flowing
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t);
          const by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        // outer glow
        ctx.strokeStyle = `rgba(60,140,255,${fadeA * 0.45})`;
        ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();
        // mid band
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t), by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = `rgba(100,190,255,${fadeA * 0.85})`;
        ctx.lineWidth = 5; ctx.stroke();
        // bright core
        ctx.beginPath();
        for (let s = 0; s <= drawSegs; s++) {
          const t = s / segs;
          const bx = lerp(from.x, to.x, t), by = lerp(from.y, to.y, t);
          const wave = Math.sin(t * Math.PI * 2 * waveFreq - phase) * waveAmp;
          const wx = bx - ny * wave, wy = by + nx * wave;
          s === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = `rgba(220,240,255,${fadeA * 0.7})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
    // Foam bubbles riding the stream tip
    for (let i = 0; i < 12; i++) {
      const delay = i * 22;
      const life  = rnd(200, 320);
      const perpOff = rnd(-6, 6);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = Math.min(age / 260, 1) * Math.min((delay / (12 * 22)), 1);
          const bx = lerp(from.x, to.x, t) - ny * perpOff;
          const by = lerp(from.y, to.y, t) + nx * perpOff;
          const a  = Math.max(0, 1 - age / life);
          ctx.beginPath(); ctx.arc(bx, by, rnd(2, 4), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(190,225,255,${a * 0.75})`; ctx.fill();
        }
      });
    }
    // Splash at impact
    let splashAge = -1;
    ps.push({
      alive: true,
      tick(ms) { splashAge = ms - 280; this.alive = splashAge < 420; },
      draw(ctx) {
        if (splashAge < 0) return;
        const t = splashAge / 420;
        for (let r = 1; r <= 3; r++) {
          ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, t * 38 * r / 3), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(80,180,255,${(1 - t) * 0.6 / r})`;
          ctx.lineWidth = 3 * (1 - t) + 0.5; ctx.stroke();
        }
      }
    });

  } else if (type === 'electric') {
    // Thunderbolt: animated zigzag bolt
    let bolts = [];
    function makeBolt(ox, oy) {
      const segs = 10;
      const pts = [{ x: from.x + ox, y: from.y + oy }];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const bx = lerp(from.x + ox, to.x + ox, t) + rnd(-18, 18);
        const by = lerp(from.y + oy, to.y + oy, t) + rnd(-18, 18);
        pts.push({ x: bx, y: by });
      }
      pts.push({ x: to.x + ox, y: to.y + oy });
      return pts;
    }
    for (let b = 0; b < 3; b++) bolts.push(makeBolt(rnd(-6, 6), rnd(-6, 6)));
    let boltAge = 0;
    ps.push({
      alive: true,
      tick(ms) { boltAge = ms; if (ms % 80 < 40) bolts = bolts.map(() => makeBolt(rnd(-6,6), rnd(-6,6))); this.alive = ms < 500; },
      draw(ctx) {
        const growT = Math.min(boltAge / 200, 1);
        for (const bolt of bolts) {
          const showSegs = Math.ceil(growT * bolt.length);
          ctx.beginPath();
          ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let i = 1; i < showSegs; i++) ctx.lineTo(bolt[i].x, bolt[i].y);
          const a = Math.max(0, 1 - Math.max(0, boltAge - 350) / 150);
          ctx.strokeStyle = `rgba(255,255,80,${a * 0.9})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(255,255,0,0.8)'; ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
          // core white line
          ctx.beginPath(); ctx.moveTo(bolt[0].x, bolt[0].y);
          for (let i = 1; i < showSegs; i++) ctx.lineTo(bolt[i].x, bolt[i].y);
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

  } else if (type === 'grass') {
    // Vine Whip: two bezier vines that grow from attacker and lash the target
    const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
    // Perpendicular offset for each vine's control point (one curves up, one down)
    for (let v = 0; v < 2; v++) {
      const sign   = v === 0 ? 1 : -1;
      const curveMag = dist * 0.30 * sign;
      const cpx = midX - ny * curveMag + rnd(-10, 10);
      const cpy = midY + nx * curveMag + rnd(-10, 10);
      const totalLife = 580;
      const growEnd   = 320; // ms until vine fully extended
      const fadeStart = 400;
      const delay = v * 60;
      let age = -delay;

      // helper: point on quadratic bezier at t
      function bpx(t) { return (1-t)*(1-t)*from.x + 2*(1-t)*t*cpx + t*t*to.x; }
      function bpy(t) { return (1-t)*(1-t)*from.y + 2*(1-t)*t*cpy + t*t*to.y; }

      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < totalLife; },
        draw(ctx) {
          if (age < 0) return;
          const growT = Math.min(age / growEnd, 1);
          const fadeA = Math.max(0, 1 - Math.max(0, age - fadeStart) / (totalLife - fadeStart));
          const segs  = 30;
          const drawSegs = Math.ceil(growT * segs);

          // Vine body (3 passes: glow, main, highlight)
          const passes = [
            { lw: 7,   color: `rgba(30,90,10,${fadeA * 0.4})` },
            { lw: 3.5, color: `rgba(50,140,20,${fadeA * 0.9})` },
            { lw: 1.2, color: `rgba(130,210,70,${fadeA * 0.55})` },
          ];
          for (const { lw, color } of passes) {
            ctx.beginPath();
            for (let s = 0; s <= drawSegs; s++) {
              const t = s / segs;
              s === 0 ? ctx.moveTo(bpx(t), bpy(t)) : ctx.lineTo(bpx(t), bpy(t));
            }
            ctx.strokeStyle = color; ctx.lineWidth = lw;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
          }

          // Leaves every ~5 segments
          for (let s = 4; s < drawSegs; s += 5) {
            const t = s / segs;
            const lx = bpx(t), ly = bpy(t);
            // tangent direction
            const t2 = Math.min(t + 0.02, 1);
            const tang = Math.atan2(bpy(t2) - ly, bpx(t2) - lx);
            const leafSide = s % 10 < 5 ? 1 : -1;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(tang + leafSide * Math.PI / 3.5);
            ctx.beginPath();
            ctx.ellipse(4, 0, 7, 3, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(70,170,35,${fadeA * 0.85})`; ctx.fill();
            ctx.restore();
          }

          // Whip-tip flash when vine is fully extended
          if (growT >= 1) {
            const flashA = Math.max(0, 1 - Math.max(0, age - growEnd) / 120) * fadeA;
            ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, 10 * flashA), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150,255,80,${flashA * 0.6})`; ctx.fill();
          }
        }
      });
    }

  } else if (type === 'ice') {
    // Ice Beam: expanding cyan beam + crystal shards at impact
    let beamAge = 0;
    ps.push({
      alive: true,
      tick(ms) { beamAge = ms; this.alive = ms < 600; },
      draw(ctx) {
        const growT  = Math.min(beamAge / 300, 1);
        const fadeT  = Math.max(0, (beamAge - 350) / 250);
        const endX   = lerp(from.x, to.x, growT);
        const endY   = lerp(from.y, to.y, growT);
        const a      = (1 - fadeT) * 0.85;
        // outer glow
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(140,230,255,${a * 0.5})`;
        ctx.lineWidth = 10; ctx.stroke();
        // core beam
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(210,245,255,${a})`;
        ctx.lineWidth = 3; ctx.stroke();
        // ice crystals along beam
        if (growT > 0.3) {
          for (let i = 0; i < 5; i++) {
            const bt = (i + 1) / 6;
            if (bt > growT) continue;
            const cx = lerp(from.x, to.x, bt), cy = lerp(from.y, to.y, bt);
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(beamAge * 0.003 + i);
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const ang = (s / 6) * Math.PI * 2;
              ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
            }
            ctx.strokeStyle = `rgba(200,240,255,${a})`; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
          }
        }
      }
    });

  } else if (type === 'fighting') {
    // Close Combat: red impact star burst at target
    for (let i = 0; i < 6; i++) {
      const delay = i * 60;
      const angle = (i / 6) * Math.PI * 2 + rnd(0, 0.5);
      const speed = rnd(1.0, 1.8);
      const life  = rnd(280, 380);
      let px = to.x, py = to.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += Math.cos(angle) * speed * 1.5; py += Math.sin(angle) * speed * 1.5;
          this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          const s = (12 + 8 * (1 - age / life)) * a;
          ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3); ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3); ctx.closePath();
          ctx.fillStyle = `rgba(220,40,40,${a * 0.85})`; ctx.fill();
          ctx.restore();
        }
      });
    }
    // shockwave ring
    let ringAge = 0;
    ps.push({ alive: true,
      tick(ms) { ringAge = ms; this.alive = ms < 350; },
      draw(ctx) {
        const t = ringAge / 350;
        ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(0, t * 45), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,80,80,${(1 - t) * 0.8})`; ctx.lineWidth = 3; ctx.stroke();
      }
    });

  } else if (type === 'poison') {
    // Sludge Bomb: purple bubble stream
    for (let i = 0; i < 18; i++) {
      const delay = i * 25;
      const spread = rnd(-20, 20);
      const speed = rnd(0.55, 0.85);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(380, 540);
      const size = rnd(5, 13);
      let px = from.x + rnd(-5, 5), py = from.y + rnd(-5, 5);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8; py += vy * 1.8; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          const s = size * (0.5 + 0.5 * (1 - age / life));
          const grad = ctx.createRadialGradient(px - s * 0.2, py - s * 0.2, s * 0.1, px, py, s);
          grad.addColorStop(0, `rgba(220,180,255,${a})`);
          grad.addColorStop(0.5, `rgba(160,60,200,${a * 0.9})`);
          grad.addColorStop(1, `rgba(80,0,120,0)`);
          ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
          // bubble highlight
          ctx.beginPath(); ctx.arc(px - s * 0.3, py - s * 0.3, s * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`; ctx.fill();
        }
      });
    }

  } else if (type === 'ground') {
    // Earthquake: brown rock shards + quake wave at target
    for (let i = 0; i < 15; i++) {
      const delay = i * 30;
      const angle = rnd(Math.PI * 1.1, Math.PI * 1.9); // upward spread
      const speed = rnd(1.0, 2.0);
      const life  = rnd(400, 600);
      const size  = rnd(6, 14);
      let px = lerp(from.x, to.x, rnd(0.3, 1.0));
      let py = lerp(from.y, to.y, rnd(0.3, 1.0));
      let vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 2; vy += 0.08; py += vy * 2; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(age * 0.005);
          ctx.beginPath();
          ctx.moveTo(0, -size); ctx.lineTo(size * 0.6, 0); ctx.lineTo(0, size * 0.5);
          ctx.lineTo(-size * 0.6, 0); ctx.closePath();
          ctx.fillStyle = `rgba(160,100,40,${a * 0.9})`; ctx.fill();
          ctx.restore();
        }
      });
    }
    // Quake lines
    let qAge = 0;
    ps.push({ alive: true, tick(ms) { qAge = ms; this.alive = ms < 500; },
      draw(ctx) {
        for (let i = 1; i <= 3; i++) {
          const r = (qAge / 500) * 60 * i / 3;
          const a = (1 - qAge / 500) * 0.6;
          ctx.beginPath(); ctx.ellipse(to.x, to.y, r, r * 0.35, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(140,80,20,${a})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    });

  } else if (type === 'flying') {
    // Wing Attack / Air Slash: white curved wind blades
    for (let i = 0; i < 4; i++) {
      const delay = i * 80;
      const offset = (i - 1.5) * 20;
      const life = 400;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const tx = lerp(from.x, to.x, t);
          const ty = lerp(from.y, to.y, t);
          const perpX = -ny * offset, perpY = nx * offset;
          const a = Math.max(0, Math.sin(t * Math.PI));
          ctx.save(); ctx.translate(tx + perpX, ty + perpY);
          const ang = Math.atan2(dy, dx);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.bezierCurveTo(-10, -12, 10, -12, 20, 0);
          ctx.bezierCurveTo(10, 12, -10, 12, -20, 0);
          ctx.fillStyle = `rgba(200,230,255,${a * 0.75})`; ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (type === 'psychic') {
    // Psychic: pink expanding rings + orbiting sparkles
    let pAge = 0;
    ps.push({ alive: true, tick(ms) { pAge = ms; this.alive = ms < 700; },
      draw(ctx) {
        for (let i = 0; i < 3; i++) {
          const lag = i * 120;
          const t = Math.max(0, Math.min((pAge - lag) / 450, 1));
          if (t <= 0) continue;
          const r = lerp(10, 55, t);
          const a = (1 - t) * 0.7;
          ctx.beginPath(); ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,80,180,${a})`; ctx.lineWidth = 3; ctx.stroke();
        }
        // orbital sparks
        for (let s = 0; s < 5; s++) {
          const ang = (pAge * 0.006) + (s / 5) * Math.PI * 2;
          const orb = lerp(from.x, to.x, Math.min(pAge / 350, 1));
          const orby = lerp(from.y, to.y, Math.min(pAge / 350, 1));
          const r = 18;
          const sx = orb + Math.cos(ang) * r, sy = orby + Math.sin(ang) * r;
          const a = Math.max(0, 1 - Math.max(0, pAge - 400) / 300);
          ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,100,200,${a})`; ctx.fill();
        }
      }
    });

  } else if (type === 'bug') {
    // Bug Buzz: yellow-green spore cloud
    for (let i = 0; i < 25; i++) {
      const delay = i * 15;
      const angle = rnd(0, Math.PI * 2);
      const spread = rnd(-25, 25);
      const speed = rnd(0.5, 0.9);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(300, 500);
      const size = rnd(3, 8);
      let px = from.x, py = from.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8 + Math.sin(age * 0.05 + angle) * 0.4;
          py += vy * 1.8; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.beginPath(); ctx.arc(px, py, Math.max(0, size * a), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150,220,30,${a * 0.85})`; ctx.fill();
        }
      });
    }

  } else if (type === 'rock') {
    // Rock Slide: grey tumbling boulders
    for (let i = 0; i < 10; i++) {
      const delay = i * 40;
      const spread = rnd(-12, 12);
      const speed = rnd(0.75, 1.1);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(350, 500);
      const size = rnd(8, 16);
      const sides = Math.floor(rnd(5, 8));
      let px = from.x + rnd(-8, 8), py = from.y + rnd(-8, 8), rot = rnd(0, Math.PI * 2);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 2.0; py += vy * 2.0; rot += 0.07; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          ctx.beginPath();
          for (let s = 0; s < sides; s++) {
            const ang = (s / sides) * Math.PI * 2;
            const r = size * (0.8 + 0.2 * Math.cos(ang * 3));
            s === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
                    : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(140,130,110,${a * 0.9})`;
          ctx.strokeStyle = `rgba(80,70,60,${a})`; ctx.lineWidth = 1.5;
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      });
    }

  } else if (type === 'ghost') {
    // Shadow Ball: dark purple wisp
    let gAge = 0;
    let px = from.x, py = from.y;
    let wobble = 0;
    ps.push({ alive: true,
      tick(ms) { gAge = ms;
        const t = Math.min(ms / 500, 1);
        px = lerp(from.x, to.x, t); py = lerp(from.y, to.y, t);
        wobble = Math.sin(ms * 0.015) * 8;
        this.alive = ms < 600; },
      draw(ctx) {
        const a = Math.max(0, 1 - Math.max(0, gAge - 450) / 150);
        const s = 22;
        const grad = ctx.createRadialGradient(px + wobble, py, 0, px + wobble, py, s);
        grad.addColorStop(0, `rgba(200,100,255,${a})`);
        grad.addColorStop(0.4, `rgba(100,0,180,${a * 0.8})`);
        grad.addColorStop(1, `rgba(20,0,60,0)`);
        ctx.beginPath(); ctx.arc(px + wobble, py, s, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
        // trailing wisps
        for (let t2 = 0.1; t2 < 1; t2 += 0.2) {
          const trail_t = Math.min(gAge / 500 - t2, 0);
          if (trail_t >= 0) continue;
          const twx = lerp(from.x, to.x, Math.max(0, gAge / 500 - t2));
          const twy = lerp(from.y, to.y, Math.max(0, gAge / 500 - t2));
          ctx.beginPath(); ctx.arc(twx, twy, Math.max(0, s * t2 * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100,0,180,${a * t2 * 0.4})`; ctx.fill();
        }
      }
    });

  } else if (type === 'dragon') {
    // Dragon Rage: rainbow energy beam
    let dAge = 0;
    ps.push({ alive: true, tick(ms) { dAge = ms; this.alive = ms < 700; },
      draw(ctx) {
        const growT = Math.min(dAge / 320, 1);
        const fadeA = Math.max(0, 1 - Math.max(0, dAge - 450) / 250);
        const endX = lerp(from.x, to.x, growT), endY = lerp(from.y, to.y, growT);
        const colors = ['255,60,60','255,160,0','255,255,0','60,220,60','60,160,255','160,80,255'];
        for (let c = 0; c < colors.length; c++) {
          const offset = (c - 2.5) * 3;
          const perpX = -ny * offset, perpY = nx * offset;
          ctx.beginPath();
          ctx.moveTo(from.x + perpX, from.y + perpY);
          ctx.lineTo(endX + perpX, endY + perpY);
          ctx.strokeStyle = `rgba(${colors[c]},${fadeA * 0.7})`;
          ctx.lineWidth = 3; ctx.stroke();
        }
        // white core
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(255,255,255,${fadeA * 0.4})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });

  } else if (type === 'dark') {
    // Dark Pulse / Night Slash: black energy slashes
    for (let i = 0; i < 5; i++) {
      const delay = i * 60;
      const life = 350;
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const t = age / life;
          const tx = lerp(from.x, to.x, t);
          const ty = lerp(from.y, to.y, t);
          const a = Math.sin(t * Math.PI) * 0.9;
          const ang = Math.atan2(dy, dx) + (i - 2) * 0.2;
          const len = 28;
          ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
          ctx.strokeStyle = `rgba(80,0,120,${a})`; ctx.lineWidth = 5;
          ctx.shadowColor = 'rgba(60,0,80,0.8)'; ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
          ctx.strokeStyle = `rgba(200,100,255,${a * 0.5})`; ctx.lineWidth = 1.5;
          ctx.stroke(); ctx.shadowBlur = 0;
          ctx.restore();
        }
      });
    }

  } else if (type === 'steel') {
    // Flash Cannon / Iron Head: silver spark burst at target
    for (let i = 0; i < 20; i++) {
      const delay = i * 18;
      const angle = rnd(0, Math.PI * 2);
      const speed = rnd(0.8, 2.0);
      const life  = rnd(250, 400);
      let px = to.x, py = to.y, age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += Math.cos(angle) * speed * 2; py += Math.sin(angle) * speed * 2;
          this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.beginPath();
          ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(angle) * 10, py - Math.sin(angle) * 10);
          ctx.strokeStyle = `rgba(200,210,220,${a})`; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, Math.max(0, 2.5 * a), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(240,245,255,${a})`; ctx.fill();
        }
      });
    }

  } else if (type === 'fairy') {
    // Moonblast: pink sparkles + stars
    for (let i = 0; i < 22; i++) {
      const delay = i * 20;
      const spread = rnd(-30, 30);
      const speed = rnd(0.5, 0.9);
      const cos = Math.cos(spread * Math.PI / 180);
      const sin = Math.sin(spread * Math.PI / 180);
      const vx = (nx * cos - ny * sin) * speed;
      const vy = (ny * cos + nx * sin) * speed;
      const life = rnd(350, 550);
      const size = rnd(4, 9);
      let px = from.x + rnd(-6, 6), py = from.y + rnd(-6, 6), rot = rnd(0, Math.PI);
      let age = -delay;
      ps.push({
        alive: true,
        tick(ms) { age = ms - delay; if (age < 0) { this.alive = true; return; }
          px += vx * 1.8; py += vy * 1.8; rot += 0.08; this.alive = age < life; },
        draw(ctx) {
          if (age < 0) return;
          const a = Math.max(0, 1 - age / life);
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          // 4-point star
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const ang = (s / 8) * Math.PI * 2;
            const r = s % 2 === 0 ? size : size * 0.4;
            s === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
                    : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(255,140,200,${a * 0.9})`; ctx.fill();
          ctx.restore();
        }
      });
    }

  } else {
    // Normal: white energy orb traveling to target
    let px = from.x, py = from.y, nAge = 0;
    ps.push({ alive: true,
      tick(ms) { nAge = ms;
        const t = Math.min(ms / 400, 1);
        px = lerp(from.x, to.x, t); py = lerp(from.y, to.y, t);
        this.alive = ms < 450; },
      draw(ctx) {
        const a = Math.max(0, 1 - Math.max(0, nAge - 350) / 100);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 18);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, `rgba(200,200,200,0)`);
        ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    });
  }

  return ps;
}

// Visual turn-by-turn battle animation
async function animateBattleVisually(detailedLog, pTeamInit, eTeamInit) {
  renderBattleField(pTeamInit, eTeamInit);

  const logEl = document.getElementById('battle-log');
  if (logEl) logEl.innerHTML = '';

  // Track live HP during animation
  const pHp = pTeamInit.map(p => ({ current: p.currentHp, max: p.maxHp }));
  const eHp = eTeamInit.map(p => ({
    current: p.currentHp !== undefined ? p.currentHp : p.maxHp,
    max: p.maxHp,
  }));

  function addLogEntry(msg, cls = '') {
    if (!logEl) return;
    const div = document.createElement('div');
    div.className = `log-entry ${cls}`;
    div.textContent = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function sleep(ms) {
    if (skipBattleAnimation) return Promise.resolve();
    return new Promise(r => setTimeout(r, ms));
  }

  for (const event of detailedLog) {
    if (event.type === 'attack') {
      const attackerSideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const targetSideId = event.side === 'player' ? 'enemy-side' : 'player-side';
      const attackerEl = document.querySelector(`#${attackerSideId} .battle-pokemon[data-idx="${event.attackerIdx}"]`);
      const targetEl = document.querySelector(`#${targetSideId} .battle-pokemon[data-idx="${event.targetIdx}"]`);
      const hitClass = `hit-${event.moveType.toLowerCase()}`;

      if (attackerEl) attackerEl.classList.add('attacking');

      // Play canvas projectile animation concurrently with attacker pulse
      if (attackerEl && targetEl) {
        await playAttackAnimation(event.moveType, attackerEl, targetEl);
      } else {
        await sleep(220);
      }
      if (attackerEl) attackerEl.classList.remove('attacking');

      // Hit flash + SFX on target while HP bar animates
      if (typeof GameAudio !== 'undefined') GameAudio.sfxHit(event.moveType);
      if (targetEl) targetEl.classList.add(hitClass);
      if (targetEl) {
        const targetHpTrack = event.side === 'player' ? eHp : pHp;
        const prev = targetHpTrack[event.targetIdx].current;
        await animateHpBar(targetEl, prev, event.targetHpAfter, targetHpTrack[event.targetIdx].max);
        targetHpTrack[event.targetIdx].current = event.targetHpAfter;
      }

      await sleep(300);
      if (targetEl) targetEl.classList.remove(hitClass);

      let effText = '';
      if (event.typeEff >= 2) effText = ' Super effective!';
      else if (event.typeEff === 0) effText = ' No effect!';
      else if (event.typeEff < 1) effText = ' Not very effective...';

      const sideLabel = event.side === 'player' ? '' : '(enemy) ';
      addLogEntry(
        `${sideLabel}${event.attackerName} used ${event.moveName} → ${event.targetName} took ${event.damage} dmg.${effText}`,
        event.side === 'player' ? 'log-player' : 'log-enemy'
      );

      await sleep(100);

    } else if (event.type === 'effect') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      const teamHp = event.side === 'player' ? pHp : eHp;
      const prev = teamHp[event.idx].current;

      if (el) {
        await animateHpBar(el, prev, event.hpAfter, teamHp[event.idx].max);
      }
      teamHp[event.idx].current = event.hpAfter;

      addLogEntry(event.reason, 'log-item');
      await sleep(100);

    } else if (event.type === 'faint') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) { el.classList.add('fainted'); el.classList.remove('active-pokemon'); }
      addLogEntry(`${event.name} fainted!`, 'log-faint');
      await sleep(300);

    } else if (event.type === 'send_out') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      // Clear previous active highlight on this side
      document.querySelectorAll(`#${sideId} .battle-pokemon`).forEach(el => el.classList.remove('active-pokemon'));
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) el.classList.add('active-pokemon');
      addLogEntry(`${event.name} was sent out!`, event.side === 'player' ? 'log-player' : 'log-enemy');
      await sleep(250);

    } else if (event.type === 'transform') {
      const sideId = event.side === 'player' ? 'player-side' : 'enemy-side';
      const el = document.querySelector(`#${sideId} .battle-pokemon[data-idx="${event.idx}"]`);
      if (el) {
        // Flash white, swap sprite, update name display
        el.classList.add('hit-normal');
        await sleep(200);
        const imgEl = el.querySelector('.battle-sprite');
        if (imgEl) imgEl.src = event.spriteUrl;
        const nameEl = el.querySelector('.battle-poke-name');
        if (nameEl) nameEl.textContent = `${event.name} Lv${pTeamInit[event.idx].level}`;
        el.classList.remove('hit-normal');
      }
      addLogEntry(`${event.name} transformed into ${event.intoName}!`, 'log-player');
      await sleep(400);

    } else if (event.type === 'result') {
      addLogEntry(
        event.playerWon ? '--- Victory! ---' : '--- Defeat! ---',
        event.playerWon ? 'log-win' : 'log-lose'
      );
    }
  }
}

// Show a brief notification banner on the map screen
function showMapNotification(msg) {
  const mapScreen = document.getElementById('map-screen');
  if (!mapScreen) return;

  const existing = mapScreen.querySelector('.map-notification');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'map-notification';
  div.textContent = msg;
  mapScreen.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 1800);
}

// Render trainer sprites on both battle sides
function renderTrainerIcons(gender, enemyName = null) {
  const playerEl = document.getElementById('player-trainer-icon');
  const enemyEl  = document.getElementById('enemy-trainer-icon');
  if (playerEl) playerEl.innerHTML = TRAINER_SVG[gender] || TRAINER_SVG.boy;
  if (enemyEl) {
    enemyEl.innerHTML = enemyName ? getTrainerImgHtml(enemyName) : TRAINER_SVG.npc;
    // Mirror to face player
    const img = enemyEl.querySelector('img');
    if (img) img.style.transform = 'scaleX(-1)';
  }
}

// Play the classic white-flash evolution animation
async function playEvoAnimation(pokemon, evoData) {
  const overlay  = document.getElementById('evo-overlay');
  const msgEl    = document.getElementById('evo-msg');
  const spriteEl = document.getElementById('evo-sprite');
  if (!overlay) return;

  const newSpriteUrl = pokemon.isShiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evoData.into}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoData.into}.png`;
  const oldSpriteUrl = pokemon.spriteUrl || '';
  const displayName  = pokemon.nickname || pokemon.name;

  msgEl.textContent = `What? ${displayName} is evolving!`;
  spriteEl.src = oldSpriteUrl;
  spriteEl.style.filter = 'brightness(0) invert(1)'; // white silhouette
  overlay.style.background = '#111';
  overlay.style.display = 'flex';
  if (typeof GameAudio !== 'undefined') GameAudio.sfxEvolution();

  let skipped = false;
  const skipResolve = new Promise(r => {
    overlay.onclick = () => { skipped = true; r(); };
  });
  const sleep = ms => skipped ? Promise.resolve() : Promise.race([new Promise(r => setTimeout(r, ms)), skipResolve]);

  // Alternate between old and new silhouette, slow → fast (like the GB games)
  const delays = [600, 600, 500, 500, 400, 350, 280, 200, 150, 110, 80, 60, 50, 40, 40, 35];
  for (const d of delays) {
    if (skipped) break;
    spriteEl.src = (spriteEl.src.endsWith(oldSpriteUrl) || spriteEl.src === oldSpriteUrl)
      ? newSpriteUrl : oldSpriteUrl;
    await sleep(d);
  }

  // End on new sprite — single white flash to reveal
  spriteEl.src = newSpriteUrl;
  overlay.style.background = '#fff';
  await sleep(120);
  overlay.style.background = '#111';
  spriteEl.style.filter = ''; // show in full color

  msgEl.textContent = `${displayName} evolved into ${evoData.name}!`;
  await sleep(2000);

  overlay.style.display = 'none';
  overlay.style.background = '#000';
  overlay.onclick = null;
  spriteEl.style.filter = '';
}

// Show Eevee evolution choice and return the chosen evoData (from EEVEE_EVOLUTIONS)
function showEeveeChoice(pokemon) {
  return new Promise(resolve => {
    const overlay  = document.getElementById('eevee-choice-overlay');
    const choicesEl = document.getElementById('eevee-choices');
    choicesEl.innerHTML = '';

    for (const evoData of EEVEE_EVOLUTIONS) {
      const spriteUrl = pokemon.isShiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evoData.into}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoData.into}.png`;

      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;' +
        'border:2px solid #555;border-radius:8px;padding:12px 16px;background:#1a1a1a;' +
        'transition:border-color 0.15s,background 0.15s;';
      card.onmouseenter = () => { card.style.borderColor = '#fff'; card.style.background = '#2a2a2a'; };
      card.onmouseleave = () => { card.style.borderColor = '#555'; card.style.background = '#1a1a1a'; };

      const img = document.createElement('img');
      img.src = spriteUrl;
      img.style.cssText = 'width:72px;height:72px;image-rendering:pixelated;';

      const nameEl = document.createElement('div');
      nameEl.textContent = evoData.name;
      nameEl.style.cssText = "font-family:'Press Start 2P',monospace;font-size:8px;color:#fff;";

      const typeEl = document.createElement('div');
      typeEl.textContent = evoData.types.join('/');
      typeEl.style.cssText = "font-family:'Press Start 2P',monospace;font-size:7px;color:#aaa;";

      card.append(img, nameEl, typeEl);
      card.onclick = () => {
        overlay.style.display = 'none';
        resolve(evoData);
      };
      choicesEl.appendChild(card);
    }

    overlay.style.display = 'flex';
  });
}

// Check team for pending evolutions after a won battle and play animations
async function checkAndEvolveTeam() {
  for (const pokemon of state.team) {
    if (pokemon.currentHp <= 0) continue;

    let evo;
    if (pokemon.speciesId === 133) {
      // Eevee — show choice at level 36
      if (pokemon.level < 36) continue;
      evo = await showEeveeChoice(pokemon);
    } else {
      evo = GEN1_EVOLUTIONS[pokemon.speciesId];
      if (!evo || pokemon.level < evo.level) continue;
      if (pokemon.speciesId === evo.into) continue;
    }

    await playEvoAnimation(pokemon, evo);

    const oldHpRatio = pokemon.currentHp / pokemon.maxHp;
    const newSpecies = await fetchPokemonById(evo.into);

    pokemon.speciesId = evo.into;
    pokemon.name      = evo.name;
    pokemon.spriteUrl = pokemon.isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${evo.into}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evo.into}.png`;

    if (newSpecies) {
      pokemon.types     = newSpecies.types;
      pokemon.baseStats = newSpecies.baseStats;
      const newMax      = calcHp(newSpecies.baseStats.hp, pokemon.level);
      pokemon.maxHp     = newMax;
      pokemon.currentHp = Math.max(1, Math.floor(oldHpRatio * newMax));
    }
  }
}

// Animate level-up events returned by applyLevelGain
async function animateLevelUp(levelUps) {
  const pEl = document.getElementById('player-side');
  if (!pEl || levelUps.length === 0) return;
  const sleep = ms => skipBattleAnimation ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

  for (const { idx, pokemon, newLevel, preHp } of levelUps) {
    const el = pEl.querySelector(`.battle-pokemon[data-idx="${idx}"]`);
    if (!el) continue;

    // Animate HP bar filling up (alive pokemon only)
    if (pokemon.currentHp > 0 && pokemon.currentHp > preHp) {
      await animateHpBar(el, preHp, pokemon.currentHp, pokemon.maxHp, 400);
    }

    // Golden glow + floating "Lv X!" text
    if (typeof GameAudio !== 'undefined') GameAudio.sfxLevelUp();
    el.classList.add('level-up');
    const lvText = document.createElement('div');
    lvText.className = 'level-up-text';
    lvText.textContent = `Lv ${newLevel}!`;
    el.appendChild(lvText);

    await sleep(900);
    el.classList.remove('level-up');
    lvText.remove();

    // Update name/level label after animation
    const nameEl = el.querySelector('.battle-poke-name');
    if (nameEl) nameEl.textContent = `${pokemon.nickname || pokemon.name} Lv${newLevel}`;
  }
}

// Legacy: animate battle log line by line (kept for fallback)
function animateBattleLog(log, delay = 50) {
  return new Promise(resolve => {
    const el = document.getElementById('battle-log');
    if (!el) { resolve(); return; }
    el.innerHTML = '';
    let i = 0;
    function next() {
      if (i >= log.length) { resolve(); return; }
      const entry = log[i++];
      const div = document.createElement('div');
      div.className = `log-entry ${entry.cls||''}`;
      div.textContent = entry.msg;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
      setTimeout(next, delay);
    }
    next();
  });
}

// ---- Achievement Toast ----

let _toastQueue = [];
let _toastRunning = false;

function showAchievementToast(ach) {
  _toastQueue.push(ach);
  if (!_toastRunning) _runToastQueue();
}

function _runToastQueue() {
  if (_toastQueue.length === 0) { _toastRunning = false; return; }
  _toastRunning = true;
  const ach = _toastQueue.shift();

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<span class="ach-toast-icon">${ach.icon}</span>
    <div class="ach-toast-text">
      <div class="ach-toast-label">Achievement Unlocked!</div>
      <div class="ach-toast-name">${ach.name}</div>
    </div>`;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.remove(); _runToastQueue(); }, 400);
  }, 3000);
}

// ---- Achievements Modal ----

function openAchievementsModal() {
  const existing = document.getElementById('achievements-modal');
  if (existing) { existing.remove(); return; }

  const unlocked = getUnlockedAchievements();

  const modal = document.createElement('div');
  modal.id = 'achievements-modal';
  modal.innerHTML = `
    <div class="ach-modal-box">
      <div class="ach-modal-header">
        <span>Achievements (${unlocked.size}/${ACHIEVEMENTS.length})</span>
        <button class="ach-modal-close" onclick="document.getElementById('achievements-modal').remove()">✕</button>
      </div>
      <div class="ach-modal-grid">
        ${ACHIEVEMENTS.map(a => {
          const done = unlocked.has(a.id);
          return `<div class="ach-card ${done ? 'unlocked' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${done ? a.desc : '???'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ---- Pokedex Modal ----

function openPokedexModal(initialTab = 'normal') {
  const existing = document.getElementById('pokedex-modal');
  if (existing) { existing.remove(); return; }

  const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

  function buildNormalGrid() {
    const dex = getPokedex();
    const caughtCount = Object.keys(dex).length;
    const grid = Array.from({ length: 151 }, (_, i) => {
      const id = i + 1;
      const e = dex[id];
      if (e) {
        const types = (e.types || []).map(t =>
          `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('');
        return `<div class="dex-card dex-caught">
          <div class="dex-num">#${String(id).padStart(3,'0')}</div>
          <img src="${e.spriteUrl || BASE + id + '.png'}" alt="${e.name}" class="dex-sprite"
               onerror="this.src='';this.style.display='none'">
          <div class="dex-name">${e.name}</div>
          <div class="dex-types">${types}</div>
        </div>`;
      }
      return `<div class="dex-card dex-unknown">
        <div class="dex-num">#${String(id).padStart(3,'0')}</div>
        <img src="${BASE + id + '.png'}" alt="???" class="dex-sprite dex-silhouette"
             onerror="this.src='';this.style.display='none'">
        <div class="dex-name dex-unknown-name">???</div>
      </div>`;
    }).join('');
    return { grid, count: caughtCount };
  }

  function buildShinyGrid() {
    const dex = getShinyDex();
    const BASE_SHINY = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/';
    const count = Object.keys(dex).length;
    const grid = Array.from({ length: 151 }, (_, i) => {
      const id = i + 1;
      const e = dex[id];
      if (e) {
        const types = (e.types || []).map(t =>
          `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('');
        return `<div class="dex-card shiny-dex-card">
          <div class="dex-num">#${String(id).padStart(3,'0')}</div>
          <img src="${e.shinySpriteUrl || BASE_SHINY + id + '.png'}" alt="${e.name}" class="dex-sprite"
               onerror="this.src='';this.style.display='none'">
          <div class="dex-name">${e.name}</div>
          <div class="dex-types">${types}</div>
          <div class="shiny-star">★</div>
        </div>`;
      }
      return `<div class="dex-card dex-unknown">
        <div class="dex-num">#${String(id).padStart(3,'0')}</div>
        <img src="${BASE_SHINY + id + '.png'}" alt="???" class="dex-sprite dex-silhouette"
             onerror="this.src='';this.style.display='none'">
        <div class="dex-name dex-unknown-name">???</div>
      </div>`;
    }).join('');
    return { grid, count };
  }

  const modal = document.createElement('div');
  modal.id = 'pokedex-modal';
  modal.innerHTML = `
    <div class="dex-modal-box">
      <div class="dex-modal-header">
        <div class="dex-tabs">
          <button class="dex-tab" data-tab="normal">📖 Pokédex</button>
          <button class="dex-tab" data-tab="shiny">✨ Shiny</button>
        </div>
        <span class="dex-counts" id="dex-count-label"></span>
        <button class="ach-modal-close" onclick="document.getElementById('pokedex-modal').remove()">✕</button>
      </div>
      <div class="dex-grid" id="dex-grid-content"></div>
    </div>`;

  function switchTab(tab) {
    modal.querySelectorAll('.dex-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    modal.querySelector('.dex-modal-box').classList.toggle('shiny-dex-box', tab === 'shiny');
    const { grid, count } = tab === 'shiny' ? buildShinyGrid() : buildNormalGrid();
    document.getElementById('dex-grid-content').innerHTML = grid;
    document.getElementById('dex-count-label').textContent =
      tab === 'shiny' ? `Caught: ${count} / 151` : `Caught: ${count} / 151`;
  }

  modal.querySelectorAll('.dex-tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  switchTab(initialTab);
}

function openShinyDexModal() { openPokedexModal('shiny'); }
