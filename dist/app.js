const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function whenPageIntro() {
  if (!document.documentElement.classList.contains('is-booting')) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    document.addEventListener('taby-intro-done', finish, { once: true });
    setTimeout(finish, 7000);
  });
}

function scrollToY(top, smooth) {
  if (smooth) {
    scrollTo({ top, behavior: 'smooth' });
    return;
  }
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  scrollTo({ top, behavior: 'auto' });
  requestAnimationFrame(() => { root.style.scrollBehavior = previous; });
}

function bootMenu() {
  const menuButton = document.querySelector('.menu-button');
  const mobileNav = document.querySelector('#mobile-nav');
  const main = document.querySelector('main');
  const footer = document.querySelector('.footer');
  if (!menuButton || !mobileNav) return;

  function setMenu(open, restoreFocus) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Закрыть' : 'Меню';
    mobileNav.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    if (open) mobileNav.querySelector('a')?.focus();
    else if (restoreFocus) menuButton.focus();
  }

  menuButton.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true', false);
  });
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false, false));
  });
  document.addEventListener('click', event => {
    if (mobileNav.hidden) return;
    if (event.target.closest('#mobile-nav, .menu-button')) return;
    setMenu(false, false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || mobileNav.hidden) return;
    if (document.querySelector('#image-dialog')?.open) return;
    setMenu(false, true);
  });
}

function bootProduct() {
  const scene = document.querySelector('.product-scroll-scene');
  if (!scene) return;
  const stage = scene.querySelector('.product-sticky');
  const panels = [...scene.querySelectorAll('[data-panel]')];
  const moduleLinks = [...scene.querySelectorAll('[data-module]')];
  let activeIndex = -1;
  let enhanced = false;
  let sceneStart = 0;
  let scrollStep = 1;
  let scrollFrame = 0;
  let scrollTarget = null;
  let scrollLock = 0;
  let scrubStamp = 0;
  let hashApplied = false;
  let userScrolled = false;

  function moduleIndexFromHash() {
    const id = location.hash.slice(1);
    return panels.findIndex(panel => panel.id === id);
  }

  function setModule(index) {
    if (index < 0 || index >= panels.length || index === activeIndex) return;
    activeIndex = index;
    if (!scene.classList.contains('is-scrubbing')) scene.style.setProperty('--active-module', index);
    panels.forEach((panel, i) => {
      const on = i === index;
      panel.classList.toggle('is-active', on);
      panel.inert = enhanced && !on;
      if (enhanced && !on) panel.setAttribute('aria-hidden', 'true');
      else panel.removeAttribute('aria-hidden');
    });
    moduleLinks.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function moduleTop(index) {
    if (enhanced) return sceneStart + index * scrollStep;
    return panels[index].getBoundingClientRect().top + scrollY - 30;
  }

  function moduleAtScroll() {
    if (enhanced) {
      const exact = Math.max(0, Math.min(panels.length - 1, (scrollY - sceneStart) / scrollStep));
      return { index: Math.round(exact), exact };
    }
    let index = 0;
    panels.forEach((panel, i) => {
      if (panel.getBoundingClientRect().top < innerHeight * 0.55) index = i;
    });
    return { index, exact: index };
  }

  function endScrub(index) {
    const stamp = ++scrubStamp;
    scene.style.setProperty('--active-module', index);
    if (activeIndex !== index) {
      activeIndex = -1;
      setModule(index);
      scene.style.setProperty('--active-module', index);
    }
    requestAnimationFrame(() => {
      if (stamp !== scrubStamp || scrollTarget !== null) return;
      scene.classList.remove('is-scrubbing');
    });
  }

  function updateFromScroll() {
    scrollFrame = 0;
    let scrubbing = false;
    if (scrollTarget !== null) {
      const pending = Math.abs(scrollY - scrollTarget) > 2 && performance.now() - scrollLock < 2500;
      if (pending) scrubbing = enhanced;
      else scrollTarget = null;
    }
    const position = moduleAtScroll();
    if (scrubbing) {
      if (!scene.classList.contains('is-scrubbing')) scrubStamp += 1;
      scene.classList.add('is-scrubbing');
      setModule(position.index);
      scene.style.setProperty('--active-module', position.exact);
      return;
    }
    if (scene.classList.contains('is-scrubbing')) {
      endScrub(position.index);
      return;
    }
    setModule(position.index);
  }

  function frame() {
    let node = stage.querySelector(':scope > .product-scaler');
    if (node) return node;
    node = document.createElement('div');
    node.className = 'product-scaler';
    while (stage.firstChild) node.appendChild(stage.firstChild);
    stage.appendChild(node);
    return node;
  }

  function configureScroll() {
    scrollTarget = null;
    const content = frame();
    content.style.transform = '';
    content.style.width = '';
    stage.style.height = '';
    stage.style.zoom = '';
    // Pin on a desktop window even when the mock is taller than the viewport.
    enhanced = innerWidth >= 900 && innerHeight >= 560;
    scene.classList.toggle('scroll-ready', enhanced);
    if (enhanced) {
      const available = Math.max(480, innerHeight - 24);
      let natural = content.getBoundingClientRect().height;
      let scale = Math.min(1, available / Math.max(natural, 1));
      const fitted = scale < 0.995;
      scene.classList.toggle('is-fitted', fitted);
      if (fitted) {
        content.style.width = `${100 / scale}%`;
        natural = content.getBoundingClientRect().height;
        scale = Math.min(1, available / Math.max(natural, 1));
        content.style.width = `${100 / scale}%`;
        content.style.transform = `scale(${scale})`;
        stage.style.height = `${Math.ceil(natural * scale)}px`;
      }
      const stageHeight = stage.getBoundingClientRect().height;
      const top = Math.max(12, (innerHeight - stageHeight) / 2);
      scrollStep = Math.max(480, innerHeight * 0.75);
      scene.style.setProperty('--sticky-top', `${top}px`);
      scene.style.height = `${stageHeight + (panels.length - 1) * scrollStep}px`;
      sceneStart = scene.getBoundingClientRect().top + scrollY - top;
    } else {
      scene.classList.remove('is-fitted');
      scene.style.height = '';
      scene.style.removeProperty('--sticky-top');
    }
    activeIndex = -1;
    updateFromScroll();
  }

  function revealHash(smooth, force) {
    const index = moduleIndexFromHash();
    if (index < 0) return;
    if (hashApplied && !force) return;
    hashApplied = true;
    const top = moduleTop(index);
    const animate = smooth && !reducedMotion.matches;
    scrollTarget = top;
    scrollLock = performance.now();
    scrollToY(top, animate);
    if (!animate) setModule(index);
  }

  function cancelProgrammaticScroll() {
    userScrolled = true;
    if (scrollTarget === null) return;
    scrollTarget = null;
    scrollToY(scrollY, false);
  }

  addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateFromScroll);
  }, { passive: true });
  addEventListener('wheel', cancelProgrammaticScroll, { passive: true });
  addEventListener('touchmove', cancelProgrammaticScroll, { passive: true });
  addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'Home' || event.key === 'End' || event.key === ' ') {
      cancelProgrammaticScroll();
    }
  });

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(configureScroll, 100);
  });
  addEventListener('pageshow', event => {
    if (event.persisted) configureScroll();
  });
  reducedMotion.addEventListener('change', configureScroll);

  moduleLinks.forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const index = panels.findIndex(panel => panel.dataset.panel === link.dataset.module);
    if (index < 0) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    const top = moduleTop(index);
    const animate = !reducedMotion.matches;
    scrollTarget = top;
    scrollLock = performance.now();
    scrollToY(top, animate);
    if (!animate) setModule(index);
  }));

  let hashFrame = 0;
  function onHash() {
    if (hashFrame) return;
    hashFrame = requestAnimationFrame(() => { hashFrame = 0; });
    revealHash(true, true);
  }
  addEventListener('hashchange', onHash);
  addEventListener('popstate', onHash);

  configureScroll();
  document.fonts.ready.then(() => {
    configureScroll();
    whenPageIntro().then(() => {
      if (!userScrolled) revealHash(false, true);
    });
  });
  addEventListener('load', () => {
    configureScroll();
    whenPageIntro().then(() => {
      if (!userScrolled) revealHash(false, true);
    });
  });
}

