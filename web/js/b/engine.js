(() => {
  'use strict';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (v, n) => ((v % n) + n) % n;
  const TAU = Math.PI * 2;

  /* ======================= Runway section ======================= */
  const FEEL = { balanced: { K: 95, lag: 0.04 } };
  const HEADER_SEL = '.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar';

  class RunwaySection extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      try { this.setup(); } catch (err) { console.error(err); }
    }

    disconnectedCallback() { this.teardown(); }

    setup() {
      const q = (s) => this.querySelector(s);
      const qa = (s) => [...this.querySelectorAll(s)];
      const d = this.dataset;
      const feel = FEEL[d.feel] || FEEL.balanced;
      this.K = feel.K;
      this.C = 2 * Math.sqrt(this.K);
      this.lag = feel.lag;
      this.cfg = {
        blur: d.blur === 'true', style: d.style || 'ring', mstyle: d.mstyle || 'classic', fit: d.fit === 'true',
        mheightMode: d.mheightMode, mheightVh: parseFloat(d.mheightVh) || 100, autoplay: d.autoplay === 'true',
        speed: parseInt(d.speed, 10) || 5000,
      };
      this.msgChoose = d.msgChoose || 'Pick a size for: [items]';
      this.msgError = d.msgError || 'Couldn’t add to bag. Please try again.';
      this.msgSoldout = d.msgSoldout || 'Sold out';

      this.stage = q('[data-rw-stage]');
      this.actors = q('[data-rw-actors]');
      this.heroes = qa('[data-rw-hero]');
      this.ticks = qa('[data-rw-tick]');
      this.panels = qa('[data-rw-panel]');
      this.panelEl = q('.rw__panel');
      this.pieces = q('[data-rw-pieces]');
      this.live = q('[data-rw-live]');
      this.lb = q('[data-rw-lb]');
      this.lbStage = q('[data-rw-lb-stage]');
      this.cursor = q('[data-rw-cursor]');
      this.autoBtn = q('[data-rw-auto]');
      this.n = this.heroes.length;

      // bodies: originals + clones up to N = n * ceil(8 / n)
      const originals = qa('[data-rw-model]');
      const N = this.n * Math.ceil(8 / this.n);
      for (let a = originals.length; a < N; a++) {
        const c = originals[a % this.n].cloneNode(true);
        c.setAttribute('data-rw-clone', '');
        c.dataset.index = String(a);
        c.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; img.classList.remove('is-decoded'); });
        this.actors.append(c);
      }
      this.N = N;
      this.start = reduced() ? 0 : 1.15;
      this.bodies = qa('[data-rw-model]').map((el, a) => ({
        el, a, look: a % this.n, w: 0, x: 0, v: 0, g: 0, prevGoal: null, trip: false, from: 0, tripGoal: 0, filter: -1,
        hit: el.querySelector('.rw__hit'),
      }));

      this.index = 0;
      this.target = 0;
      this.cur = -this.start;
      this.vel = 0;
      this.still = false;
      this.playing = false;
      this.engaged = false;
      this.panelHover = false;
      this.zoomed = false;
      this.dragging = false;
      this.visible = false;
      this.raf = 0;
      this.lastT = 0;
      this._tick = (t) => this.loop(t);
      this.listeners = [];
      this.timers = new Set();

      // cards
      this.panels.forEach((p) => p.querySelectorAll('.rw__item').forEach((card) => {
        const picker = card.querySelector('[data-rw-picker]');
        card._picker = picker;
        card._add = card.querySelector('[data-rw-add]');
        if (picker) {
          picker._card = card;
          try { card._variants = JSON.parse(picker.querySelector('[data-rw-variants]')?.textContent || '[]'); } catch { card._variants = []; }
          this.updateVariant(card, false);
        }
      }));

      this.makeSheetHost();
      this.classList.add('rw--js');
      if (window.Shopify && window.Shopify.designMode) this.classList.add('rw--design');

      // classic springs start 1.15 places further back
      this.bodies.forEach((s) => { s.prevGoal = mod(s.a - this.target, this.N); s.x = s.g = s.prevGoal + this.start; });

      this.measure();
      this.setIndex(0, true);
      this.renderAll();
      this.decodeImages();
      this.heroes.forEach((_, i) => this.probe(i));
      this.bind();
      this.reveal();

      if (this.cfg.autoplay && !reduced() && !this.classList.contains('rw--design')) this.play(true);
    }

    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.listeners.push([target, type, fn, opts]); }
    later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }

    teardown() {
      cancelAnimationFrame(this.raf); this.raf = 0;
      cancelAnimationFrame(this.cRaf);
      clearTimeout(this.autoTimer); clearTimeout(this.resizeT); clearTimeout(this.lbT);
      this.timers?.forEach((t) => clearTimeout(t));
      this.io?.disconnect(); this.revealIO?.disconnect(); this.ro?.disconnect();
      this.listeners?.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
      this.listeners = [];
      this.panels?.forEach((p) => p.querySelectorAll('.rw__item').forEach((c) => this.dock(c)));
      this.host?.remove();
      this._ready = false;
    }

    /* ---------- measuring ---------- */
    headerHeight() {
      let h = 0;
      document.querySelectorAll(HEADER_SEL).forEach((el) => {
        if (el.contains(this)) return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && getComputedStyle(el).display !== 'none') h += r.height;
      });
      return h;
    }

    measure() {
      const mobile = window.innerWidth <= 749;
      const wasMobile = this.mobile;
      this.mobile = mobile;
      this.mode = mobile ? this.cfg.mstyle : this.cfg.style;
      let frameH;
      if (mobile) {
        if (!this.vh || window.innerWidth !== this.vw || Math.abs(window.innerHeight - this.vh) >= 160) {
          this.vh = window.innerHeight; this.vw = window.innerWidth;
        }
        const pct = this.cfg.mheightMode === 'custom' ? clamp(this.cfg.mheightVh, 50, 120) : 100;
        frameH = this.vh * pct / 100;
      } else {
        this.vw = window.innerWidth;
        frameH = this.cfg.fit ? Math.max(380, window.innerHeight - this.headerHeight()) : Math.max(380, window.innerHeight);
      }
      this.style.setProperty('--rw-frame-h', `${Math.round(frameH)}px`);

      const r = this.stage.getBoundingClientRect();
      this.W = r.width; this.H = r.height;
      const ring = this.mode === 'ring';
      this.fs = ring ? 1.08 : 1;
      let modelH;
      if (ring) modelH = Math.max(200, Math.round((this.H - 34 - 18) / 1.08));
      else modelH = Math.max(200, Math.round(this.H - (mobile ? 24 : 36) - 18));
      this.stage.style.setProperty('--rw-model-h', `${modelH}px`);
      this.stage.style.setProperty('--rw-fs', String(this.fs));
      let hx, hy;
      if (ring) { hx = 0.5 * this.W; hy = 34; } else { hx = (mobile ? 0.3 : 0.4) * this.W; hy = mobile ? 22 : 36; }
      this.stage.style.setProperty('--rw-hx', `${hx}px`);
      this.stage.style.setProperty('--rw-hy', `${hy}px`);
      this.style.setProperty('--rw-ax', `${this.W ? (hx / this.W * 100).toFixed(2) : 40}%`);
      this.unit = ring ? Math.max(mobile ? 90 : 120, 0.3 * this.W)
        : (mobile ? Math.max(90, this.W * 0.32 * 1.6) : Math.max(120, this.W * 0.125 * 1.6));
      this.bodies.forEach((s) => { s.w = s.el.offsetWidth; });
      if (wasMobile && !mobile) this.panels.forEach((p) => p.querySelectorAll('.rw__item').forEach((c) => {
        if (c._picker && !c._picker.hidden) { this.dock(c); }
      }));
      if (wasMobile !== undefined && wasMobile !== mobile) {
        // re-seat classic springs at their goals when switching layouts
        this.bodies.forEach((s) => { s.prevGoal = mod(s.a - this.target, this.N); s.x = s.g = s.prevGoal; s.v = 0; s.trip = false; });
        this.cur = this.target; this.vel = 0;
      }
      this.renderAll();
      this.kick();
    }

    /* ---------- placement ---------- */
    put(s, x, bottom, scale, opacity, blur, z) {
      const half = (s.w * scale) / 2;
      if (x + half < -4 || x - half > this.W + 4) opacity = 0;
      const st = s.el.style;
      st.transform = `translate3d(${x.toFixed(2)}px,${(-bottom).toFixed(2)}px,0) translateX(-50%) scale(${scale.toFixed(4)})`;
      st.opacity = opacity.toFixed(3);
      st.zIndex = String(z);
      st.visibility = opacity < 0.01 ? 'hidden' : '';
      st.pointerEvents = opacity < 0.5 ? 'none' : '';
      const b = this.cfg.blur ? Math.round(blur * 10) / 10 : 0;
      if (b !== s.filter) {
        s.filter = b;
        st.filter = b > 0.05 ? `blur(${b}px)` : '';
      }
    }

    renderAll() {
      if (!this.W) return;
      if (this.mode === 'ring') this.renderRing(); else this.renderClassic();
    }

    renderRing() {
      const { W, H, N } = this;
      const mobile = this.mobile;
      const cx = 0.5 * W, R = (mobile ? 0.72 : 0.62) * W, P = (mobile ? 1.9 : 1.65) * W;
      const floor = H - 34, horizon = 0.36 * H, step = TAU / N;
      for (const s of this.bodies) {
        let phi = mod((s.a - this.cur) * step, TAU);
        if (phi > Math.PI) phi -= TAU;
        const z = R * (1 - Math.cos(phi));
        const persp = P / (P + z);
        const sl = Math.abs(phi) / step;
        const scale = persp * (1 + (this.fs - 1) * clamp(1 - sl, 0, 1));
        const x = cx + R * Math.sin(phi) * persp;
        const feet = horizon + (floor - horizon) * persp;
        const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
        let op = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
        if (this.still && sl < 0.02) op = 0;
        this.put(s, x, H - feet, scale, op, blur, Math.round(scale * 1000));
      }
    }

    classicConst() {
      return this.mobile
        ? { ax: 0.3, ay: 22, sx: 0.32, sy: 22, sr: 0.76, ex: 0.55, d: 4 }
        : { ax: 0.4, ay: 36, sx: 0.125, sy: 58, sr: 0.76, ex: 0.38, d: 5 };
    }

    renderClassic() {
      const { W } = this;
      const c = this.classicConst();
      for (const s of this.bodies) {
        let k = s.x, e = -1;
        if (s.trip) {
          const span = Math.abs(s.tripGoal - s.from) || 1;
          const u = clamp(Math.abs(s.x - s.from) / span, 0, 1);
          if (s.tripGoal > s.from) {
            if (u < 0.5) e = 2 * u * 1.4; else k = s.tripGoal + 2 * (1 - u);
          } else if (u < 0.5) k = s.from + 2 * u; else e = 2 * (1 - u) * 1.4;
        } else if (k < 0) e = Math.min(-k, 1.4);
        if (e >= 0) {
          this.put(s, W * (c.ax - c.ex * e), c.ay - 22 * e, 1 + 0.14 * e, Math.max(0, 1 - 1.05 * e), 4 * Math.min(e, 1), 1100);
        } else {
          let op = k <= c.d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (c.d - k));
          if (this.still && Math.abs(k) < 0.02) op = 0;
          this.put(s, W * (c.ax + c.sx * k), c.ay + c.sy * k, Math.pow(c.sr, k), op, Math.min(0.9 * Math.max(k, 0), 3.2), 1000 - Math.round(10 * k));
        }
      }
    }

    /* ---------- physics ---------- */
    stepRing(dt) {
      if (reduced()) { this.cur = this.target; this.vel = 0; return false; }
      const h = dt / 3;
      for (let i = 0; i < 3; i++) {
        const acc = -this.K * (this.cur - this.target) - this.C * this.vel;
        this.vel += acc * h;
        this.cur += this.vel * h;
      }
      if (Math.abs(this.cur - this.target) <= 0.0005 && Math.abs(this.vel) <= 0.0005) {
        this.cur = this.target; this.vel = 0; return false;
      }
      return true;
    }

    stepClassic(dt) {
      let moving = false;
      for (const s of this.bodies) {
        const goal = mod(s.a - this.target, this.N);
        if (s.prevGoal !== null && Math.abs(goal - s.prevGoal) > this.N / 2) {
          s.trip = true; s.from = s.x; s.g = goal; s.v = 0;
        }
        s.prevGoal = goal;
        if (s.trip) s.tripGoal = goal;
        if (reduced()) { s.x = s.g = goal; s.v = 0; s.trip = false; continue; }
        const tau = this.dragging ? 0.016 : s.trip ? 0.1 : 0.03 + this.lag * Math.min(goal, 4);
        s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));
        const h = dt / 3;
        for (let i = 0; i < 3; i++) {
          const acc = -this.K * (s.x - s.g) - this.C * s.v;
          s.v += acc * h;
          s.x += s.v * h;
        }
        if (s.trip && Math.abs(s.x - goal) < 0.02) s.trip = false;
        if (Math.abs(s.x - goal) <= 0.0006 && Math.abs(s.v) <= 0.0006 && Math.abs(s.g - goal) <= 0.0006) {
          s.x = s.g = goal; s.v = 0; s.trip = false;
        } else moving = true;
      }
      return moving;
    }

    loop(t) {
      this.raf = 0;
      const dt = this.lastT ? Math.min(0.034, (t - this.lastT) / 1000) : 1 / 60;
      this.lastT = t;
      const moving = this.mode === 'ring' ? this.stepRing(dt) : this.stepClassic(dt);
      if (moving || this.dragging) {
        this.setStill(false);
        this.renderAll();
        if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this._tick);
        else this.lastT = 0;
      } else {
        this.lastT = 0;
        this.setStill(true);
        this.renderAll();
      }
    }

    kick() {
      if (this.raf || !this.visible || document.hidden) return;
      this.lastT = 0;
      this.raf = requestAnimationFrame(this._tick);
    }

    setStill(v) {
      if (this.still === v) return;
      this.still = v;
      this.classList.toggle('rw--still', v);
    }

    /* ---------- index & navigation ---------- */
    rank(a) {
      let k = mod(Math.round(a - this.target), this.N);
      if (this.mode === 'ring' && k > this.N / 2) k -= this.N;
      return k;
    }

    a11yBodies() {
      const lim = this.mode === 'ring' ? 2 : 3;
      for (const s of this.bodies) {
        const k = this.rank(s.a);
        const on = k !== 0 && Math.abs(k) <= lim;
        s.hit.tabIndex = on ? 0 : -1;
        if (on) s.el.removeAttribute('aria-hidden'); else s.el.setAttribute('aria-hidden', 'true');
      }
    }

    setIndex(i, silent = false) {
      const old = this.index;
      const changed = silent || i !== old;
      this.index = i;
      this.kick();
      this.a11yBodies();
      if (changed) {
        this.closeLb();
        if (this.mobile) this.closeSheets();
        this.style.setProperty('--rw-progress', ((i + 1) / this.n).toFixed(3));
        this.heroes.forEach((h, j) => {
          h.classList.toggle('is-on', j === i);
          h.classList.toggle('was', !silent && j === old && j !== i);
          h.setAttribute('aria-hidden', j === i ? 'false' : 'true');
          const z = h.querySelector('[data-rw-zoom]');
          if (z) z.tabIndex = j === i ? 0 : -1;
        });
        if (!silent) {
          this.sweep();
          if (this.live) this.live.textContent = this.heroes[i].dataset.label;
        }
        this.ticks.forEach((t, j) => {
          t.setAttribute('aria-current', j === i ? 'true' : 'false');
          t.classList.toggle('is-past', j < i);
        });
        const panel = this.panels[i];
        this.panels.forEach((p, j) => { p.hidden = j !== i; if (!silent) p.classList.remove('is-in'); });
        if (!silent) { void panel.offsetWidth; panel.classList.add('is-in'); }
        const tpl = panel.querySelector('template[data-rw-pieces-text]');
        if (this.pieces && tpl) {
          this.pieces.textContent = tpl.content.textContent.trim();
          if (!silent) { this.pieces.classList.remove('is-swap'); void this.pieces.offsetWidth; this.pieces.classList.add('is-swap'); }
        }
        this.clearHot();
      }
      this.restartBar();
    }

    moveTo(T) {
      this.target = T;
      this.setStill(false);
      this.setIndex(mod(T, this.n));
    }

    next() { this.moveTo(Math.round(this.target) + 1); }
    prev() { this.moveTo(Math.round(this.target) - 1); }
    go(i) {
      let dd = mod(i - this.index, this.n);
      if (dd > this.n / 2) dd -= this.n;
      this.moveTo(Math.round(this.target) + dd);
    }

    sweep() {
      if (reduced()) return;
      this.stage.classList.remove('is-sweep');
      void this.stage.offsetWidth;
      this.stage.classList.add('is-sweep');
    }

    /* ---------- autoplay ---------- */
    play(on) {
      this.playing = on;
      this.classList.toggle('is-playing', on);
      this.autoBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
      this.restartBar();
    }

    restartBar() {
      clearTimeout(this.autoTimer);
      this.ticks.forEach((t) => t.classList.remove('is-run'));
      if (!this.playing) return;
      const t = this.ticks[this.index];
      if (t) { void t.offsetWidth; t.classList.add('is-run'); }
      this.autoTimer = setTimeout(() => this.onTimer(), this.cfg.speed);
    }

    onTimer() {
      if (this.playing && this.visible && !this.dragging && !document.hidden && !this.panelHover && !this.zoomed && !this.engaged) this.next();
      else this.restartBar();
    }

    engage() {
      this.engaged = true;
      if (this.playing) this.play(false);
    }

    /* ---------- reveal, images, feet ---------- */
    reveal() {
      if (reduced()) { this.classList.add('is-revealed'); return; }
      this.revealIO = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.revealIO.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => this.classList.add('is-revealed')));
      }, { threshold: 0, rootMargin: '0px 0px -22% 0px' });
      this.revealIO.observe(this);
    }

    decodeImages(root = this) {
      root.querySelectorAll('img[data-model-image]').forEach((img) => {
        if (img.classList.contains('is-decoded')) return;
        const done = () => img.classList.add('is-decoded');
        const tryDecode = () => img.decode().then(done, () => { if (img.naturalWidth) done(); });
        if (img.complete && img.naturalWidth) tryDecode();
        else img.addEventListener('load', tryDecode, { once: true });
      });
    }

    probe(i) {
      const hero = this.heroes[i];
      const url = hero?.dataset.probe;
      if (!url) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = 48;
          const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          let last = -1;
          for (let y = h - 1; y >= 0 && last < 0; y--) {
            for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) { last = y; break; }
          }
          if (last < 0) return;
          const f = clamp((h - 1 - last) / h, 0, 0.4).toFixed(4);
          hero.style.setProperty('--rw-foot', f);
          this.bodies.filter((s) => s.look === i).forEach((s) => s.el.style.setProperty('--rw-foot', f));
        } catch { /* tainted canvas: keep offset 0 */ }
      };
      img.src = url;
    }

    /* ---------- events ---------- */
    bind() {
      // visibility
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
        if (this.visible) this.kick();
      }, { threshold: 0 });
      this.io.observe(this);
      this.on(document, 'visibilitychange', () => { if (!document.hidden) this.kick(); });

      // resize
      this.on(window, 'resize', () => { clearTimeout(this.resizeT); this.resizeT = setTimeout(() => this.measure(), 120); });
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.stage);

      // clicks
      this.on(this, 'click', (e) => { if (performance.now() < (this.suppressUntil || 0)) { e.preventDefault(); e.stopPropagation(); } }, true);
      this.on(this, 'click', (e) => this.route(e));

      // engage
      this.on(this.panelEl, 'click', (e) => { if (e.target.closest('button,a,input,select,label')) this.engage(); });
      this.on(this.panelEl, 'change', (e) => { this.engage(); this.onOption(e); });
      this.on(this.panelEl, 'pointerenter', (e) => { if (e.pointerType === 'mouse') { this.panelHover = true; } });
      this.on(this.panelEl, 'pointerleave', (e) => { if (e.pointerType === 'mouse') { this.panelHover = false; this.restartBar(); } });
      this.on(this.panelEl, 'pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = e.target.closest('.rw__item');
        if (card && !card.classList.contains('is-hot')) this.hot(+card.dataset.rwCard, false);
      });
      this.on(this.panelEl, 'pointerout', (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = e.target.closest('.rw__item');
        if (card && !card.contains(e.relatedTarget)) this.clearHot();
      });

      // keyboard
      this.on(this.stage, 'keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      });
      this.on(this, 'keydown', (e) => { if (e.key === 'Escape') this.onEscape(); });

      // drag
      this.on(this.stage, 'pointerdown', (e) => this.onDown(e));
      this.on(this.stage, 'pointermove', (e) => this.onMove(e));
      this.on(this.stage, 'pointerup', (e) => this.onUp(e));
      this.on(this.stage, 'pointercancel', (e) => this.onUp(e));

      // trackpad
      this.wheelAcc = 0; this.wheelLock = 0;
      this.on(this.stage, 'wheel', (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (performance.now() < this.wheelLock) return;
        this.wheelAcc += e.deltaX;
        if (Math.abs(this.wheelAcc) > 45) {
          if (this.wheelAcc > 0) this.next(); else this.prev();
          this.wheelAcc = 0;
          this.wheelLock = performance.now() + 520;
        }
      }, { passive: false });

      // custom cursor
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && this.cursor) {
        this.classList.add('rw--cursor');
        this.cx = this.cy = this.ctx = this.cty = 0;
        this.on(this.stage, 'pointermove', (e) => this.onCursor(e));
        this.on(this.stage, 'pointerleave', () => this.cursor.classList.remove('is-on', 'is-link', 'is-view'));
      } else this.cursor?.remove();
    }

    route(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const pc = t.closest('[data-rw-pick-close]');
      if (pc) { const card = pc.closest('[data-rw-picker]')?._card || this.sheetCard; if (card) this.closePicker(card, true); return; }
      if (t.closest('[data-rw-zoom-close]')) { this.closeLb(); return; }
      if (this.zoomed && t.closest('[data-rw-lb]') && !t.closest('.rw__lb-model, .rw__lb-top')) { this.closeLb(); return; }
      if (t.closest('[data-rw-zoom]')) { this.openLb(); return; }
      if (t.closest('[data-rw-next]')) { this.next(); return; }
      if (t.closest('[data-rw-prev]')) { this.prev(); return; }
      const tick = t.closest('[data-rw-tick]');
      if (tick) { this.go(+tick.dataset.rwTick); return; }
      if (t.closest('[data-rw-auto]')) { if (!this.playing) this.engaged = false; this.play(!this.playing); return; }
      const pin = t.closest('[data-rw-pin]');
      if (pin) { this.engage(); this.hot(+pin.dataset.rwPin, true); return; }
      const hit = t.closest('[data-rw-go]');
      if (hit) {
        const s = this.bodies.find((b) => b.el === hit.closest('[data-rw-model]'));
        if (!s) return;
        const k = this.rank(s.a);
        if (k !== 0 && Math.abs(k) < 6) this.moveTo(Math.round(this.target) + k);
        else if (k === 0) this.openLb();
        return;
      }
      const conf = t.closest('[data-rw-confirm]');
      if (conf) { const card = conf.closest('[data-rw-picker]')?._card; if (card) { card.dataset.touched = '1'; this.addCards([card]); } return; }
      const add = t.closest('[data-rw-add]');
      if (add) { this.togglePicker(add.closest('.rw__item')); return; }
      const all = t.closest('[data-rw-all]');
      if (all) { this.addAll(all.closest('[data-rw-panel]')); }
    }

    onEscape() {
      if (this.sheetCard) { this.closePicker(this.sheetCard, true); return; }
      if (this.zoomed) this.closeLb();
    }

    onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.zoomed) return;
      this.ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t: this.target, drag: false, type: e.pointerType, samples: [{ x: e.clientX, time: e.timeStamp }] };
    }

    onMove(e) {
      const p = this.ptr;
      if (!p || e.pointerId !== p.id) return;
      if (p.type === 'mouse' && !(e.buttons & 1)) { this.onUp(e); return; }
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if (!p.drag) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          p.drag = true;
          this.dragging = true;
          this.classList.add('is-dragging');
          try { this.stage.setPointerCapture(p.id); } catch {}
          this.cursor?.classList.remove('is-link', 'is-view');
        } else if (Math.abs(dy) > 10) { this.ptr = null; return; }
        else return;
      }
      p.samples.push({ x: e.clientX, time: e.timeStamp });
      if (p.samples.length > 6) p.samples.shift();
      this.target = p.t - dx / this.unit;
      this.setStill(false);
      this.kick();
    }

    onUp(e) {
      const p = this.ptr;
      if (!p || e.pointerId !== p.id) return;
      this.ptr = null;
      if (!p.drag) return;
      this.dragging = false;
      this.classList.remove('is-dragging');
      try { this.stage.releasePointerCapture(p.id); } catch {}
      this.suppressUntil = performance.now() + 60;
      const f = p.samples[0], l = p.samples[p.samples.length - 1];
      const vx = l.time > f.time ? (l.x - f.x) / (l.time - f.time) : 0;
      const dx = e.clientX - p.x0;
      const sign = -1;
      const from = Math.round(p.t);
      if (this.mobile) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) this.moveTo(from + sign * (dx > 0 ? 1 : -1));
        else this.moveTo(from);
      } else {
        let i = Math.round(this.target + (sign * vx * 160) / this.unit);
        if (i === from && Math.abs(vx) > 0.3) i = from + sign * (vx > 0 ? 1 : -1);
        i = clamp(i, from - 2, from + 2);
        this.moveTo(i);
      }
    }

    onCursor(e) {
      if (e.pointerType !== 'mouse') return;
      const r = this.stage.getBoundingClientRect();
      this.ctx = e.clientX - r.left;
      this.cty = e.clientY - r.top;
      const c = this.cursor;
      if (!c.classList.contains('is-on')) { this.cx = this.ctx; this.cy = this.cty; c.classList.add('is-on'); }
      const t = e.target instanceof Element ? e.target : null;
      c.classList.toggle('is-view', !this.dragging && !!t?.closest('.rw__zoom'));
      c.classList.toggle('is-link', !this.dragging && !!t?.closest('.rw__pin, .rw__hit'));
      if (!this.cRaf) this.cRaf = requestAnimationFrame(() => this.cursorLoop());
    }

    cursorLoop() {
      this.cRaf = 0;
      const k = reduced() ? 1 : 0.18;
      this.cx += (this.ctx - this.cx) * k;
      this.cy += (this.cty - this.cy) * k;
      this.cursor.style.transform = `translate3d(${this.cx.toFixed(1)}px,${this.cy.toFixed(1)}px,0)`;
      if (Math.hypot(this.ctx - this.cx, this.cty - this.cy) >= 0.2) this.cRaf = requestAnimationFrame(() => this.cursorLoop());
    }

    /* ---------- hot linking ---------- */
    clearHot() {
      this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    }

    hot(n, scroll = false) {
      this.clearHot();
      const scope = this.zoomed ? this.lbStage : this.heroes[this.index];
      scope?.querySelector(`[data-rw-pin="${n}"]`)?.classList.add('is-hot');
      const card = this.panels[this.index].querySelector(`[data-rw-card="${n}"]`);
      if (!card) return;
      card.classList.add('is-hot');
      if (scroll) this.revealCard(card);
    }

    revealCard(card) {
      const list = card.closest('.rw__items');
      const behavior = reduced() ? 'auto' : 'smooth';
      if (!list) return;
      const cs = getComputedStyle(list);
      if (list.scrollWidth > list.clientWidth + 1 && cs.overflowX !== 'visible' && cs.overflowX !== 'hidden') {
        const left = card.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - 20;
        list.scrollTo({ left, behavior });
      } else if (list.scrollHeight > list.clientHeight + 1) {
        list.scrollTo({ top: card.offsetTop - list.offsetTop - 12, behavior });
      } else {
        const r = card.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight - 140) window.scrollBy({ top: r.top - 0.3 * window.innerHeight, behavior });
      }
    }

    /* ---------- pickers ---------- */
    makeSheetHost() {
      const host = document.createElement('div');
      host.className = 'rw-sheet-host';
      const scrim = document.createElement('button');
      scrim.className = 'rw__pick-scrim';
      scrim.type = 'button';
      scrim.tabIndex = -1;
      scrim.setAttribute('data-rw-pick-close', '');
      scrim.setAttribute('aria-hidden', 'true');
      host.append(scrim);
      document.body.append(host);
      this.host = host;
      host.addEventListener('click', (e) => this.route(e));
      host.addEventListener('change', (e) => { this.engage(); this.onOption(e); });
      host.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.onEscape(); });
    }

    syncHostVars() {
      const cs = getComputedStyle(this);
      ['--rw-panel', '--rw-text', '--rw-muted', '--rw-line', '--rw-accent', '--rw-on-accent', '--rw-btn-bg', '--rw-btn-fg', '--rw-btn-radius',
        '--rw-pill-radius', '--rw-bar-r', '--rw-thumb-radius', '--rw-pt-size', '--rw-price', '--rw-opt', '--rw-ease', '--rw-ease-sheet', '--rw-ease-spring']
        .forEach((v) => this.host.style.setProperty(v, cs.getPropertyValue(v)));
      this.host.style.fontFamily = cs.fontFamily;
      this.host.style.color = cs.color;
    }

    togglePicker(card) {
      if (!card || card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
      if (card._picker && !card._picker.hidden) this.closePicker(card, false);
      else this.openPicker(card);
    }

    openPicker(card) {
      const picker = card._picker;
      if (!picker || card.classList.contains('is-added')) return;
      if (this.mobile) {
        if (this.sheetCard && this.sheetCard !== card) this.closePicker(this.sheetCard, false);
        this.syncHostVars();
        this.host.append(picker);
        this.host.classList.add('is-open');
        this.classList.add('rw--picking');
        this.sheetCard = card;
      }
      picker.hidden = false;
      card.classList.add('is-picking');
      card._add?.setAttribute('aria-expanded', 'true');
      picker.querySelector('input:checked')?.focus({ preventScroll: true });
      if (!this.mobile) this.revealCard(card);
    }

    closePicker(card, focusBtn) {
      const picker = card._picker;
      if (!picker) return;
      picker.hidden = true;
      card.classList.remove('is-picking');
      if (!card.classList.contains('is-added')) card._add?.setAttribute('aria-expanded', 'false');
      this.dock(card);
      if (focusBtn) card._add?.focus({ preventScroll: true });
    }

    dock(card) {
      const picker = card._picker;
      if (!picker) return;
      if (picker.parentNode !== card) { picker.hidden = true; card.append(picker); card.classList.remove('is-picking'); }
      if (this.sheetCard === card) {
        this.sheetCard = null;
        this.host?.classList.remove('is-open');
        this.classList.remove('rw--picking');
      }
    }

    closeSheets() { if (this.sheetCard) this.closePicker(this.sheetCard, false); }

    onOption(e) {
      const input = e.target.closest?.('input[data-rw-option]');
      if (!input) return;
      const card = input.closest('[data-rw-picker]')?._card;
      if (card) this.updateVariant(card, true);
    }

    updateVariant(card, touched) {
      const picker = card._picker;
      if (!picker.querySelector('fieldset')) return;
      const variants = card._variants || [];
      const sets = [...picker.querySelectorAll('fieldset')];
      const sel = sets.map((fs) => fs.querySelector('input:checked')?.value);
      const match = variants.find((v) => v.o.every((o, i) => o === sel[i]));
      sets.forEach((fs, oi) => fs.querySelectorAll('input').forEach((inp) => {
        const ok = variants.some((v) => v.a && v.o[oi] === inp.value && v.o.every((o, j) => j === oi || o === sel[j]));
        inp.closest('.rw__pill')?.classList.toggle('is-unavailable', !ok);
      }));
      const conf = picker.querySelector('[data-rw-confirm]');
      const label = picker.querySelector('[data-rw-confirm-label]');
      const avail = !!(match && match.a);
      if (conf) conf.disabled = !avail;
      if (label) label.textContent = avail ? label.dataset.add : this.msgSoldout;
      if (avail) card.dataset.selected = String(match.id); else delete card.dataset.selected;
      if (touched) card.dataset.touched = '1';
    }

    setMsg(panel, text) {
      const m = panel?.querySelector('[data-rw-msg]');
      if (!m) return;
      m.textContent = text;
      m.hidden = !text;
      if (text) { m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; }
    }

    async addCards(cards, cta) {
      const panel = cards[0]?.closest('[data-rw-panel]');
      const ids = cards.map((c) => parseInt(c.dataset.variantId || c.dataset.selected, 10));
      if (ids.some((id) => !Number.isSafeInteger(id))) return;
      cards.forEach((c) => c.classList.add('is-loading'));
      cta?.classList.add('is-loading');
      try {
        
        cards.forEach((c) => this.markAdded(c));
        if (this.mobile && navigator.vibrate && !reduced()) { try { navigator.vibrate(12); } catch {} }
        this.checkComplete(panel);
      } catch {
        this.setMsg(panel, this.msgError);
      } finally {
        cards.forEach((c) => c.classList.remove('is-loading'));
        cta?.classList.remove('is-loading');
      }
    }

    markAdded(card) {
      card.classList.add('is-added');
      this.closePicker(card, false);
      const btn = card._add;
      if (btn) { btn.setAttribute('aria-label', btn.dataset.addedLabel || btn.getAttribute('aria-label')); btn.removeAttribute('aria-expanded'); }
    }

    checkComplete(panel) {
      if (!panel) return;
      const cards = [...panel.querySelectorAll('.rw__item')];
      if (cards.length >= 2 && cards.every((c) => c.classList.contains('is-added'))) {
        panel.classList.add('is-complete');
        this.setMsg(panel, '');
      }
    }

    async addAll(panel) {
      if (!panel) return;
      const cta = panel.querySelector('[data-rw-all]');
      if (panel.classList.contains('is-complete') || cta?.classList.contains('is-loading')) return;
      this.setMsg(panel, '');
      const cards = [...panel.querySelectorAll('.rw__item')].filter((c) => !c.classList.contains('is-added') && !c.classList.contains('is-soldout'));
      const ready = cards.filter((c) => c.dataset.variantId || (c.dataset.touched && c.dataset.selected));
      const pending = cards.filter((c) => !ready.includes(c));
      if (ready.length) await this.addCards(ready, cta);
      if (pending.length) {
        (this.mobile ? pending.slice(0, 1) : pending).forEach((c) => this.openPicker(c));
        if (!this.mobile) this.revealCard(pending[0]);
        this.setMsg(panel, this.msgChoose.replace('[items]', pending.map((c) => c.dataset.title).join(', ')));
      }
    }

    /* ---------- View look popup ---------- */
    openLb() {
      if (this.zoomed || !this.lb) return;
      this.engage();
      this.clearHot();
      clearTimeout(this.lbT);
      const hero = this.heroes[this.index];
      const morph = hero.querySelector('.rw__morph');
      const wrap = document.createElement('div');
      wrap.className = 'rw__lb-model';
      const shadow = morph.querySelector('.rw__shadow').cloneNode(true);
      const fig = morph.querySelector('.rw__figure').cloneNode(true);
      fig.querySelector('[data-rw-zoom]')?.remove();
      fig.querySelectorAll('.rw__pin').forEach((p) => { p.tabIndex = 0; });
      fig.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; img.classList.remove('is-decoded'); });
      const foot = hero.style.getPropertyValue('--rw-foot');
      if (foot) wrap.style.setProperty('--rw-foot', foot);
      wrap.append(shadow, fig);
      this.lbStage.replaceChildren(wrap);
      this.decodeImages(wrap);
      const ki = this.lb.querySelector('[data-rw-lb-kicker]');
      const nm = this.lb.querySelector('[data-rw-lb-name]');
      if (ki) ki.textContent = `${this.lb.dataset.word || 'Look'} ${String(this.index + 1).padStart(2, '0')}`;
      if (nm) nm.textContent = hero.dataset.name;

      this.zoomed = true;
      this.classList.add('rw--zoom');
      this.lb.setAttribute('aria-hidden', 'false');
      const sr = this.lbStage.getBoundingClientRect();
      const h = Math.max(160, Math.min(sr.height, sr.width / 0.5625));
      wrap.style.setProperty('--rw-model-h', `${h}px`);
      fig.querySelectorAll('img').forEach((img) => { img.sizes = `${Math.round(h * 0.5625)}px`; });

      this.lbAt = '';
      if (!reduced()) {
        const a = hero.querySelector('.rw__figure').getBoundingClientRect();
        const b = fig.getBoundingClientRect();
        if (a.height && b.height) {
          const at = `translate3d(${(a.left - b.left).toFixed(1)}px,${(a.bottom - b.bottom).toFixed(1)}px,0) scale(${(a.height / b.height).toFixed(4)})`;
          wrap.style.transformOrigin = '0 100%';
          wrap.style.transition = 'none';
          wrap.style.transform = at;
          void wrap.offsetWidth;
          wrap.style.transition = '';
          wrap.style.transform = '';
          this.lbAt = at;
        }
      }
      this.lb.querySelector('[data-rw-zoom-close]')?.focus({ preventScroll: true });
    }

    closeLb() {
      if (!this.zoomed) return;
      this.zoomed = false;
      const wrap = this.lbStage.firstElementChild;
      if (wrap && this.lbAt && !reduced()) wrap.style.transform = this.lbAt;
      const hadFocus = this.lb.contains(document.activeElement);
      this.classList.remove('rw--zoom');
      this.lb.setAttribute('aria-hidden', 'true');
      clearTimeout(this.lbT);
      this.lbT = setTimeout(() => { if (!this.zoomed) this.lbStage.replaceChildren(); }, 950);
      if (hadFocus) this.stage.focus({ preventScroll: true });
      this.clearHot();
    }
  }

  if (!customElements.get('runway-section')) customElements.define('runway-section', RunwaySection);
})();
