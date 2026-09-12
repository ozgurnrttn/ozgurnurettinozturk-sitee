(function () {
  'use strict';

  var root = document.documentElement;

  var store = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
    },
  };

  /* ---------- Theme (dark default, light optional) ---------- */
  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
    });
  });

  /* ---------- Language (TR in HTML, EN from I18N) ---------- */
  var dict = window.I18N || {};
  var textNodes = document.querySelectorAll('[data-i18n]');
  var attrNodes = document.querySelectorAll('[data-i18n-attr]');
  var originalText = new Map();
  var originalAttr = new Map();

  function parseAttrs(el) {
    // format: "aria-label:ui.menu; title:ui.menu"
    return el.getAttribute('data-i18n-attr').split(';').map(function (pair) {
      var parts = pair.split(':');
      return { attr: parts[0].trim(), key: (parts[1] || '').trim() };
    }).filter(function (p) { return p.attr && p.key; });
  }

  textNodes.forEach(function (el) { originalText.set(el, el.innerHTML); });
  attrNodes.forEach(function (el) {
    var saved = {};
    parseAttrs(el).forEach(function (p) { saved[p.attr] = el.getAttribute(p.attr); });
    originalAttr.set(el, saved);
  });

  function setLang(lang) {
    var en = lang === 'en';
    textNodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.innerHTML = en && dict[key] != null ? dict[key] : originalText.get(el);
    });
    attrNodes.forEach(function (el) {
      var saved = originalAttr.get(el);
      parseAttrs(el).forEach(function (p) {
        var value = en && dict[p.key] != null ? dict[p.key] : saved[p.attr];
        if (value != null) el.setAttribute(p.attr, value);
      });
    });
    root.lang = en ? 'en' : 'tr';
    store.set('lang', root.lang);
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.textContent = en ? 'TR' : 'EN';
      btn.setAttribute('aria-label', en ? 'Türkçe’ye geç' : 'Switch to English');
    });
  }

  document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLang(root.lang === 'en' ? 'tr' : 'en');
    });
  });

  setLang(store.get('lang') === 'en' ? 'en' : 'tr');

  /* ---------- Mobile navigation ---------- */
  var header = document.querySelector('.site-header');
  var menuBtn = document.querySelector('[data-menu-toggle]');

  function closeMenu() {
    header.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (header && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    header.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ---------- List filter & search (projeler.html, blog.html) ---------- */
  var filterItems = document.querySelectorAll('[data-category]');

  if (filterItems.length) {
    var filterBtns = document.querySelectorAll('[data-filter]');
    var searchInput = document.querySelector('[data-filter-search]');
    var emptyState = document.querySelector('[data-filter-empty]');
    var listTop = document.querySelector('[data-filter-top]');
    var activeFilter = 'all';

    // Case- and accent-insensitive, Turkish-aware ("İletişim" matches "iletisim")
    var normalize = function (s) {
      return s.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ı/g, 'i');
    };

    var categoriesOf = function (item) {
      return item.getAttribute('data-category').split(' ');
    };

    var applyFilter = function () {
      var query = searchInput ? normalize(searchInput.value.trim()) : '';
      var visible = 0;
      filterItems.forEach(function (item) {
        var inCategory = activeFilter === 'all' || categoriesOf(item).indexOf(activeFilter) > -1;
        var inText = !query || normalize(item.textContent).indexOf(query) > -1;
        item.hidden = !(inCategory && inText);
        if (!item.hidden) visible++;
      });
      if (emptyState) emptyState.hidden = visible > 0;
    };

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-filter');
        // Keep every control for the same category in sync (toolbar + sidebar)
        filterBtns.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === activeFilter));
        });
        applyFilter();
        // Sidebar buttons can sit below the list on small screens: bring the list into view
        if (listTop && btn.closest('[data-filter-jump]')) {
          var top = listTop.getBoundingClientRect().top;
          if (top < 0 || top > window.innerHeight) listTop.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    if (searchInput) searchInput.addEventListener('input', applyFilter);

    // Category counts (blog sidebar)
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var slug = el.getAttribute('data-count');
      el.textContent = slug === 'all' ? filterItems.length :
        Array.prototype.filter.call(filterItems, function (item) {
          return categoriesOf(item).indexOf(slug) > -1;
        }).length;
    });
  }

  /* ---------- Formspree forms (newsletter, contact) ---------- */
  var formText = {
    tr: {
      sending: 'Gönderiliyor...',
      success: 'Teşekkürler! Talebin alındı.',
      error: 'Bir sorun oluştu, lütfen tekrar dene.',
      setup: 'Bu form henüz bağlanmadı: Formspree form kimliği eklenmeli.',
    },
    en: {
      sending: 'Sending...',
      success: 'Thank you! Your request has been received.',
      error: 'Something went wrong, please try again.',
      setup: 'This form is not connected yet: a Formspree form ID is required.',
    },
  };

  document.querySelectorAll('form[data-formspree]').forEach(function (form) {
    var status = form.querySelector('[data-form-status]');
    var button = form.querySelector('[type="submit"]');

    var show = function (key, type) {
      if (!status) return;
      status.textContent = formText[root.lang === 'en' ? 'en' : 'tr'][key];
      status.className = 'form-status' + (type ? ' is-' + type : '');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.action.indexOf('YOUR_FORM_ID') > -1) {
        show('setup', 'error');
        return;
      }
      show('sending');
      if (button) button.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.reset();
          show('success', 'success');
        })
        .catch(function () { show('error', 'error'); })
        .then(function () { if (button) button.disabled = false; });
    });
  });

  /* ---------- CV actions (cv.html) ---------- */
  document.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var shareData = { title: document.title, url: window.location.href };
      if (navigator.share) {
        navigator.share(shareData).catch(function () { /* user closed the sheet */ });
        return;
      }
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(shareData.url).then(function () {
        var label = btn.querySelector('[data-i18n]');
        var original = label.innerHTML;
        label.textContent = root.lang === 'en' ? (dict['cv.shared'] || 'Link copied') : 'Bağlantı kopyalandı';
        setTimeout(function () { label.innerHTML = original; }, 2000);
      });
    });
  });

  // Prints the PDF itself (via a hidden iframe); falls back to opening it in a new tab
  document.querySelectorAll('[data-print-pdf]').forEach(function (btn) {
    var frame = null;
    var url = btn.getAttribute('data-print-pdf');

    function printFrame() {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        window.open(url, '_blank', 'noopener');
      }
    }

    btn.addEventListener('click', function () {
      if (frame) {
        printFrame();
        return;
      }
      frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
      frame.addEventListener('load', printFrame);
      frame.src = url;
      document.body.appendChild(frame);
    });
  });

  /* ---------- Contact page helpers (iletisim.html) ---------- */
  document.querySelectorAll('[data-counter]').forEach(function (field) {
    var output = document.getElementById(field.getAttribute('data-counter'));
    var max = field.getAttribute('maxlength');
    var update = function () { output.textContent = field.value.length + ' / ' + max; };
    field.addEventListener('input', update);
    if (field.form) field.form.addEventListener('reset', function () { setTimeout(update, 0); });
    update();
  });

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
        var label = btn.querySelector('[data-i18n]');
        var original = label.innerHTML;
        label.textContent = root.lang === 'en' ? (dict['ct.copied'] || 'Copied') : 'Kopyalandı';
        setTimeout(function () { label.innerHTML = original; }, 2000);
      });
    });
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !reduceMotion) {
    root.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
