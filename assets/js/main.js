(function(){
  "use strict";
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- preloader ---- */
  var preloader = document.getElementById('preloader');
  var minDelay = new Promise(function(res){ setTimeout(res, reduceMotion ? 0 : 900); });
  var pageReady = new Promise(function(res){
    if (document.readyState === 'complete') res();
    else window.addEventListener('load', res, {once:true});
  });
  Promise.all([minDelay, pageReady]).then(function(){
    preloader.classList.add('is-hidden');
    document.documentElement.classList.add('is-ready');
    preloader.addEventListener('transitionend', function(){ preloader.remove(); }, {once:true});
  });

  /* ---- custom cursor ---- */
  if (window.matchMedia('(pointer:fine)').matches && !reduceMotion){
    document.documentElement.classList.add('has-custom-cursor');
    var dot = document.getElementById('cursorDot');
    var mx=0,my=0,cx=0,cy=0,active=false;
    document.addEventListener('mousemove', function(e){
      mx=e.clientX; my=e.clientY;
      if(!active){ active=true; cx=mx; cy=my; }
      dot.classList.add('is-active');
    });
    document.addEventListener('mousedown', function(){ dot.classList.add('is-down'); });
    document.addEventListener('mouseup', function(){ dot.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function(){ active=false; dot.classList.remove('is-active'); });
    var hoverables = 'a, button, .btn, .woki-branch, .loc, [role="button"]';
    document.addEventListener('mouseover', function(e){
      if (e.target.closest(hoverables)) dot.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function(e){
      if (e.target.closest(hoverables)) dot.classList.remove('is-hover');
    });
    // el iframe de woki es de otro dominio, entonces mientras el mouse está
    // arriba no llegan más eventos mousemove y el puntito se queda tildado
    // ahí flotando. reseteamos active para que no haga un viaje raro por
    // toda la pantalla cuando el mouse vuelve a aparecer del otro lado
    var wokiFrameWrap = document.getElementById('wokiFrameWrap');
    var wokiPanelEl = document.getElementById('wokiPanel');
    if (wokiFrameWrap){
      wokiFrameWrap.addEventListener('mouseenter', function(){ active = false; });
    }
    var FRAME_FADE_DIST = 120; // a partir de estos px de distancia arranca a desvanecerse
    function frameProximityFade(){
      if (!wokiFrameWrap || !wokiPanelEl.classList.contains('open') || !wokiFrameWrap.classList.contains('show')) return null;
      var r = wokiFrameWrap.getBoundingClientRect();
      var dx = Math.max(r.left - mx, 0, mx - r.right);
      var dy = Math.max(r.top - my, 0, my - r.bottom);
      var dist = Math.sqrt(dx * dx + dy * dy);
      return Math.min(1, dist / FRAME_FADE_DIST);
    }
    (function loop(){
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      var fade = frameProximityFade();
      dot.style.opacity = (fade === null) ? '' : String(fade);
      requestAnimationFrame(loop);
    })();
  }

  /* ---- nav shrink ---- */
  var nav = document.getElementById('nav');
  function onScrollNav(){ nav.classList.toggle('scrolled', window.scrollY > 30); }
  document.addEventListener('scroll', onScrollNav, {passive:true});
  onScrollNav();

  /* ---- hero parallax glow ---- */
  var glow = document.getElementById('heroGlow');
  var ticking = false;
  function onScrollParallax(){
    if (reduceMotion) return;
    if (!ticking){
      window.requestAnimationFrame(function(){
        var y = window.scrollY;
        glow.style.transform = 'translateY(' + (y * 0.25) + 'px)';
        ticking = false;
      });
      ticking = true;
    }
  }
  document.addEventListener('scroll', onScrollParallax, {passive:true});

  /* ---- scroll reveal: replays every time, both directions ---- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        entry.target.classList.toggle('in', entry.isIntersecting);
      });
    }, {threshold: 0.18, rootMargin: '0px 0px -8% 0px'});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* ---- menu carousel: auto-scroll on capable desktops, manual swipe elsewhere ----
     va cuadro a cuadro en vez de con @keyframes, para que no se note ningún
     punto de reinicio: la posición sigue sumando y da la vuelta usando el
     ancho real de una tanda de tarjetas, entonces el loop no se corta nunca ---- */
  var carousel = document.getElementById('menuCarousel');
  var track = document.getElementById('menuTrack');
  var menuPrev = document.getElementById('menuPrev');
  var menuNext = document.getElementById('menuNext');
  var auto = null; /* estado del auto-scroll, si está activo (solo desktop) */

  if (carousel && track && window.matchMedia('(pointer:fine)').matches && !reduceMotion){
    track.insertAdjacentHTML('beforeend', track.innerHTML);
    carousel.classList.add('is-auto');

    auto = { setWidth: 0, offset: 0, paused: false, resumeTimer: null };
    function measureSetWidth(){ auto.setWidth = track.scrollWidth / 2; }
    measureSetWidth();
    window.addEventListener('resize', measureSetWidth);

    var SECONDS_PER_SET = 36;
    var lastTs = null;
    carousel.addEventListener('mouseenter', function(){ auto.paused = true; });
    carousel.addEventListener('mouseleave', function(){ auto.paused = false; });

    function tick(ts){
      if (lastTs === null) lastTs = ts;
      var dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (!auto.paused && auto.setWidth > 0){
        auto.offset += (auto.setWidth / SECONDS_PER_SET) * dt;
        if (auto.offset >= auto.setWidth) auto.offset -= auto.setWidth;
        track.style.transform = 'translateX(' + (-auto.offset) + 'px)';
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---- flechas: nudgean el carrusel a mano, en los dos modos ---- */
  if (carousel && track && (menuPrev || menuNext)){
    var nudge = function(dir){
      var card = track.querySelector('.menu__card');
      var step = card ? card.getBoundingClientRect().width : 300;

      if (auto){
        auto.offset += dir * step;
        if (auto.offset < 0) auto.offset += auto.setWidth;
        if (auto.offset >= auto.setWidth) auto.offset -= auto.setWidth;
        track.classList.add('is-nudging');
        track.style.transform = 'translateX(' + (-auto.offset) + 'px)';
        auto.paused = true;
        clearTimeout(auto.resumeTimer);
        clearTimeout(auto.nudgeTimer);
        auto.nudgeTimer = setTimeout(function(){ track.classList.remove('is-nudging'); }, 600);
        auto.resumeTimer = setTimeout(function(){ auto.paused = false; }, 3000);
      } else {
        carousel.scrollBy({ left: dir * step, behavior: 'smooth' });
      }
    };
    if (menuPrev) menuPrev.addEventListener('click', function(){ nudge(-1); });
    if (menuNext) menuNext.addEventListener('click', function(){ nudge(1); });
  }

  /* ---- magnetic buttons (desktop, fine pointer only) ---- */
  if (window.matchMedia('(pointer:fine)').matches && !reduceMotion){
    document.querySelectorAll('.btn').forEach(function(btn){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        var mx = (e.clientX - r.left - r.width/2) * 0.28;
        var my = (e.clientY - r.top - r.height/2) * 0.5;
        btn.style.setProperty('--mx', mx + 'px');
        btn.style.setProperty('--my', my + 'px');
      });
      btn.addEventListener('mouseleave', function(){
        btn.style.setProperty('--mx', '0px');
        btn.style.setProperty('--my', '0px');
      });
    });
  }

  /* =====================================================
     WOKI PANEL — picker -> iframe, con loader y fallback WA
  ===================================================== */
  var backdrop = document.getElementById('wokiBackdrop');
  var panel = document.getElementById('wokiPanel');
  var title = document.getElementById('wokiTitle');
  var backBtn = document.getElementById('wokiBack');
  var closeBtn = document.getElementById('wokiClose');
  var picker = document.getElementById('wokiPicker');
  var frameWrap = document.getElementById('wokiFrameWrap');
  var frame = document.getElementById('wokiFrame');
  var loader = document.getElementById('wokiLoader');
  var waLink = document.getElementById('wokiWa');
  var GENERIC_WA_LINK = 'https://wa.me/5491100000001?text=Hola!%20Quiero%20reservar%20una%20mesa';
  var lastFocused = null;

  function showPicker(){
    frameWrap.classList.remove('show');
    picker.style.display = '';
    backBtn.classList.remove('show');
    title.textContent = 'Elegí tu sucursal';
    waLink.href = GENERIC_WA_LINK;
    // stop any in-flight load and reset loader state for next pick
    frame.src = 'about:blank';
    loader.classList.remove('show');
  }

  function openBranch(btn){
    var src = btn.getAttribute('data-src');
    var wa = btn.getAttribute('data-wa');
    var name = btn.getAttribute('data-name');

    picker.style.display = 'none';
    frameWrap.classList.add('show');
    backBtn.classList.add('show');
    title.textContent = name;
    waLink.href = wa;
    loader.classList.add('show');

    frame.src = src;
  }

  frame.addEventListener('load', function(){
    if (frame.src && frame.src !== 'about:blank'){
      loader.classList.remove('show');
    }
  });

  function openPanel(triggerBtn){
    lastFocused = document.activeElement;
    backdrop.classList.add('open');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showPicker();

    if (triggerBtn && triggerBtn.hasAttribute('data-branch') && triggerBtn.hasAttribute('data-src')){
      // opened from a specific branch card: jump straight to that branch
      openBranch(triggerBtn);
    }
    var firstBranch = picker.querySelector('.woki-branch');
    if (firstBranch) firstBranch.focus({preventScroll:true});
  }

  function closePanel(){
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    frame.src = 'about:blank';
    if (lastFocused) lastFocused.focus({preventScroll:true});
  }

  document.querySelectorAll('[data-open-woki]').forEach(function(btn){
    btn.addEventListener('click', function(){ openPanel(btn); });
  });

  picker.querySelectorAll('.woki-branch').forEach(function(btn){
    btn.addEventListener('click', function(){ openBranch(btn); });
  });

  backBtn.addEventListener('click', showPicker);
  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
  });
})();