function bootCost() {
  const costToggle = document.querySelector('.calculation-toggle');
  const costValue = document.querySelector('#cost-value');
  const costLabel = document.querySelector('#cost-label');
  const costDifference = document.querySelector('#cost-difference');
  const costBar = document.querySelector('#cost-bar');
  const costStatus = document.querySelector('#cost-status');
  if (!costToggle || !costValue) return;
  const buttons = [...costToggle.querySelectorAll('[data-value]')];
  let numberAnimation = 0;
  let currentCost = Number(costToggle.querySelector('[aria-pressed="true"]')?.dataset.value);
  if (!Number.isFinite(currentCost)) currentCost = 25.9;

  function render(value) {
    costValue.textContent = value.toFixed(1).replace('.', ',');
  }

  function announce(button) {
    if (!costStatus) return;
    const value = button.dataset.value.replace('.', ',');
    costStatus.textContent = '';
    requestAnimationFrame(() => {
      costStatus.textContent = `${button.dataset.label}: ${value}%. ${button.dataset.note}`;
    });
  }

  function animateCost(target) {
    cancelAnimationFrame(numberAnimation);
    if (reducedMotion.matches) {
      currentCost = target;
      render(currentCost);
      return;
    }
    const from = currentCost;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / 480);
      const eased = 1 - Math.pow(1 - progress, 3);
      currentCost = from + (target - from) * eased;
      render(currentCost);
      if (progress < 1) numberAnimation = requestAnimationFrame(tick);
    }
    numberAnimation = requestAnimationFrame(tick);
  }

  function applyCost(button, animate) {
    const target = Number(button.dataset.value);
    if (!Number.isFinite(target)) return;
    costToggle.style.setProperty('--toggle-index', button.dataset.cost === 'discount' ? 1 : 0);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (costLabel) costLabel.textContent = button.dataset.label;
    if (costDifference) costDifference.textContent = button.dataset.note;
    if (costBar) costBar.style.width = `${button.dataset.bar}%`;
    if (animate) animateCost(target);
    else {
      cancelAnimationFrame(numberAnimation);
      currentCost = target;
      render(currentCost);
    }
    announce(button);
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => applyCost(button, true));
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      applyCost(next, true);
    });
  });
}

