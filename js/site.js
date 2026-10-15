/**************************************************************
 * VertebrateSkulls site builder
 *
 * You should not need to edit this file to change the website.
 * Text, pictures, menus and 3D models all live in the content/ folder:
 *   content/site.json      header, menu, theme, viewer settings
 *   content/models.json    every 3D model and which viewer shows it
 *   content/pages/*.json   one file per page
 * See EDITING_GUIDE.md for how to edit those files.
 *
 * Each .html page is a small shell: <body data-page="aotus"> loads
 * content/pages/aotus.json. page.html?page=NAME loads any page by name,
 * so new pages don't need a new .html file.
 **************************************************************/
(function () {
  'use strict';

  var CONTENT = 'content/';

  /* ---------- small helpers ---------- */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === undefined || attrs[k] === null || attrs[k] === false) return;
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) e.innerHTML = rich(html);
    return e;
  }
  // Text may use plain HTML (<i>, <em>, <a>) or the shortcuts *italic* and **bold**.
  function rich(s) {
    return String(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  }
  function getJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' could not be loaded (' + r.status + ')');
      return r.json().catch(function (err) {
        throw new Error(path + ' has a typing mistake: ' + err.message +
          '. Check for a missing comma or quote near that spot (jsonlint.com can point to it).');
      });
    });
  }
  function loadScript(src) {
    loadScript.cache = loadScript.cache || {};
    if (!loadScript.cache[src]) loadScript.cache[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { fail(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
    return loadScript.cache[src];
  }
  function whenVisible(node, enabled, fn) {
    if (!enabled || !('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: '400px 0px' });
    io.observe(node);
  }
  function showError(msg) {
    var box = el('div', { class: 'site-error', role: 'alert' });
    box.innerHTML = '<strong>This page could not be built.</strong><br>' + msg +
      (location.protocol === 'file:' ? '<br><br>Pages read their text from the content/ folder, which browsers ' +
        'block when a file is opened directly. Preview the site through a local web server instead ' +
        '(see EDITING_GUIDE.md, "Previewing on your computer").' : '');
    document.body.appendChild(box);
    console.error(msg);
  }

  /* ---------- theme (light / dark) ---------- */
  var Theme = {
    current: function () {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) return t;
      return Theme.fallback === 'system' && window.matchMedia &&
        matchMedia('(prefers-color-scheme: light)').matches ? 'light' : (Theme.fallback === 'light' ? 'light' : 'dark');
    },
    set: function (t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('vs-theme', t); } catch (e) { /* ignore */ }
      Theme.listeners.forEach(function (fn) { fn(t); });
      Theme.label();
    },
    label: function () {
      var b = document.querySelector('.theme-switch');
      if (!b) return;
      var light = Theme.current() === 'light';
      b.textContent = light ? '☾ Dark mode' : '☀ Light mode';
      b.setAttribute('aria-pressed', String(light));
    },
    listeners: [],
    fallback: 'dark'
  };

  /* ---------- header & menu ---------- */
  function buildHeader(site, page) {
    var header = el('header');
    var logo = site.logo || {};
    if (page.header === 'classic') {
      var h1 = el('h1', null, site.siteTitle);
      var d = el('div', { class: 'logo' });
      d.appendChild(el('img', { src: logo.image, align: 'right', alt: logo.description || '' }));
      h1.appendChild(d);
      header.appendChild(h1);
      header.appendChild(el('h1', null, site.siteSubtitle));
    } else {
      var row = el('div', { class: 'header-row' });
      var title = el('div', { class: 'title' });
      title.appendChild(el('h1', null, site.siteTitle));
      title.appendChild(el('h2', null, site.siteSubtitle));
      var lg = el('div', { class: 'logo' });
      lg.appendChild(el('img', { src: logo.image, alt: logo.description || '' }));
      row.appendChild(title); row.appendChild(lg);
      header.appendChild(row);
    }
    return header;
  }

  function linkFor(item) {
    if (item.page) return 'page.html?page=' + encodeURIComponent(item.page);
    return item.link || '#';
  }

  function buildMenu(site, page) {
    var nav = el('nav', { class: 'navigation', 'aria-label': 'Main menu' });
    var ul = el('ul');
    (site.menu || []).forEach(function (item) {
      var li = el('li');
      var a = el('a', { href: linkFor(item) }, item.label);
      if (page.menuHighlight === item.label) a.className = 'active';
      li.appendChild(a);
      if (item.submenu && item.submenu.length) {
        li.className = 'has-submenu';
        a.setAttribute('aria-haspopup', 'true');
        a.setAttribute('aria-expanded', 'false');
        var sub = el('ul', { class: 'submenu' });
        item.submenu.forEach(function (s) {
          var sli = el('li');
          sli.appendChild(el('a', { href: linkFor(s) }, s.label));
          sub.appendChild(sli);
        });
        li.appendChild(sub);
        // Phones/tablets have no hover: first tap opens the submenu, second tap follows the link.
        a.addEventListener('click', function (e) {
          var touch = window.matchMedia && matchMedia('(hover: none)').matches;
          if (touch && !li.classList.contains('open')) {
            e.preventDefault();
            li.classList.add('open'); a.setAttribute('aria-expanded', 'true');
          }
        });
      }
      ul.appendChild(li);
    });
    nav.appendChild(ul);

    if (!site.theme || site.theme.showSwitch !== false) {
      var tli = el('div', { class: 'theme-switch-wrap' });
      var b = el('button', { type: 'button', class: 'theme-switch' });
      b.addEventListener('click', function () { Theme.set(Theme.current() === 'light' ? 'dark' : 'light'); });
      tli.appendChild(b);
      nav.appendChild(tli);
    }
    return nav;
  }

  /* ---------- sections ---------- */
  function caption(tag, text) { return el(tag, null, text); }

  function mediaBlock(sec, ctx) {
    if (sec.model) {
      var div = el('div', { class: 'media' });
      div.appendChild(Viewers.create(sec.model, ctx));
      if (sec.caption) div.appendChild(caption('figcaption', sec.caption));
      return div;
    }
    if (sec.image) {
      var fig = el('figure', { class: 'media' });
      fig.appendChild(el('img', { src: sec.image, alt: sec.description || '', loading: 'lazy' }));
      if (sec.caption) fig.appendChild(caption('figcaption', sec.caption));
      return fig;
    }
    if (sec.embed || sec.video) {
      var m = el('div', { class: 'media' });
      m.appendChild(el('iframe', {
        src: sec.embed || sec.video, title: sec.embedTitle || sec.caption || 'Embedded content',
        loading: 'lazy', allow: 'fullscreen; xr-spatial-tracking', allowfullscreen: ''
      }));
      if (sec.caption) m.appendChild(caption('figcaption', sec.caption));
      return m;
    }
    return null;
  }

  function textBlock(sec) {
    var t = el('div', { class: 'text' });
    if (sec.title) t.appendChild(el(sec.bigTitle ? 'h2' : 'h3', null, sec.title));
    (sec.paragraphs || []).forEach(function (p) { t.appendChild(el('p', null, p)); });
    return t;
  }

  var Sections = {
    'text-and-media': function (sec, ctx) {
      var s = el('section', { class: 'component' });
      var c = el('div', { class: 'component-content' });
      var media = mediaBlock(sec, ctx), text = textBlock(sec);
      if (media && sec.mediaSide === 'left') { c.appendChild(media); c.appendChild(text); }
      else { c.appendChild(text); if (media) c.appendChild(media); }
      s.appendChild(c);
      return s;
    },
    'text': function (sec, ctx) { return Sections['text-and-media'](Object.assign({}, sec, { model: null, image: null, embed: null }), ctx); },
    'heading': function (sec) { return el('h2', null, sec.text); },
    'callout': function (sec) {
      var box = el('div', { class: 'callout-goldbanner' });
      box.appendChild(el('h2', null, sec.title));
      if (sec.text) box.appendChild(el('p', null, sec.text));
      (sec.links || []).forEach(function (l) {
        var p = el('p');
        p.appendChild(el('a', { href: linkFor(l), class: 'callout-link' }, l.label));
        box.appendChild(p);
      });
      return box;
    },
    'model-table': function (sec, ctx) {
      var table = el('table', { border: '0', class: 'model-table' });
      (sec.rows || []).forEach(function (row) {
        var tr = el('tr');
        row.models.forEach(function (m) {
          var td = el('td');
          td.appendChild(Viewers.create(m.model, ctx, { width: m.width, height: m.height }));
          tr.appendChild(td);
        });
        table.appendChild(tr);
        if (row.labels) {
          var lr = el('tr');
          row.labels.forEach(function (l) { lr.appendChild(el('td', null, l)); });
          table.appendChild(lr);
        }
      });
      (sec.notes || []).forEach(function (n) {
        var tr = el('tr'); tr.appendChild(el('td', null, n)); table.appendChild(tr);
      });
      return table;
    },
    'spacer': function () { return el('p', null, '&nbsp;'); }
  };

  /* ---------- 3D viewers ---------- */
  var Viewers = {
    create: function (name, ctx, size) {
      var def = ctx.models[name];
      if (!def) {
        var miss = el('div', { class: 'viewer-missing' },
          'Model "' + name + '" is not listed in content/models.json');
        return miss;
      }
      var kind = def.viewer || 'voyager';
      var cfg = def[kind] || {};
      var settings = (ctx.site.viewers || {})[kind] || {};
      if (kind === 'sketchfab') return Viewers.sketchfab(name, cfg, settings, size);
      return Viewers.voyager(name, cfg, settings, size);
    },

    /* Smithsonian Voyager. Click (or tap) the model to show/hide the part
       tagged "show" in the model's scene.svx.json; "cycle" adds a faded step. */
    voyager: function (name, cfg, settings, size) {
      var slot = el('div', { class: 'viewer voyager-slot', 'data-model': name, role: 'region',
        'aria-label': '3D model ' + name + '. Drag to rotate, scroll or pinch to zoom.' });
      if (size && size.width) { slot.style.width = size.width + 'px'; slot.style.height = size.height + 'px'; }
      whenVisible(slot, settings.loadWhenVisible !== false, function () {
        loadScript(settings.script).then(function () {
          var dark = Theme.current() !== 'light';
          var v = el('voyager-explorer', {
            root: cfg.folder, document: cfg.scene || 'scene.svx.json',
            uiMode: cfg.buttons || settings.buttons || 'menu|help|reset',
            bgStyle: 'Solid',
            bgColor: dark ? settings.backgroundDark : settings.backgroundLight
          });
          slot.appendChild(v);
          Theme.listeners.push(function (t) {
            if (v.setBackgroundColor) v.setBackgroundColor(t === 'light' ? settings.backgroundLight : settings.backgroundDark);
          });
          var states = cfg.click === 'cycle' ? ['show', 'fade', ''] : (cfg.click === 'toggle' ? ['show', ''] : null);
          if (states) Viewers.onModelClick(v, function () {
            var i = (states.indexOf(v._vsState || 'show') + 1) % states.length;
            v._vsState = states[i];
            if (v.setActiveTags) v.setActiveTags(states[i]);
          });
        }).catch(function (err) { slot.textContent = err.message; });
      });
      return slot;
    },

    // A click is a press and release without dragging, on the 3D picture itself (not on a button).
    onModelClick: function (node, fn) {
      var start = null;
      node.addEventListener('pointerdown', function (e) { start = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
      node.addEventListener('pointerup', function (e) {
        if (!start) return;
        var moved = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
        var quick = Date.now() - start.t < 500;
        var target = e.composedPath ? e.composedPath()[0] : e.target;
        start = null;
        if (moved < 6 && quick && target && target.tagName === 'CANVAS') fn();
      }, true);
    },

    /* Sketchfab (kept so any model can switch back by changing "viewer"). */
    sketchfab: function (name, cfg, settings, size) {
      var attrs = { class: 'sketchfab', title: '3D model ' + name,
        allow: 'autoplay; fullscreen; xr-spatial-tracking', allowfullscreen: '' };
      if (size && size.width) { attrs.width = size.width; attrs.height = size.height; }
      var iframe = el('iframe', attrs);
      whenVisible(iframe, settings.loadWhenVisible !== false, function () {
        loadScript(settings.script).then(function () {
          var client = new window.Sketchfab(settings.version || '1.12.1', iframe);
          var opts = Object.assign({}, cfg.options || {});
          opts.success = function (api) { Viewers.sketchfabReady(api, cfg); };
          opts.error = function (err) { console.error('Sketchfab API error:', err); };
          client.init(cfg.id, opts);
        }).catch(function (err) { console.error(err); });
      });
      return iframe;
    },

    sketchfabReady: function (api, cfg) {
      api.start();
      if (!cfg.click || !cfg.clickParts) return;
      api.addEventListener('viewerready', function () {
        api.getNodeMap(function (err, nodes) {
          if (err) return console.error(err);
          var list = Object.keys(nodes).map(function (k) { return nodes[k]; });
          var ids = list.filter(function (n) { return cfg.clickParts.indexOf(n.name) >= 0; })
            .map(function (n) { return n.instanceID; });
          if (!ids.length) return console.warn('None of these parts were found:', cfg.clickParts);
          var state = 0;
          api.addEventListener('click', function () {
            var n = cfg.click === 'cycle' ? 3 : 2;
            state = (state + 1) % n;
            if (state === 0) { ids.forEach(function (id) { api.show(id); }); opacity(1); }
            else if (state === 1 && n === 3) { ids.forEach(function (id) { api.show(id); }); opacity(cfg.fade || 0.03); }
            else { ids.forEach(function (id) { api.hide(id); }); }
          }, { pick: 'fast' });
        });
      });
      function opacity(v) {
        api.getMaterialList(function (err, mats) {
          if (err) return;
          mats.forEach(function (m) {
            if (cfg.clickParts.indexOf(m.name) >= 0 && m.channels && m.channels.Opacity) {
              m.channels.Opacity.enable = true; m.channels.Opacity.factor = v; m.transparent = true;
              api.setMaterial(m);
            }
          });
        });
      }
    }
  };

  /* ---------- build the page ---------- */
  function pageName() {
    var q = new URLSearchParams(location.search).get('page');
    return q || document.body.getAttribute('data-page') || 'index';
  }

  function build(site, models, page) {
    var ctx = { site: site, models: models, page: page };
    Theme.fallback = (site.theme && site.theme.default) || 'dark';
    if (!document.documentElement.getAttribute('data-theme') && Theme.fallback !== 'system') {
      document.documentElement.setAttribute('data-theme', Theme.fallback);
    }
    document.title = page.browserTitle || site.browserTitle || site.siteTitle || document.title;
    if (page.fonts) document.head.appendChild(el('link', { rel: 'stylesheet', href: page.fonts }));

    var frag = document.createDocumentFragment();
    frag.appendChild(el('a', { class: 'skip-link', href: '#main' }, 'Skip to content'));
    frag.appendChild(buildHeader(site, page));
    var container = el('div', { class: 'container' });
    container.appendChild(buildMenu(site, page));

    var main = el('main', { class: 'main-content', id: 'main' });
    var target = main;
    if (page.extraWrapper) {
      var outer = el('div', { class: 'main-content' });
      outer.innerHTML = '&nbsp;';
      outer.appendChild(main);
      container.appendChild(outer);
    } else {
      if (page.spacerAtTop) main.innerHTML = '&nbsp;';
      container.appendChild(main);
    }
    if (page.heading) target.appendChild(el('h2', null, page.heading));
    (page.sections || []).forEach(function (sec, i) {
      var make = Sections[sec.type];
      if (!make) {
        target.appendChild(el('p', { class: 'site-error' }, 'Section ' + (i + 1) + ' has an unknown type "' +
          sec.type + '". Use one of: ' + Object.keys(Sections).join(', ')));
        return;
      }
      target.appendChild(make(sec, ctx));
    });
    frag.appendChild(container);
    document.body.appendChild(frag);
    Theme.label();
    document.dispatchEvent(new CustomEvent('site:ready', { detail: ctx }));
  }

  function start() {
    var name = pageName();
    Promise.all([
      getJSON(CONTENT + 'site.json'),
      getJSON(CONTENT + 'models.json'),
      getJSON(CONTENT + 'pages/' + name + '.json')
    ]).then(function (r) { build(r[0], r[1], r[2]); })
      .catch(function (err) { showError(err.message); });
  }

  window.VertebrateSkulls = { Sections: Sections, Viewers: Viewers, Theme: Theme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
