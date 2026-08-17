(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var menuButton = document.getElementById('menu-button');
  var sidebarOverlay = document.getElementById('sidebar-overlay');
  var themeButton = document.getElementById('theme-button');
  var progressBar = document.getElementById('reading-progress-bar');
  var article = document.querySelector('[data-doc-content]');
  var toc = document.getElementById('page-toc');
  var dialog = document.getElementById('search-dialog');
  var searchButton = document.getElementById('search-button');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');

  function setMenu(open) {
    body.classList.toggle('sidebar-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  }

  var topbarInner = document.querySelector('.topbar-inner');
  function updateTopbar() {
    if (topbarInner) topbarInner.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  document.addEventListener('scroll', updateTopbar, { passive: true });
  updateTopbar();

  menuButton.addEventListener('click', function () {
    setMenu(!body.classList.contains('sidebar-open'));
  });
  sidebarOverlay.addEventListener('click', function () { setMenu(false); });

  themeButton.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('dsh-docs-theme', next);
  });

  function updateProgress() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, progress)) + ')';
  }
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  var headings = article ? Array.prototype.slice.call(article.querySelectorAll('h2, h3')) : [];
  var tocLinks = [];

  headings.forEach(function (heading) {
    if (!heading.id) return;
    var headingText = heading.textContent.trim();
    var anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = '#' + heading.id;
    anchor.setAttribute('aria-label', '打开本节链接');
    anchor.textContent = '#';
    heading.appendChild(anchor);

    var link = document.createElement('a');
    link.href = '#' + heading.id;
    link.className = heading.tagName === 'H3' ? 'toc-link toc-link-sub' : 'toc-link';
    link.textContent = headingText;
    toc.appendChild(link);
    tocLinks.push(link);
  });

  if (headings.length === 0) document.querySelector('.toc-panel').classList.add('is-empty');

  if ('IntersectionObserver' in window && headings.length) {
    var visible = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
        else visible.delete(entry.target.id);
      });
      var active = Array.from(visible.entries()).sort(function (a, b) { return a[1] - b[1]; })[0];
      if (!active) return;
      tocLinks.forEach(function (link) { link.classList.toggle('is-active', link.hash === '#' + active[0]); });
    }, { rootMargin: '-96px 0px -70% 0px' });
    headings.forEach(function (heading) { observer.observe(heading); });
  }

  if (article) {
    article.querySelectorAll('pre').forEach(function (pre) {
      var button = document.createElement('button');
      button.className = 'copy-code';
      button.type = 'button';
      button.textContent = '复制';
      button.addEventListener('click', function () {
        navigator.clipboard.writeText(pre.textContent.replace(/复制$|已复制$/, '')).then(function () {
          button.textContent = '已复制';
          window.setTimeout(function () { button.textContent = '复制'; }, 1400);
        });
      });
      pre.appendChild(button);
    });
  }

  var searchItems = [];
  document.querySelectorAll('.docs-nav a').forEach(function (link) {
    searchItems.push({ label: link.textContent.replace(/\s+/g, ' ').trim(), href: link.href, type: '页面' });
  });
  headings.forEach(function (heading) {
    searchItems.push({ label: heading.textContent.replace(/#$/, '').trim(), href: '#' + heading.id, type: '当前页' });
  });

  // 全局索引正文页的章节标题：其他页面打开搜索时按需拉取一次，之后复用。
  var primaryLink = document.querySelector('.nav-link-primary');
  var deepDiveBase = primaryLink ? primaryLink.href.split('#')[0] : null;
  var deepDiveSections = [];
  var deepDiveLoaded = false;

  function onDeepDivePage() {
    if (!deepDiveBase) return true;
    return location.href.split('#')[0].replace(/\/$/, '') === deepDiveBase.replace(/\/$/, '');
  }

  function loadDeepDiveSections(callback) {
    if (!deepDiveBase || onDeepDivePage() || deepDiveLoaded) { callback(); return; }
    fetch(deepDiveBase, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) { deepDiveLoaded = true; callback(); return; }
      return response.text().then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var found = doc.querySelectorAll('[data-doc-content] h2, [data-doc-content] h3');
        deepDiveSections = Array.prototype.slice.call(found).filter(function (heading) {
          return heading.id;
        }).map(function (heading) {
          return {
            label: heading.textContent.replace(/#$/, '').trim(),
            href: deepDiveBase + '#' + heading.id,
            type: '正文'
          };
        });
        deepDiveLoaded = true;
        callback();
      });
    }).catch(function () { deepDiveLoaded = true; callback(); });
  }

  function renderResults(query) {
    var needle = query.trim().toLowerCase();
    var pool = searchItems.concat(deepDiveSections);
    var matches = pool.filter(function (item) {
      return !needle || item.label.toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 10);
    searchResults.innerHTML = '';
    matches.forEach(function (item, index) {
      var link = document.createElement('a');
      link.href = item.href;
      link.className = 'search-result' + (index === 0 ? ' is-selected' : '');
      var label = document.createElement('span');
      label.textContent = item.label;
      var type = document.createElement('small');
      type.textContent = item.type;
      link.appendChild(label);
      link.appendChild(type);
      searchResults.appendChild(link);
    });
    if (!matches.length) {
      var empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = '没有匹配的页面或章节';
      searchResults.appendChild(empty);
    }
  }

  function openSearch() {
    renderResults('');
    dialog.showModal();
    window.setTimeout(function () { searchInput.focus(); }, 0);
    loadDeepDiveSections(function () { renderResults(searchInput.value); });
  }

  searchButton.addEventListener('click', openSearch);
  searchInput.addEventListener('input', function () {
    loadDeepDiveSections(function () { renderResults(searchInput.value); });
  });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  searchResults.addEventListener('click', function () { dialog.close(); });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? dialog.close() : openSearch();
    }
    if (!dialog.open || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    var results = Array.prototype.slice.call(searchResults.querySelectorAll('.search-result'));
    if (!results.length) return;
    var current = results.findIndex(function (item) { return item.classList.contains('is-selected'); });
    if (event.key === 'Enter') {
      results[Math.max(0, current)].click();
      return;
    }
    event.preventDefault();
    results[current].classList.remove('is-selected');
    current = event.key === 'ArrowDown' ? (current + 1) % results.length : (current - 1 + results.length) % results.length;
    results[current].classList.add('is-selected');
    results[current].scrollIntoView({ block: 'nearest' });
  });
}());