function bootDialog() {
  const dialog = document.querySelector('#image-dialog');
  const title = document.querySelector('#dialog-title');
  const visual = document.querySelector('#dialog-visual');
  const scroller = document.querySelector('.dialog-scroll');
  if (!dialog || !title || !visual) return;
  const live = {
    dashboard: '.hero-app-scroll > .ui-screen',
    sales: '#module-sales .module-figure .ui-screen',
    foodcost: '#module-foodcost .module-figure .ui-screen',
    stock: '#module-stock .module-figure .ui-screen',
    goals: '#module-goals .module-figure .ui-screen',
  };
  let dialogTrigger = null;

  function fragmentFor(name) {
    if (!/^[a-z-]+$/.test(name)) return null;
    const selector = live[name];
    if (selector) {
      const source = document.querySelector(selector);
      return source ? source.cloneNode(true) : null;
    }
    const template = document.querySelector(`#ui-${name}`);
    return template ? template.content.cloneNode(true) : null;
  }

  document.querySelectorAll('[data-open-image]').forEach(button => {
    button.addEventListener('click', () => {
      const fragment = fragmentFor(button.dataset.openImage || '');
      if (!fragment) return;
      dialogTrigger = button;
      title.textContent = button.dataset.imageTitle || 'Интерфейс Taby';
      visual.replaceChildren(fragment);
      document.body.classList.add('dialog-open');
      dialog.showModal();
      if (scroller) scroller.scrollTo(0, 0);
    });
  });
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    visual.replaceChildren();
    dialogTrigger?.focus();
    dialogTrigger = null;
  });
}

function channelsOf(color) {
  const value = (color || '').trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const channels = value.match(/[\d.]+/g);
  if (channels && channels.length >= 3) return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
  return [47, 214, 153];
}

function readPaint(selector, prop) {
  const node = document.querySelector(selector);
  if (!node) return '';
  const value = getComputedStyle(node)[prop];
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return '';
  return value;
}

