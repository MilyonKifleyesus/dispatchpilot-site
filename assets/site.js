(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  // Smooth scrolling, only when the visitor has not asked for less motion.
  if (!reduce && window.Lenis && hasGsap) {
    lenis = new Lenis({ anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Copy the contact address.
  var copy = document.getElementById('copy');
  if (copy) {
    copy.addEventListener('click', function () {
      var text = copy.getAttribute('data-copy');
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy address'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  }

  var lane = document.getElementById('lane');
  if (!lane) return;

  var mail = document.getElementById('mail');
  var status = document.getElementById('status');
  var send = document.getElementById('send');
  var secs = [].slice.call(lane.querySelectorAll('.sec'));
  var end = lane.querySelector('.end');
  var NS = 'http://www.w3.org/2000/svg';

  // Build the road.
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'lane-svg');
  svg.setAttribute('aria-hidden', 'true');
  var paths = ['asphalt', 'done', 'centre'].map(function (c) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('class', c);
    svg.appendChild(p);
    return p;
  });
  var road = paths[0], done = paths[1];
  lane.insertBefore(svg, lane.firstChild);

  var dots = secs.concat([end]).map(function () {
    var d = document.createElement('span');
    d.className = 'dot';
    d.setAttribute('aria-hidden', 'true');
    lane.appendChild(d);
    return d;
  });
  var pkt = document.createElement('span');
  pkt.className = 'pkt';
  pkt.setAttribute('aria-hidden', 'true');
  lane.appendChild(pkt);

  var total = 0, ys = [], N = 0, y0 = 0, y1 = 0, dotY = [];

  function build() {
    var W = lane.clientWidth;
    var wide = window.innerWidth >= 900;
    var lr = lane.getBoundingClientRect();
    var mr = mail.getBoundingClientRect();
    var px = wide ? mr.left + mr.width / 2 - lr.left : 11;
    var py = wide ? mr.bottom - lr.top - 4 : 0;
    var d = 'M' + px + ' ' + py;
    y0 = py;
    dotY = [];

    secs.forEach(function (s, i) {
      var x = !wide ? 11 : (s.getAttribute('data-side') === 'left' ? W * 0.82 : W * 0.14);
      var top = s.offsetTop, bot = top + s.offsetHeight, m = (py + top) / 2;
      d += ' C' + px + ' ' + m + ' ' + x + ' ' + m + ' ' + x + ' ' + top + ' L' + x + ' ' + bot;
      dots[i].style.transform = 'translate(' + x + 'px,' + (top + 14) + 'px)';
      dotY[i] = top + 14;
      px = x; py = bot;
    });

    var ex = wide ? W / 2 : 11, ey = end.offsetTop, mm = (py + ey) / 2;
    d += ' C' + px + ' ' + mm + ' ' + ex + ' ' + mm + ' ' + ex + ' ' + ey;
    dots[secs.length].style.transform = 'translate(' + ex + 'px,' + ey + 'px)';
    dotY[secs.length] = ey;
    y1 = ey;

    paths.forEach(function (p) { p.setAttribute('d', d); });
    total = road.getTotalLength();
    done.style.strokeDasharray = total + ' ' + total;

    // Lookup table: the road never turns back uphill, so y maps to one length.
    N = Math.max(200, Math.round(total / 6));
    ys = new Array(N + 1);
    for (var i = 0; i <= N; i++) ys[i] = road.getPointAtLength(total * i / N).y;
    lane.classList.add('ready');
    update();
  }

  function render(y) {
    var lo = 0, hi = N;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (ys[mid] < y) lo = mid + 1; else hi = mid; }
    var l = total * lo / N;
    var p = road.getPointAtLength(l);
    pkt.style.transform = 'translate(' + (p.x - 22) + 'px,' + (p.y - 15) + 'px)';
    done.style.strokeDashoffset = total - l;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', y >= dotY[i] - 1);
  }

  function update() {
    if (!N) return;
    if (reduce) { render(y1); return; }            // road drawn complete, nothing moves
    var y = window.innerHeight * 0.5 - lane.getBoundingClientRect().top;
    render(Math.max(y0, Math.min(y1, y)));
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', build);
  window.addEventListener('load', build);
  if (window.ResizeObserver) new ResizeObserver(build).observe(lane);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  setTimeout(build, 1500);                          // after the hero has settled
  build();

  // Words of the opening statement ink in as the email passes.
  var st = lane.querySelector('[data-words]');
  if (st && hasGsap && !reduce) {
    var words = st.textContent.trim().split(/\s+/);
    st.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w;
      st.appendChild(s);
      if (i < words.length - 1) st.appendChild(document.createTextNode(' '));
    });
    gsap.fromTo(st.children, { opacity: 0.18 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 48%', scrub: true }
    });
  }

  // Send: stamp the email and follow it onto the road.
  if (send) {
    send.addEventListener('click', function () {
      mail.classList.add('sent');
      status.textContent = 'Sent from your Gmail';
      send.textContent = 'Sent';
      var target = document.getElementById('what');
      setTimeout(function () {
        if (lenis) lenis.scrollTo(target, { offset: -window.innerHeight * 0.3, duration: 1.8 });
        else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }, reduce ? 0 : 450);
    });
  }
})();