function bootFlow() {
  const canvas = document.querySelector('.flow-field');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2fd699';
  const avatar = readPaint('.ui-avatar', 'backgroundImage');
  const avatarColors = avatar.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi) || [];
  const green = channelsOf(accent);
  const greenSoft = channelsOf(avatarColors[1] || '#37cea0');
  const violet = channelsOf(readPaint('.violet-text', 'color') || '#a097ff');
  const violetDeep = channelsOf(readPaint('.ui-dot.violet, .ui-legend i.violet', 'backgroundColor') || '#7061ff');

  const sources = [
    { rgb: green, x: 0.14, viewY: 0.16, pageY: 0, hero: true, sigma: 26, gain: 0.11, seed: 0.4 },
    { rgb: violet, x: 0.8, viewY: 0.14, pageY: 0, hero: true, sigma: 28, gain: 0.1, seed: 1.2 },
    { rgb: violetDeep, x: 0.46, viewY: 0.36, pageY: 0, hero: true, sigma: 22, gain: 0.09, seed: 2.1 },
    { rgb: greenSoft, x: 0.26, viewY: 0.52, pageY: 0, hero: true, sigma: 24, gain: 0.09, seed: 3.3 },
    { rgb: violet, x: 0.68, viewY: 0.66, pageY: 0, hero: true, sigma: 22, gain: 0.08, seed: 4.4 },
    { rgb: green, x: 0.2, selector: '#foodcost', pageY: 0.36, hero: false, sigma: 28, gain: 0.072, seed: 5.2 },
    { rgb: violet, x: 0.74, selector: '#freshness', pageY: 0.48, hero: false, sigma: 26, gain: 0.068, seed: 5.9 },
    { rgb: violetDeep, x: 0.26, selector: '#case', pageY: 0.6, hero: false, sigma: 30, gain: 0.078, seed: 6.5 },
    { rgb: greenSoft, x: 0.78, selector: '.connect', pageY: 0.74, hero: false, sigma: 28, gain: 0.072, seed: 7.2 },
    { rgb: violet, x: 0.42, selector: '.final-cta', pageY: 0.88, hero: false, sigma: 32, gain: 0.074, seed: 8.1 },
  ];
  sources.forEach(source => { source.y = 0; source.home = 0; });

  const drift = 12;
  const decayRate = 0.085;
  const cell = 8;
  let cssW = 0;
  let cssH = 0;
  let bufW = 0;
  let bufH = 0;
  let heroSpan = 0.2;
  let field = new Float32Array(0);
  let next = new Float32Array(0);
  let velX = new Float32Array(0);
  let velY = new Float32Array(0);
  let velCols = 0;
  let velRows = 0;
  let pixels = null;
  let fromBuf = null;
  let toBuf = null;
  let holdY = -1;
  let time = 2.4;
  let last = 0;
  let raf = 0;
  let resizeTimer = 0;
  let fitting = false;
  let primed = false;

  function flowDir(x, y, t) {
    const k = 0.046;
    const p = (px, py) => Math.sin(px * k + t * 0.15) * Math.cos(py * k * 0.82 - t * 0.11)
      + Math.sin((px + py * 0.65) * k * 0.62 + t * 0.07) * 0.72
      + Math.cos(px * k * 1.15 - py * k * 0.4 + t * 0.045) * 0.42;
    const e = 7;
    const vx = p(x, y + e) - p(x, y - e);
    const vy = -(p(x + e, y) - p(x - e, y));
    const mag = Math.hypot(vx, vy) || 1;
    return { x: vx / mag, y: vy / mag };
  }

  function updateVelocity() {
    velCols = Math.max(2, Math.ceil(bufW / cell) + 1);
    velRows = Math.max(2, Math.ceil(bufH / cell) + 1);
    if (velX.length !== velCols * velRows) {
      velX = new Float32Array(velCols * velRows);
      velY = new Float32Array(velCols * velRows);
    }
    for (let gy = 0; gy < velRows; gy += 1) {
      const y = gy * cell;
      for (let gx = 0; gx < velCols; gx += 1) {
        const dir = flowDir(gx * cell, y, time);
        const i = gy * velCols + gx;
        velX[i] = dir.x * drift;
        velY[i] = dir.y * drift;
      }
    }
  }

  function velocity(x, y) {
    const gx = Math.max(0, Math.min(velCols - 1.001, x / cell));
    const gy = Math.max(0, Math.min(velRows - 1.001, y / cell));
    const x0 = gx | 0;
    const y0 = gy | 0;
    const tx = gx - x0;
    const ty = gy - y0;
    const i00 = y0 * velCols + x0;
    const i10 = i00 + 1;
    const i01 = i00 + velCols;
    const i11 = i01 + 1;
    const ax = 1 - tx;
    const ay = 1 - ty;
    return {
      x: velX[i00] * ax * ay + velX[i10] * tx * ay + velX[i01] * ax * ty + velX[i11] * tx * ty,
      y: velY[i00] * ax * ay + velY[i10] * tx * ay + velY[i01] * ax * ty + velY[i11] * tx * ty,
    };
  }

  function stamp(buffer, source, amount) {
    const sigma = source.sigma * bufW / 220;
    const radius = sigma * 3;
    const cx = source.x * bufW;
    const cy = source.y * bufH;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(bufW - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(bufH - 1, Math.ceil(cy + radius));
    const inv = 1 / (2 * sigma * sigma);
    const rgb = source.rgb;
    for (let y = y0; y <= y1; y += 1) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - cx;
        const falloff = Math.exp(-(dx * dx + dy * dy) * inv);
        const limit = source.hero ? 0.34 : 0.28;
        const srcA = Math.min(limit, falloff * amount);
        if (srcA < 0.0008) continue;
        const o = (y * bufW + x) * 4;
        const dstA = buffer[o + 3];
        const outA = Math.min(limit, srcA + dstA * (1 - srcA));
        if (outA <= 0.0008) continue;
        const srcW = srcA / outA;
        const dstW = dstA * (1 - srcA) / outA;
        buffer[o] = rgb[0] * srcW + buffer[o] * dstW;
        buffer[o + 1] = rgb[1] * srcW + buffer[o + 1] * dstW;
        buffer[o + 2] = rgb[2] * srcW + buffer[o + 2] * dstW;
        buffer[o + 3] = outA;
      }
    }
  }

  function advect(src, dst, dt) {
    const decay = Math.exp(-decayRate * dt);
    const w = bufW;
    const h = bufH;
    const cols = velCols;
    const rows = velRows;
    const vx = velX;
    const vy = velY;
    const inv = 1 / cell;
    const maxCol = cols - 1.001;
    const maxRow = rows - 1.001;
    for (let y = 0; y < h; y += 1) {
      const gy = y * inv < 0 ? 0 : y * inv > maxRow ? maxRow : y * inv;
      const gy0 = gy | 0;
      const ty = gy - gy0;
      const ay = 1 - ty;
      const row0 = gy0 * cols;
      const row1 = row0 + cols;
      const rowStart = y * w;
      for (let x = 0; x < w; x += 1) {
        const gx = x * inv < 0 ? 0 : x * inv > maxCol ? maxCol : x * inv;
        const gx0 = gx | 0;
        const tx = gx - gx0;
        const ax = 1 - tx;
        const i00 = row0 + gx0;
        const velx = vx[i00] * ax * ay + vx[i00 + 1] * tx * ay + vx[row1 + gx0] * ax * ty + vx[row1 + gx0 + 1] * tx * ty;
        const vely = vy[i00] * ax * ay + vy[i00 + 1] * tx * ay + vy[row1 + gx0] * ax * ty + vy[row1 + gx0 + 1] * tx * ty;
        let sx = x - velx * dt;
        let sy = y - vely * dt;
        if (sx < 0) sx = 0;
        else if (sx > w - 1.001) sx = w - 1.001;
        if (sy < 0) sy = 0;
        else if (sy > h - 1.001) sy = h - 1.001;
        const o = (rowStart + x) * 4;
        const x0 = sx | 0;
        const y0 = sy | 0;
        const fx = sx - x0;
        const fy = sy - y0;
        const bx = 1 - fx;
        const by = 1 - fy;
        const p00 = (y0 * w + x0) * 4;
        const p10 = p00 + 4;
        const p01 = p00 + w * 4;
        const p11 = p01 + 4;
        const w00 = bx * by;
        const w10 = fx * by;
        const w01 = bx * fy;
        const w11 = fx * fy;
        const a00 = src[p00 + 3];
        const a10 = src[p10 + 3];
        const a01 = src[p01 + 3];
        const a11 = src[p11 + 3];
        const alpha = (a00 * w00 + a10 * w10 + a01 * w01 + a11 * w11) * decay;
        if (alpha <= 0.0008) {
          dst[o] = dst[o + 1] = dst[o + 2] = dst[o + 3] = 0;
          continue;
        }
        const invA = decay / alpha;
        dst[o] = (src[p00] * a00 * w00 + src[p10] * a10 * w10 + src[p01] * a01 * w01 + src[p11] * a11 * w11) * invA;
        dst[o + 1] = (src[p00 + 1] * a00 * w00 + src[p10 + 1] * a10 * w10 + src[p01 + 1] * a01 * w01 + src[p11 + 1] * a11 * w11) * invA;
        dst[o + 2] = (src[p00 + 2] * a00 * w00 + src[p10 + 2] * a10 * w10 + src[p01 + 2] * a01 * w01 + src[p11 + 2] * a11 * w11) * invA;
        dst[o + 3] = alpha;
      }
    }
  }

  function shiftSources(dt) {
    sources.forEach(source => {
      const v = velocity(source.x * bufW, source.y * bufH);
      const wobble = Math.sin(time * 0.23 + source.seed) * drift * 0.08;
      source.x += ((v.x + wobble) * dt) / bufW;
      source.y += (v.y * dt) / bufH;
      if (source.x < 0.05) source.x = 0.05;
      if (source.x > 0.95) source.x = 0.95;
      const minY = source.hero ? 0.012 : Math.max(heroSpan + 0.03, source.pageY - 0.06);
      const maxY = source.hero ? Math.max(heroSpan, 0.08) : Math.min(0.97, source.pageY + 0.06);
      if (minY < maxY) {
        if (source.y < minY) source.y += (minY - source.y) * 0.18;
        if (source.y > maxY) source.y += (maxY - source.y) * 0.18;
      }
    });
  }

  function pour(buffer, dt) {
    sources.forEach(source => stamp(buffer, source, source.gain * dt));
  }

  function presentLerp(u) {
    const data = pixels.data;
    const older = fromBuf;
    const newer = toBuf;
    const keep = 1 - u;
    const W = bufW + 2;
    const H = bufH + 2;
    for (let y = 0; y < bufH; y += 1) {
      const row = (y + 1) * W;
      const srcRow = y * bufW;
      for (let x = 0; x < bufW; x += 1) {
        const i = (srcRow + x) * 4;
        const a0 = older[i + 3];
        const a1 = newer[i + 3];
        const alpha = a0 * keep + a1 * u;
        const o = (row + x + 1) * 4;
        if (alpha <= 0.004) {
          data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
          continue;
        }
        const inv = 1 / alpha;
        data[o] = (older[i] * a0 * keep + newer[i] * a1 * u) * inv;
        data[o + 1] = (older[i + 1] * a0 * keep + newer[i + 1] * a1 * u) * inv;
        data[o + 2] = (older[i + 2] * a0 * keep + newer[i + 2] * a1 * u) * inv;
        data[o + 3] = Math.min(255, alpha * 255);
      }
    }
    for (let y = 1; y <= bufH; y += 1) {
      const row = y * W;
      const left = row * 4;
      const fromLeft = (row + 1) * 4;
      data[left] = data[fromLeft];
      data[left + 1] = data[fromLeft + 1];
      data[left + 2] = data[fromLeft + 2];
      data[left + 3] = data[fromLeft + 3];
      const right = (row + W - 1) * 4;
      const fromRight = (row + W - 2) * 4;
      data[right] = data[fromRight];
      data[right + 1] = data[fromRight + 1];
      data[right + 2] = data[fromRight + 2];
      data[right + 3] = data[fromRight + 3];
    }
    for (let x = 0; x < W; x += 1) {
      const top = x * 4;
      const fromTop = (W + x) * 4;
      data[top] = data[fromTop];
      data[top + 1] = data[fromTop + 1];
      data[top + 2] = data[fromTop + 2];
      data[top + 3] = data[fromTop + 3];
      const bottom = ((H - 1) * W + x) * 4;
      const fromBottom = ((H - 2) * W + x) * 4;
      data[bottom] = data[fromBottom];
      data[bottom + 1] = data[fromBottom + 1];
      data[bottom + 2] = data[fromBottom + 2];
      data[bottom + 3] = data[fromBottom + 3];
    }
    ctx.putImageData(pixels, 0, 0);
  }

  const clip = canvas.parentElement;

  function measure() {
    canvas.style.height = '0px';
    if (clip) clip.style.height = '0px';
    const w = Math.max(1, document.documentElement.clientWidth);
    const h = Math.max(1, document.documentElement.scrollHeight, document.body.scrollHeight);
    return { w, h };
  }

  function scenePin() {
    const scene = document.querySelector('.product-scroll-scene');
    if (!scene || !scene.classList.contains('scroll-ready')) return null;
    const sticky = scene.querySelector('.product-sticky');
    if (!sticky) return null;
    const pin = parseFloat(scene.style.getPropertyValue('--sticky-top')) || 0;
    const start = scene.getBoundingClientRect().top + scrollY - pin;
    const travel = Math.max(0, scene.offsetHeight - sticky.offsetHeight);
    return { start, travel };
  }

  function visualDocY(docY) {
    const pin = scenePin();
    if (!pin || pin.travel <= 0) return docY;
    const end = pin.start + pin.travel;
    if (docY >= end) return docY - pin.travel;
    if (docY > pin.start) return pin.start;
    return docY;
  }

  function placeSources() {
    heroSpan = Math.min(0.42, Math.max(0.08, innerHeight / cssH));
    sources.forEach(source => {
      if (source.hero) source.pageY = source.viewY * innerHeight / cssH;
      else if (source.selector) {
        const node = document.querySelector(source.selector);
        if (node) {
          const docY = node.getBoundingClientRect().top + scrollY + node.offsetHeight * 0.4;
          source.pageY = Math.min(0.96, Math.max(0.02, visualDocY(docY) / cssH));
        }
      }
      source.home = source.pageY;
      if (!source.ready) {
        source.y = source.home;
        source.ready = true;
      } else if (!source.hero && Math.abs(source.pageY - source.y) > 0.12) {
        source.y = source.pageY;
      }
    });
  }

  function placeCanvas(hold) {
    const unitX = bufW ? cssW / bufW : 0;
    const unitY = bufH ? cssH / bufH : 0;
    canvas.style.width = (cssW + unitX * 2) + 'px';
    canvas.style.height = (cssH + unitY * 2) + 'px';
    canvas.style.transform = `translate3d(${-unitX}px, ${hold - unitY}px, 0)`;
  }

  function trackScroll() {
    const pin = scenePin();
    let hold = 0;
    if (pin && pin.travel > 0) {
      if (scrollY >= pin.start + pin.travel) hold = pin.travel;
      else if (scrollY > pin.start) hold = scrollY - pin.start;
    }
    if (Math.abs(hold - holdY) < 0.5) return;
    holdY = hold;
    placeCanvas(hold);
  }

  function allocate(keep) {
    const width = Math.round(Math.max(96, Math.min(220, cssW * 0.16)));
    const height = Math.max(48, Math.round(width * cssH / cssW));
    let carried = null;
    const current = fromBuf && fromBuf.length ? fromBuf : field;
    if (keep && current && current.length && bufW && bufH) {
      carried = { data: current, w: bufW, h: bufH };
    }
    bufW = width;
    bufH = Math.min(height, 1600);
    field = new Float32Array(bufW * bufH * 4);
    next = new Float32Array(bufW * bufH * 4);
    canvas.width = bufW + 2;
    canvas.height = bufH + 2;
    pixels = ctx.createImageData(bufW + 2, bufH + 2);
    if (carried) {
      const snap = document.createElement('canvas');
      snap.width = carried.w;
      snap.height = carried.h;
      const g = snap.getContext('2d');
      const image = g.createImageData(carried.w, carried.h);
      const raw = image.data;
      for (let i = 0; i < carried.data.length; i += 4) {
        raw[i] = carried.data[i];
        raw[i + 1] = carried.data[i + 1];
        raw[i + 2] = carried.data[i + 2];
        raw[i + 3] = Math.min(255, carried.data[i + 3] * 255);
      }
      g.putImageData(image, 0, 0);
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = bufW;
      scaledCanvas.height = bufH;
      const scaledCtx = scaledCanvas.getContext('2d');
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.drawImage(snap, 0, 0, bufW, bufH);
      const scaled = scaledCtx.getImageData(0, 0, bufW, bufH).data;
      for (let i = 0; i < scaled.length; i += 4) {
        field[i] = scaled[i];
        field[i + 1] = scaled[i + 1];
        field[i + 2] = scaled[i + 2];
        field[i + 3] = scaled[i + 3] / 255;
      }
    }
    fromBuf = field;
    toBuf = next;
    updateVelocity();
  }

  function pushAhead(dt) {
    time += dt;
    updateVelocity();
    advect(fromBuf, toBuf, dt);
    shiftSources(dt);
    pour(toBuf, dt);
  }

  function sync(force) {
    if (fitting) return;
    fitting = true;
    const size = measure();
    const changed = Math.abs(size.w - cssW) > 2 || Math.abs(size.h - cssH) > 2;
    cssW = size.w;
    cssH = size.h;
    if (clip) {
      clip.style.width = cssW + 'px';
      clip.style.height = cssH + 'px';
    }
    placeSources();
    if (changed || force || !bufW) {
      allocate(primed && changed);
      if (!primed) {
        sources.forEach(source => stamp(fromBuf, source, source.hero ? 0.2 : 0.14));
        for (let i = 0; i < 42; i += 1) {
          pushAhead(1 / 24);
          const swap = fromBuf;
          fromBuf = toBuf;
          toBuf = swap;
        }
        pushAhead(1 / 24);
        primed = true;
      } else {
        pushAhead(1 / 24);
      }
    } else {
      updateVelocity();
    }
    presentLerp(0);
    placeCanvas(holdY < 0 ? 0 : holdY);
    trackScroll();
    fitting = false;
  }

  function advance(dt) {
    const previous = fromBuf;
    fromBuf = toBuf;
    toBuf = previous;
    pushAhead(dt);
  }

  function start() {
    if (reducedMotion.matches) return;
    last = 0;
    cancelAnimationFrame(raf);
    let carry = 0;
    const interval = 1 / 30;
    const frame = now => {
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      carry += dt;
      let steps = 0;
      while (carry >= interval && steps < 2) {
        carry -= interval;
        advance(interval);
        steps += 1;
      }
      if (carry >= interval) carry = 0;
      presentLerp(Math.min(1, carry / interval));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  sync(true);
  if (!reducedMotion.matches) start();
  const resize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => sync(false), 80);
  };
  addEventListener('resize', resize);
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(document.body);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else start();
  });
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(raf);
    if (reducedMotion.matches) presentLerp(0);
    else start();
  });
  addEventListener('scroll', trackScroll, { passive: true });
}

function bootReveal() {
  if (reducedMotion.matches) return;

  function splitPrint(el, step) {
    if (el.dataset.printed) return;
    el.dataset.printed = '1';
    if (!el.getAttribute('aria-label')) {
      const parts = [];
      const collect = node => {
        if (node.nodeType === 3) parts.push(node.textContent);
        else if (node.nodeType === 1) {
          if (node.tagName === 'BR') parts.push(' ');
          else [...node.childNodes].forEach(collect);
        }
      };
      collect(el);
      el.setAttribute('aria-label', parts.join('').replace(/\s+/g, ' ').trim());
    }
    let index = 0;
    const visit = node => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of node.textContent) {
          if (ch.trim() === '') {
            frag.appendChild(document.createTextNode(ch));
            continue;
          }
          const span = document.createElement('span');
          span.className = 'print-char';
          span.setAttribute('aria-hidden', 'true');
          span.style.setProperty('--i', String(index));
          index += 1;
          span.textContent = ch;
          frag.appendChild(span);
        }
        node.replaceWith(frag);
        return;
      }
      if (node.nodeType === 1 && node.tagName !== 'BR') [...node.childNodes].forEach(visit);
    };
    [...el.childNodes].forEach(visit);
    el.style.setProperty('--print-step', `${step}ms`);
  }

  function placement(node) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 8) return 'up';
    if (rect.width > innerWidth * 0.72) return 'up';
    const center = (rect.left + rect.width / 2) / innerWidth;
    if (center < 0.4) return 'left';
    if (center > 0.6) return 'right';
    return 'up';
  }

  const specs = [
    ['.header .wordmark', 'left'],
    ['.desktop-nav', 'right'],
    ['.menu-button', 'right'],
    ['.hero .eyebrow', 'kicker'],
    ['.hero h1', 'print'],
    ['.hero-description', 'up'],
    ['.hero-actions .button', 'scale'],
    ['.hero-actions .text-link', 'auto'],
    ['.hero-product', 'stage'],
    ['.hero-caption > span', 'auto'],
    ['.section-intro > .eyebrow', 'auto-kicker'],
    ['.section-intro h2', 'print'],
    ['.section-lead', 'up'],
    ['.product-tabs > a', 'up'],
    ['.food-copy h3', 'print'],
    ['.food-copy > p', 'left'],
    ['.calculation-toggle', 'left'],
    ['.small-note', 'left'],
    ['.metric-stage', 'right'],
    ['.freshness-status', 'auto'],
    ['.freshness-example figcaption', 'up'],
    ['.case-heading .eyebrow', 'kicker'],
    ['.case-heading .location', 'right'],
    ['.case-story h2', 'print'],
    ['.case-story > p', 'up'],
    ['.case-result', 'left'],
    ['.case-number', 'number'],
    ['.connect-steps > li', 'auto'],
    ['.final-cta .eyebrow', 'kicker'],
    ['.final-cta h2', 'print'],
    ['.final-cta > p', 'up'],
    ['.final-cta .button', 'scale'],
    ['.final-cta .text-link', 'auto'],
    ['.footer .wordmark', 'left'],
    ['.footer > p', 'auto'],
    ['.footer > a', 'right'],
    ['.footer > span', 'up'],
  ];

  const nodes = [];
  const seen = new Map();
  specs.forEach(([selector, requested]) => {
    document.querySelectorAll(selector).forEach(node => {
      if (nodes.includes(node)) return;
      let kind = requested;
      if (kind === 'auto') kind = placement(node);
      if (kind === 'auto-kicker') kind = placement(node) === 'left' ? 'kicker-left' : 'kicker';
      if (kind === 'print') splitPrint(node, node.matches('h1') ? 17 : 13);
      const group = node.closest('section, .header, .footer') || node;
      const index = seen.get(group) || 0;
      seen.set(group, index + 1);
      node.classList.add('reveal', `reveal-${kind}`);
      node.dataset.enter = requested;
      node.style.setProperty('--reveal-delay', `${Math.min(index, 7) * 70}ms`);
      nodes.push(node);
    });
  });

  document.querySelectorAll('.module-copy h3').forEach(node => splitPrint(node, 12));

  const scene = document.querySelector('.product-scroll-scene');
  if (scene) {
    const sceneObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      scene.classList.add('motion-live');
      sceneObserver.disconnect();
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    const sceneRect = scene.getBoundingClientRect();
    if (sceneRect.top < innerHeight * 0.92 && sceneRect.bottom > 0) scene.classList.add('motion-live');
    else sceneObserver.observe(scene);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  function arm(node) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < 24) {
      node.classList.add('is-in');
      return;
    }
    observer.observe(node);
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      nodes.forEach(node => {
        if (node.classList.contains('is-in')) return;
        const requested = node.dataset.enter;
        if (requested !== 'auto' && requested !== 'auto-kicker') return;
        const kind = requested === 'auto-kicker'
          ? (placement(node) === 'left' ? 'kicker-left' : 'kicker')
          : placement(node);
        [...node.classList].forEach(name => {
          if (name.startsWith('reveal-')) node.classList.remove(name);
        });
        node.classList.add('reveal', `reveal-${kind}`);
      });
    }, 140);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => nodes.forEach(arm));
  });
}

function bootIntro() {
  const boot = document.querySelector('.boot');
  const done = () => document.dispatchEvent(new Event('taby-intro-done'));
  if (!boot) {
    document.documentElement.classList.remove('is-booting');
    bootReveal();
    done();
    return;
  }

  const shell = [...document.querySelectorAll('.skip-link, .header, .mobile-nav, main, .footer, #image-dialog')];
  shell.forEach(node => { node.inert = true; });
  if (history.scrollRestoration) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  document.documentElement.setAttribute('aria-busy', 'true');

  const release = () => {
    shell.forEach(node => { node.inert = false; });
    document.documentElement.classList.remove('is-booting');
    document.documentElement.removeAttribute('aria-busy');
    if (history.scrollRestoration) history.scrollRestoration = 'auto';
    boot.remove();
    done();
  };

  const loaded = new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else addEventListener('load', () => resolve(), { once: true });
  });
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  const cap = new Promise(resolve => setTimeout(resolve, 5200));

  if (reducedMotion.matches) {
    Promise.race([Promise.all([loaded, fonts]), cap]).then(() => {
      bootReveal();
      release();
    });
    return;
  }

  const minimum = new Promise(resolve => setTimeout(resolve, 1560));
  Promise.race([Promise.all([loaded, fonts, minimum]), cap]).then(() => {
    const mark = boot.querySelector('.boot-mark');
    const target = document.querySelector('.header .wordmark');
    const openAndRelease = hold => {
      boot.classList.add('is-opening');
      setTimeout(() => bootReveal(), 420);
      setTimeout(() => {
        if (target) target.classList.add('is-in', 'intro-settled');
        if (mark) mark.style.opacity = '0';
        document.documentElement.classList.remove('is-booting');
      }, hold);
      setTimeout(release, hold + 200);
    };
    if (!mark || !target) {
      openAndRelease(900);
      return;
    }
    mark.style.animation = 'none';
    mark.style.transform = 'none';
    const from = mark.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (from.width < 8 || to.width < 8) {
      openAndRelease(900);
      return;
    }
    const scale = to.width / from.width;
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    mark.style.transformOrigin = 'top left';
    mark.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ], { duration: 920, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'forwards' });
    openAndRelease(980);
  });
}

bootMenu();
bootProduct();
bootCost();
bootDialog();
bootFlow();
bootIntro();
