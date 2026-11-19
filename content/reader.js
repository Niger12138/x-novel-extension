/* x-小说拓展 · 阅读器主逻辑 */
(function () {
  const XN = window.__XNOVEL__;
  if (!XN || !XN.READER_CSS) return;

  const THEMES = [
    { id: 'paper', name: '纸白', swatch: '#faf7f0' },
    { id: 'sepia', name: '米黄', swatch: '#f4e8d3' },
    { id: 'mint', name: '护眼绿', swatch: '#e4ede1' },
    { id: 'slate', name: '雾蓝', swatch: '#e8edf4' },
    { id: 'night', name: '夜间', swatch: '#15171b' },
    { id: 'oled', name: '纯黑', swatch: '#000000' }
  ];

  const FONTS = {
    serif: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", serif',
    hei: '"PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif',
    kai: '"Kaiti SC", "KaiTi", "STKaiti", "楷体", serif'
  };

  const ICONS = {
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5l7 7-7 7"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5.5c2.5-1 5.5-1 8 1.2 2.5-2.2 5.5-2.2 8-1.2v13c-2.5-1-5.5-1-8 1.2-2.5-2.2-5.5-2.2-8-1.2z"/><path d="M12 6.7v13.2"/></svg>'
  };

  const PAGE_TOAST_CSS = `
:host { all: initial; }
body { margin: 0; }
.t {
  position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%);
  background: #23201b; color: #faf7f0;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 12px; letter-spacing: .04em; line-height: 1.6;
  padding: 9px 16px; border-radius: 999px; max-width: 82vw; text-align: center;
  box-shadow: 0 8px 24px rgba(20,16,10,.26); z-index: 2147483647;
  animation: tin .2s ease both;
}
@keyframes tin { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

  XN.setBadge = function (text) {
    try {
      chrome.runtime.sendMessage({ type: 'XN_BADGE', text: text || '' });
    } catch (e) {
      /* 无后台时忽略 */
    }
  };

  XN.pageToast = function (msg, duration) {
    try {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      const sr = wrap.attachShadow({ mode: 'open' });
      sr.innerHTML = '<style>' + PAGE_TOAST_CSS + '</style><div class="t"></div>';
      const el = sr.querySelector('.t');
      el.textContent = msg;
      document.documentElement.appendChild(wrap);
      setTimeout(() => {
        el.style.transition = 'opacity .2s ease';
        el.style.opacity = '0';
        setTimeout(() => wrap.remove(), 240);
      }, duration || 2400);
    } catch (e) {
      /* ignore */
    }
  };

  XN.hidePill = function () {
    if (XN.__pillTimer) {
      clearTimeout(XN.__pillTimer);
      XN.__pillTimer = null;
    }
    if (XN.__pillHost) {
      try {
        XN.__pillHost.remove();
      } catch (e) {
        /* ignore */
      }
      XN.__pillHost = null;
    }
  };

  XN.pillDismissed = function () {
    // 只在当前标签页会话内记住，刷新/换章不再反复弹；新标签页仍会给出入口。
    try {
      return sessionStorage.getItem('xn_pill_closed:' + location.host) === '1';
    } catch (e) {
      return false;
    }
  };

  XN.dismissPill = function () {
    try {
      sessionStorage.setItem('xn_pill_closed:' + location.host, '1');
    } catch (e) {
      /* ignore */
    }
  };

  XN.showPill = function (opts) {
    opts = opts || {};
    if (XN.__pillHost || XN.reader.active) return false;
    if (!opts.force && XN.pillDismissed()) return false;
    try {
      const host = document.createElement('div');
      host.id = 'xn-pill-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;display:block;';
      const sr = host.attachShadow({ mode: 'open' });
      sr.innerHTML =
        '<style>' + XN.PILL_CSS + '</style>' +
        '<div class="pill" role="button" tabindex="0">' +
        ICONS.book +
        '<span class="t">' + esc(opts.label || '进入纯净阅读') + '</span>' +
        '<span class="close" role="button" aria-label="关闭">×</span>' +
        '</div>';
      const pill = sr.querySelector('.pill');
      const close = sr.querySelector('.close');
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (close.contains(e.target)) return;
        // 进入成功时 enter 内部会收起入口；失败时保留入口，方便再试
        if (XN.reader.enter({ manual: true })) XN.hidePill();
      });
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (XN.reader.enter({ manual: true })) XN.hidePill();
        }
      });
      close.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        XN.dismissPill();
        XN.hidePill();
      });
      document.documentElement.appendChild(host);
      XN.__pillHost = host;
      if (opts.autoHide) {
        XN.__pillTimer = setTimeout(() => XN.hidePill(), Number(opts.autoHide) || 6000);
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  function esc(s) {
    return XN.esc(s);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  const XR = {
    active: false,
    data: null,
    site: null,
    host: null,
    root: null,
    shell: null,
    scrollEl: null,
    bodyEl: null,
    topEl: null,
    footEl: null,
    progressEl: null,
    percentEl: null,
    panelEl: null,
    scrimEl: null,
    panelTitle: null,
    panelBody: null,
    toastEl: null,
    autoNextEl: null,
    loadingEl: null,
    panelMode: '',
    tocItems: [],
    tocFetching: false,
    tocLoadedUrl: '',
    tocSource: '',
    saveTimer: 0,
    hideTimer: 0,
    countdownTimer: 0,
    nextArmed: false,
    prevOverflow: null,
    merging: false,
    mergeToken: 0,

    positionKey: function () {
      // 只算 pathname 会把「?chapter=3」和「?chapter=5」当成同一章；
      // 带上查询参数 / hash / 章节标题，换章后才会从新的一页开头读。
      const title = this.data && this.data.title
        ? String(this.data.title).replace(/\s+/g, '').trim()
        : '';
      return location.host + location.pathname + location.search + location.hash + '|' + title;
    },

    exitFlagKey: function () {
      return typeof XN.exitKey === 'function' ? XN.exitKey() : 'xn_exit:' + location.href;
    },

    getSiteAuto: function () {
      const ov = XN.getSiteOverride(location.hostname);
      if (ov && typeof ov.auto === 'boolean') return ov.auto;
      return !!XN.settings.autoEnter;
    },

    enter: function (opts) {
      opts = opts || {};
      if (this.active) return true;
      const site = XN.getSite(location.hostname);
      let data;
      try {
        data = XN.extractChapter(document, site);
      } catch (e) {
        data = null;
      }
      if (!data || !data.ok || data.textLen < 150) {
        XN.pageToast('这一页没有提取到可读正文');
        return false;
      }

      this.data = data;
      this.site = site;
      try {
        this.build();
      } catch (e) {
        try {
          if (this.host) this.host.remove();
          if (document.body) document.body.style.overflow = this.prevBodyOverflow || '';
          document.documentElement.style.overflow = this.prevHtmlOverflow || '';
        } catch (err) {
          /* ignore */
        }
        this.host = null;
        this.active = false;
        XN.pageToast('阅读器初始化失败，请刷新后重试');
        return false;
      }

      this.active = true;
      XN.hidePill();
      try {
        sessionStorage.removeItem(this.exitFlagKey());
      } catch (e) {
        /* ignore */
      }
      this.attachEvents();
      if (opts.auto) this.toast('已识别为小说 · 纯净阅读模式');
      XN.setBadge('读');

      // 章内分页：先把第一页呈现出来，再异步把后面的页拼接进来
      if (this.shouldMerge()) this.startMerge(false);
      else this.restorePosition();
      return true;
    },

    build: function () {
      const data = this.data;
      const s = XN.settings;

      const oldBody = document.body;
      this.prevBodyOverflow = oldBody ? oldBody.style.overflow : '';
      this.prevHtmlOverflow = document.documentElement.style.overflow;
      if (oldBody) oldBody.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const host = document.createElement('div');
      host.id = 'xn-reader-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483645;display:block;';
      const root = host.attachShadow({ mode: 'open' });

      const meta = this.metaHTML();
      const bodyHTML = this.blocksHTML(data.blocks);
      const endHTML = this.endHTML();

      root.innerHTML =
        '<style>' + XN.READER_CSS + '</style>' +
        '<div class="xr" data-theme="' + esc(s.theme) + '">' +
        '<div class="xr-progress"></div>' +
        '<div class="xr-top">' +
        '<div class="xr-mark">x</div>' +
        '<div class="xr-brand">纯净阅读</div>' +
        '<div class="xr-sep-dot"></div>' +
        '<div class="xr-top-title">' + esc(data.title) + '</div>' +
        '<div class="xr-tools">' +
        '<button class="xr-btn" data-act="toc" title="目录" aria-label="目录">' + ICONS.list + '</button>' +
        '<button class="xr-btn" data-act="theme" title="切换主题" aria-label="切换主题">' + ICONS.theme + '</button>' +
        '<button class="xr-btn" data-act="settings" title="阅读设置" aria-label="阅读设置"><span class="xr-aa">Aa</span></button>' +
        '<button class="xr-btn" data-act="exit" title="退出阅读模式" aria-label="退出阅读模式">' + ICONS.close + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="xr-scroll">' +
        '<div class="xr-main">' +
        '<div class="xr-head">' +
        '<h1 class="xr-title">' + esc(data.title) + '</h1>' +
        '<div class="xr-rule"></div>' +
        '<div class="xr-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="xr-body">' + bodyHTML + '</div>' +
        '<div class="xr-end">' +
        '<div class="xr-end-rule"></div>' +
        '<div class="xr-end-note">' + this.endNote() + '</div>' +
        endHTML +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="xr-foot">' +
        '<button class="xr-nav" data-act="prev" ' + (data.prev ? '' : 'disabled') + '>' + ICONS.prev + '<span>上一章</span></button>' +
        '<div class="xr-foot-mid">' +
        '<button class="xr-nav" data-act="toc">目录</button>' +
        '<span class="xr-percent">0%</span>' +
        '</div>' +
        '<button class="xr-nav" data-act="next" ' + (data.next ? '' : 'disabled') + '><span>下一章</span>' + ICONS.next + '</button>' +
        '</div>' +
        '<div class="xr-scrim" data-act="panel-close"></div>' +
        '<aside class="xr-panel">' +
        '<div class="xr-panel-head">' +
        '<h2 class="xr-panel-title">阅读设置</h2>' +
        '<button class="xr-panel-close" data-act="panel-close">收起</button>' +
        '</div>' +
        '<div class="xr-panel-body"></div>' +
        '<div class="xr-panel-foot">← → 切换章节　↑ ↓ 滚动　Esc 退出<br>设置仅保存在本机，不会上传</div>' +
        '</aside>' +
        '<div class="xr-toast"></div>' +
        '<div class="xr-autonext"><span class="xr-cd">6 秒后进入下一章</span><button data-act="cancel-next">取消</button></div>' +
        '<div class="xr-loading">正在提取正文…</div>' +
        '</div>';

      document.documentElement.appendChild(host);

      this.host = host;
      this.root = root;
      this.shell = root.querySelector('.xr');
      this.scrollEl = root.querySelector('.xr-scroll');
      this.bodyEl = root.querySelector('.xr-body');
      this.topEl = root.querySelector('.xr-top');
      this.footEl = root.querySelector('.xr-foot');
      this.progressEl = root.querySelector('.xr-progress');
      this.percentEl = root.querySelector('.xr-percent');
      this.panelEl = root.querySelector('.xr-panel');
      this.scrimEl = root.querySelector('.xr-scrim');
      this.panelTitle = root.querySelector('.xr-panel-title');
      this.panelBody = root.querySelector('.xr-panel-body');
      this.toastEl = root.querySelector('.xr-toast');
      this.autoNextEl = root.querySelector('.xr-autonext');
      this.loadingEl = root.querySelector('.xr-loading');

      this.applyStyle();
      if (this.loadingEl) this.loadingEl.style.display = 'none';
    },

    metaHTML: function () {
      const d = this.data || {};
      let meta = XN.fmt(d.textLen) + ' 字<i></i>约 ' + XN.readMinutes(d.textLen) + ' 分钟';
      if (this.merging) {
        meta += '<i></i><span class="xr-merged">正在拼接…</span>';
      } else if (Number(d.partCount) > 1) {
        const total = d.partFailed && Number(d.partTotal) > Number(d.partCount) ? '/' + Number(d.partTotal) : '';
        meta += '<i></i><span class="xr-merged">已拼接 ' + Number(d.partCount) + total + ' 页</span>';
      }
      return meta;
    },

    blocksHTML: function (blocks) {
      return (blocks || [])
        .map((b) => {
          if (b.type === 'img') {
            return (
              '<figure><img src="' + esc(b.src) + '" alt="' + esc(b.alt || '') + '" loading="lazy">' +
              (b.alt ? '<figcaption>' + esc(b.alt) + '</figcaption>' : '') +
              '</figure>'
            );
          }
          return '<p>' + esc(b.text) + '</p>';
        })
        .join('');
    },

    endNote: function () {
      const d = this.data || {};
      return d.partFailed ? '本章分页未完整拼接' : '本章完';
    },

    endHTML: function () {
      const d = this.data || {};
      if (!d.next) {
        return d.partFailed
          ? '<span class="xr-end-empty">本章未完整读取，请回到原网页查看缺失分页</span>'
          : '<span class="xr-end-empty">已是最后一章</span>';
      }
      const label = d.partFailed ? '仍要进入下一章' : '继续阅读下一章';
      const title = d.partFailed ? ' title="本章还有分页未拼接完整，点击后需再确认"' : '';
      return '<button class="xr-end-next" data-act="next"' + title + '>' + label + '</button>';
    },

    shouldMerge: function () {
      const d = this.data;
      return !!(
        d && XN.settings.mergeParts && d.part && d.part.active && d.partNext &&
        (!d.chapterNext || d.partNext.split('#')[0] !== d.chapterNext.split('#')[0])
      );
    },

    isCurrentPartUrl: function (href) {
      if (!href) return false;
      try {
        const cur = new URL(location.href);
        const target = new URL(href, location.href);
        if (target.host !== cur.host) return false;
        const c = cur.pathname.replace(/\/+$/, '');
        const p = target.pathname.replace(/\/+$/, '');
        if (p === c) return true;
        if (!p.startsWith(c + '/')) return false;
        return /^\d+$/.test(p.slice(c.length + 1));
      } catch (e) {
        return false;
      }
    },

    /* ---------- 章内分页拼接 ---------- */
    startMerge: function (preserve) {
      if (this.merging || !this.shouldMerge()) return;
      const self = this;
      this.merging = true;
      const token = (this.mergeToken = (this.mergeToken || 0) + 1);
      const info = (this.data && this.data.part) || {};

      // 不遮住第一页：先把当前页给用户看，后面几页在后台拼接
      const metaEl = this.root ? this.root.querySelector('.xr-meta') : null;
      if (metaEl) metaEl.innerHTML = this.metaHTML();
      this.toast('正在拼接本章' + (info.total ? '（1/' + info.total + '）' : '') + '…');

      // 用户已经往下读了，就保留当前位置，只把新页追加到正文末尾
      const keep = !!preserve || (this.scrollEl ? this.scrollEl.scrollTop > 80 : false);

      XN.mergeChapter(this.data, this.site)
        .then(function (res) {
          if (token !== self.mergeToken || !self.active) return;
          self.merging = false;

          if (!res || !res.merged) {
            const m = self.root ? self.root.querySelector('.xr-meta') : null;
            if (res && res.failed) {
              // 一页都没拼进来也要标记不完整：否则底部仍会写“本章完”，
              // 自动连读/下一章还可能直接跳过当前页之后的内容。
              self.data.partFailed = true;
              self.data.partTotal = Number(res.partTotal) || Number(self.data.partTotal) || 0;
              if (res.partNext) self.data.partNext = res.partNext;
              self.updateChrome(false);
            }
            if (m) m.innerHTML = self.metaHTML();
            if (!preserve) self.restorePosition();
            if (res && res.failed) self.toast('后续分页没能拼接，本章按未完整处理');
            return;
          }

          self.applyMerged(res, keep);
          if (!keep) self.restorePosition();
          self.toast(
            '已拼接 ' + res.partCount + ' 页' +
            (res.failed ? '（部分失败）' : '') + ' · ' + XN.fmt(res.textLen) + ' 字'
          );
        })
        .catch(function () {
          if (token !== self.mergeToken || !self.active) return;
          self.merging = false;
          if (self.data) {
            self.data.partFailed = true;
            self.updateChrome(false);
          }
          const m = self.root ? self.root.querySelector('.xr-meta') : null;
          if (m) m.innerHTML = self.metaHTML();
          if (!preserve) self.restorePosition();
          self.toast('分页拼接失败，本章按未完整处理');
        });
    },

    maybeMerge: function (preserve) {
      if (this.active && this.shouldMerge() && !this.merging) this.startMerge(!!preserve);
    },

    applyMerged: function (res, preserve) {
      const oldCount = this.data && this.data.blocks ? this.data.blocks.length : 0;
      const oldRatio = preserve && this.scrollEl
        ? clamp(this.scrollEl.scrollTop / Math.max(1, this.scrollEl.scrollHeight - this.scrollEl.clientHeight), 0, 1)
        : 0;

      this.data = Object.assign({}, this.data, {
        title: res.title || this.data.title,
        blocks: res.blocks || this.data.blocks,
        textLen: res.textLen || this.data.textLen,
        prev: res.prev || this.data.prev,
        next: res.next || '',
        toc: res.toc || this.data.toc,
        partCount: res.partCount || 1,
        partTotal: res.partTotal || 0,
        mergedParts: true,
        partFailed: !!res.failed,
        partNext: res.partNext || '',
        chapterNext: res.chapterNext || ''
      });

      // 用户正在读第一页：只追加新页，避免重排后跳位
      if (preserve && this.bodyEl && oldCount && this.data.blocks.length > oldCount) {
        this.updateChrome(true);
        this.bodyEl.insertAdjacentHTML('beforeend', this.blocksHTML(this.data.blocks.slice(oldCount)));
        this.onScroll();
        return;
      }

      this.updateChrome(false);
      const max = Math.max(1, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
      this.scrollEl.scrollTop = preserve ? Math.round(oldRatio * max) : 0;
      this.onScroll();
    },

    updateChrome: function (keepBody) {
      if (!this.root || !this.data) return;
      const d = this.data;
      const topTitle = this.root.querySelector('.xr-top-title');
      const title = this.root.querySelector('.xr-title');
      const meta = this.root.querySelector('.xr-meta');
      const prev = this.root.querySelector('[data-act="prev"]');
      const next = this.root.querySelector('[data-act="next"]');
      const end = this.root.querySelector('.xr-end');

      if (topTitle) topTitle.textContent = d.title;
      if (title) title.textContent = d.title;
      if (meta) meta.innerHTML = this.metaHTML();
      if (this.bodyEl && !keepBody) this.bodyEl.innerHTML = this.blocksHTML(d.blocks);
      if (prev) prev.disabled = !d.prev;
      if (next) next.disabled = !d.next;
      if (end) {
        end.innerHTML =
          '<div class="xr-end-rule"></div><div class="xr-end-note">' + this.endNote() + '</div>' + this.endHTML();
      }
    },

    applyStyle: function () {
      const s = XN.settings;
      const root = this.shell;
      if (!root) return;
      root.setAttribute('data-theme', s.theme || 'paper');
      root.style.setProperty('--fs', clamp(Number(s.fontSize) || 19, 14, 40) + 'px');
      root.style.setProperty('--lh', clamp(Number(s.lineHeight) || 1.95, 1.3, 2.8));
      root.style.setProperty('--width', clamp(Number(s.pageWidth) || 720, 480, 1200) + 'px');
      root.style.setProperty('--font', FONTS[s.fontFamily] || FONTS.serif);
      if (this.bodyEl) {
        if (s.indent) this.bodyEl.classList.remove('no-indent');
        else this.bodyEl.classList.add('no-indent');
      }
    },

    applySettings: function () {
      this.applyStyle();
      if (this.panelMode === 'settings' && this.panelEl.classList.contains('open')) {
        this.renderSettingsPanel();
      } else if (this.panelMode === 'settings') {
        this.renderSettingsPanel();
      }
    },

    attachEvents: function () {
      const self = this;

      this.root.addEventListener('click', (e) => {
        const el = e.target.closest ? e.target.closest('[data-act],[data-theme-id],[data-fs],[data-font],[data-toc-index]') : null;
        if (!el) return;
        const act = el.getAttribute('data-act');

        if (el.hasAttribute('data-theme-id')) {
          XN.patchSettings({ theme: el.getAttribute('data-theme-id') });
          self.applyStyle();
          self.renderSettingsPanel();
          return;
        }
        if (el.hasAttribute('data-fs')) {
          const dir = Number(el.getAttribute('data-fs'));
          const next = clamp((Number(XN.settings.fontSize) || 19) + dir, 14, 40);
          XN.patchSettings({ fontSize: next });
          self.applyStyle();
          self.renderSettingsPanel();
          return;
        }
        if (el.hasAttribute('data-font')) {
          XN.patchSettings({ fontFamily: el.getAttribute('data-font') });
          self.applyStyle();
          self.renderSettingsPanel();
          return;
        }
        if (el.hasAttribute('data-toc-index')) {
          const i = Number(el.getAttribute('data-toc-index'));
          const item = self.tocItems[i];
          if (item) location.href = item.href;
          return;
        }

        switch (act) {
          case 'exit':
            self.exit();
            break;
          case 'prev':
            self.go('prev');
            break;
          case 'next':
            self.go('next');
            break;
          case 'toc':
            self.openToc();
            break;
          case 'settings':
            self.openSettings();
            break;
          case 'panel-close':
            self.closePanel();
            break;
          case 'theme': {
            const idx = THEMES.findIndex((t) => t.id === XN.settings.theme);
            const next = THEMES[(idx + 1) % THEMES.length];
            XN.patchSettings({ theme: next.id });
            self.applyStyle();
            self.toast('已切换到「' + next.name + '」');
            break;
          }
          case 'cancel-next':
            self.cancelAutoNext();
            break;
          default:
            break;
        }
      });

      this.root.addEventListener('change', (e) => {
        const t = e.target;
        if (!t) return;
        if (t.tagName === 'INPUT' && t.type === 'range') {
          const key = t.getAttribute('data-k');
          const val = Number(t.value);
          if (key === 'lineHeight' || key === 'pageWidth') {
            XN.patchSettings({ [key]: val });
            self.applyStyle();
            self.updateRangeLabel(t, key);
          }
        }
        if (t.tagName === 'INPUT' && t.type === 'checkbox') {
          const key = t.getAttribute('data-k');
          if (key === 'indent' || key === 'autoNext' || key === 'mergeParts') {
            XN.patchSettings({ [key]: !!t.checked });
            self.applyStyle();
            if (key === 'autoNext' && !t.checked) self.cancelAutoNext();
            if (key === 'mergeParts' && t.checked) self.maybeMerge(true);
          }
          if (key === 'siteAuto') {
            XN.siteOverride(location.hostname, { auto: !!t.checked });
          }
        }
      });

      this.root.addEventListener('input', (e) => {
        const t = e.target;
        if (t && t.tagName === 'INPUT' && t.type === 'range') {
          const key = t.getAttribute('data-k');
          if (key === 'lineHeight' || key === 'pageWidth') {
            const val = Number(t.value);
            XN.settings[key] = val;
            self.applyStyle();
            self.updateRangeLabel(t, key);
          }
        }
      });

      this.scrollEl.addEventListener('scroll', () => self.onScroll(), { passive: true });

      // 键盘事件挂在 document 上：Shadow DOM 内的焦点不在 shadow root 上时也能收到
      this.__keyHandler = (e) => self.onKey(e);
      document.addEventListener('keydown', this.__keyHandler, true);

      this.root.addEventListener('mousemove', (e) => {
        const y = e.clientY;
        if (y < 90 || y > window.innerHeight - 100) self.showBars();
      });

      this.scrimEl.addEventListener('click', () => self.closePanel());
    },

    updateRangeLabel: function (input, key) {
      const label = input.closest('.xr-group') && input.closest('.xr-group').querySelector('.xr-label small');
      if (!label) return;
      if (key === 'lineHeight') label.textContent = Number(input.value).toFixed(2);
      else label.textContent = Math.round(Number(input.value)) + 'px';
    },

    onScroll: function () {
      if (!this.scrollEl) return;
      const el = this.scrollEl;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max <= 0 ? 100 : clamp((el.scrollTop / max) * 100, 0, 100);

      if (this.progressEl) this.progressEl.style.width = pct.toFixed(2) + '%';
      if (this.percentEl) this.percentEl.textContent = Math.round(pct) + '%';

      const y = el.scrollTop;
      if (y > (this.lastY || 0) + 30 && y > 140) this.hideBars();
      else if (y < (this.lastY || 0) - 24) this.showBars();
      this.lastY = y;

      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (this.scrollEl && this.scrollEl.scrollTop > 140 && !this.panelEl.classList.contains('open')) {
          this.hideBars();
        }
      }, 3200);

      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.savePosition(), 650);

      if (pct > 92 && !this.nextArmed && this.data && this.data.next && !this.data.partFailed) {
        this.nextArmed = true;
        if (XN.settings.autoNext) this.startAutoNext();
      }
    },

    hideBars: function () {
      if (!this.topEl) return;
      this.topEl.classList.add('is-hidden');
      this.footEl.classList.add('is-hidden');
      if (this.progressEl) this.progressEl.classList.add('top-hidden');
    },

    showBars: function () {
      if (!this.topEl) return;
      this.topEl.classList.remove('is-hidden');
      this.footEl.classList.remove('is-hidden');
      if (this.progressEl) this.progressEl.classList.remove('top-hidden');
      clearTimeout(this.hideTimer);
    },

    onKey: function (e) {
      const path = e.composedPath ? e.composedPath() : [];
      const t = path[0] || e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      if (key === 'Escape') {
        e.preventDefault();
        if (this.panelEl.classList.contains('open')) this.closePanel();
        else this.exit();
        return;
      }
      if (this.panelEl.classList.contains('open')) return;
      if (key === 'ArrowLeft') {
        e.preventDefault();
        this.go('prev');
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        this.go('next');
      } else if (key === 'ArrowDown' || key === 'PageDown' || key === ' ') {
        e.preventDefault();
        this.scrollEl.scrollBy({ top: this.scrollEl.clientHeight * 0.92, behavior: 'auto' });
        this.showBars();
      } else if (key === 'ArrowUp' || key === 'PageUp') {
        e.preventDefault();
        this.scrollEl.scrollBy({ top: -this.scrollEl.clientHeight * 0.92, behavior: 'auto' });
        this.showBars();
      } else if (key === 'Home') {
        e.preventDefault();
        this.scrollEl.scrollTop = 0;
      } else if (key === 'End') {
        e.preventDefault();
        this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
      }
    },

    go: function (dir) {
      if (this.merging) {
        this.toast('正在拼接本章剩余分页…');
        return;
      }
      if (dir === 'next' && this.data && this.data.partFailed && !this.__nextConfirm && !this.__skipPartConfirm) {
        this.__nextConfirm = true;
        this.toast('本章还有分页没拼完整；再点一次仍要进入下一章');
        clearTimeout(this.__nextConfirmTimer);
        this.__nextConfirmTimer = setTimeout(() => {
          this.__nextConfirm = false;
        }, 4000);
        return;
      }
      this.__nextConfirm = false;
      const url = dir === 'prev' ? this.data && this.data.prev : this.data && this.data.next;
      if (!url) {
        if (dir === 'next' && this.data && this.data.toc &&
            (this.data.partFailed || this.data.partNext || (this.data.part && this.data.part.active))) {
          this.resolveNextFromToc();
          return;
        }
        this.toast(dir === 'prev' ? '没有找到上一章' : '没有找到下一章');
        return;
      }
      if (dir === 'next' && this.isCurrentPartUrl(url)) {
        this.resolveNextFromToc();
        return;
      }
      this.savePosition(true);
      location.href = url;
    },

    /* ---------- 面板 ---------- */
    openSettings: function () {
      if (!this.panelEl) return;
      this.panelMode = 'settings';
      this.panelTitle.textContent = '阅读设置';
      this.renderSettingsPanel();
      this.panelEl.classList.add('open');
      this.scrimEl.classList.add('open');
    },

    openToc: function () {
      if (!this.panelEl) return;
      this.panelMode = 'toc';
      this.panelTitle.textContent = '目录';
      this.renderTocPanel();
      this.panelEl.classList.add('open');
      this.scrimEl.classList.add('open');
      // 当前页通常只有“上一章/下一章”，真正的完整目录在 data.toc 指向的目录页。
      // 先显示当前页能拿到的少量链接，再异步补全，避免打开目录时空白等待。
      this.fetchToc();
    },

    closePanel: function () {
      if (!this.panelEl) return;
      this.panelEl.classList.remove('open');
      this.scrimEl.classList.remove('open');
    },

    renderSettingsPanel: function () {
      if (!this.panelBody) return;
      const s = XN.settings;
      const siteAuto = this.getSiteAuto();

      const swatches = THEMES.map((t) =>
        '<button class="xr-swatch' + (s.theme === t.id ? ' on' : '') + '" data-theme-id="' + t.id + '" title="' + t.name + '" aria-label="' + t.name + '">' +
        '<span style="background:' + t.swatch + '"></span></button>'
      ).join('');

      const seg = [['serif', '宋体'], ['hei', '黑体'], ['kai', '楷体']].map((f) =>
        '<button class="' + (s.fontFamily === f[0] ? 'on' : '') + '" data-font="' + f[0] + '">' + f[1] + '</button>'
      ).join('');

      this.panelBody.innerHTML =
        '<div class="xr-group">' +
        '<div class="xr-label">阅读主题</div>' +
        '<div class="xr-swatches">' + swatches + '</div>' +
        '</div>' +
        '<div class="xr-group">' +
        '<div class="xr-label">字号 <small>' + Number(s.fontSize) + ' px</small></div>' +
        '<div class="xr-stepper">' +
        '<button class="xr-step" data-fs="-1" aria-label="减小字号">A−</button>' +
        '<span class="xr-step-val">' + Number(s.fontSize) + '</span>' +
        '<button class="xr-step" data-fs="1" aria-label="增大字号">A＋</button>' +
        '</div>' +
        '</div>' +
        '<div class="xr-group">' +
        '<div class="xr-label">行距 <small>' + Number(s.lineHeight).toFixed(2) + '</small></div>' +
        '<input class="xr-range" type="range" min="1.5" max="2.6" step="0.05" value="' + Number(s.lineHeight) + '" data-k="lineHeight" aria-label="行距">' +
        '</div>' +
        '<div class="xr-group">' +
        '<div class="xr-label">版心宽度 <small>' + Number(s.pageWidth) + ' px</small></div>' +
        '<input class="xr-range" type="range" min="560" max="1000" step="20" value="' + Number(s.pageWidth) + '" data-k="pageWidth" aria-label="版心宽度">' +
        '</div>' +
        '<div class="xr-group">' +
        '<div class="xr-label">正文字体</div>' +
        '<div class="xr-seg">' + seg + '</div>' +
        '</div>' +
        '<div class="xr-group">' +
        '<div class="xr-toggle-row"><span class="tx">首行缩进</span>' +
        '<label class="xr-switch"><input type="checkbox" data-k="indent"' + (s.indent ? ' checked' : '') + '><span class="track"></span><span class="knob"></span></label>' +
        '</div>' +
        '<div class="xr-toggle-row"><span class="tx">自动连读<small>读到底部自动进入下一章</small></span>' +
        '<label class="xr-switch"><input type="checkbox" data-k="autoNext"' + (s.autoNext ? ' checked' : '') + '><span class="track"></span><span class="knob"></span></label>' +
        '</div>' +
        '<div class="xr-toggle-row"><span class="tx">拼接分页章节<small>本章被拆成 1/3、2/3 时自动接起来</small></span>' +
        '<label class="xr-switch"><input type="checkbox" data-k="mergeParts"' + (s.mergeParts ? ' checked' : '') + '><span class="track"></span><span class="knob"></span></label>' +
        '</div>' +
        '<div class="xr-toggle-row"><span class="tx">本站自动进入<small>' + esc(location.hostname) + '</small></span>' +
        '<label class="xr-switch"><input type="checkbox" data-k="siteAuto"' + (siteAuto ? ' checked' : '') + '><span class="track"></span><span class="knob"></span></label>' +
        '</div>' +
        '</div>' +
        '<div class="xr-group">' +
        '<button class="xr-link" data-act="toc">章节目录<small>查看本页可用的章节链接</small></button>' +
        '<button class="xr-link" data-act="exit">退出阅读模式<small>回到原网页</small></button>' +
        '</div>';

      // 点击“章节目录”复用 toc
      const tocLink = this.panelBody.querySelector('[data-act="toc"]');
      if (tocLink) {
        tocLink.addEventListener('click', () => this.openToc());
      }
    },

    renderTocPanel: function () {
      if (!this.panelBody) return;
      this.tocItems = this.collectToc(document, location.href, false, true);
      this.tocSource = this.tocItems.length ? 'current' : '';
      if (!this.tocItems.length) {
        this.panelBody.innerHTML =
          '<div class="xr-toc-empty">' + (this.data && this.data.toc
            ? '当前页面没有可用的章节链接。<br>正在尝试读取原站目录…'
            : '当前页面没有可用的章节链接。<br>可以直接打开原站目录继续找书。') + '</div>' +
          '<div class="xr-group">' +
          (this.data && this.data.toc
            ? '<button class="xr-link" data-act="goto-toc">打开原站目录<small>' + esc(this.data.toc) + '</small></button>'
            : '<button class="xr-link" data-act="exit">返回原网页<small>在网页内使用站点目录</small></button>') +
          '<button class="xr-link" data-act="exit">退出阅读模式<small>回到原网页</small></button>' +
          '</div>';
        this.bindTocLinks();
        return;
      }
      this.renderTocList();
    },

    renderTocList: function () {
      if (!this.panelBody) return;
      const cur = location.href.split('#')[0];
      const list = this.tocItems.map((it, i) => {
        const isCur = it.href.split('#')[0] === cur;
        return '<button class="xr-toc-item' + (isCur ? ' current' : '') + '" data-toc-index="' + i + '" title="' + esc(it.title) + '">' + esc(it.title) + '</button>';
      }).join('');
      const sourceLabel = this.tocSource === 'catalog'
        ? '原站目录 · ' + this.tocItems.length + ' 章'
        : '当前页可用章节 · ' + this.tocItems.length + ' 条';
      this.panelBody.innerHTML =
        '<div class="xr-toc-meta">' + esc(sourceLabel) + '</div>' +
        '<div class="xr-toc-list">' + list + '</div>' +
        (this.data && this.data.toc
          ? '<div class="xr-group"><button class="xr-link" data-act="goto-toc">打开原站完整目录</button></div>'
          : '');
      this.bindTocLinks();

      // 几百章的目录里，当前章往往在首屏之外。打开目录时把它滚到
      // 面板中间，用户一眼能看到“我在哪”，不用自己翻找。
      const listEl = this.panelBody.querySelector('.xr-toc-list');
      const curEl = listEl ? listEl.querySelector('.xr-toc-item.current') : null;
      if (this.panelBody && curEl) {
        // 滚动容器是 .xr-panel-body，不是列表本身；按面板高度把当前章居中。
        const itemTop = curEl.getBoundingClientRect().top - this.panelBody.getBoundingClientRect().top + this.panelBody.scrollTop;
        this.panelBody.scrollTop = Math.max(0, itemTop - (this.panelBody.clientHeight - curEl.offsetHeight) / 2);
      }
    },

    bindTocLinks: function () {
      const gt = this.panelBody ? this.panelBody.querySelector('[data-act="goto-toc"]') : null;
      if (gt) gt.addEventListener('click', () => { location.href = this.data.toc; });
    },

    normalizeTocHref: function (href) {
      try {
        const u = new URL(href, location.href);
        return u.origin + u.pathname.replace(/\/+$/, '');
      } catch (e) {
        return '';
      }
    },

    loadTocItems: function () {
      const url = this.data && this.data.toc;
      if (!url) return Promise.reject(new Error('NO_TOC'));
      if (this.tocLoadedUrl === url && this.tocLoadedItems && this.tocLoadedItems.length) {
        return Promise.resolve(this.tocLoadedItems);
      }
      if (this.tocLoading && this.tocLoading.url === url) return this.tocLoading.promise;

      const promise = XN.fetchChapterPage(url).then(async (doc) => {
        const pages = this.collectCatalogPages(doc, url);
        const extraPages = pages.slice(1, 12);
        let items = this.collectToc(this.catalogRoot(doc), url, true);
        if (extraPages.length) {
          const docs = await Promise.all(extraPages.map((pageUrl) =>
            XN.fetchChapterPage(pageUrl).catch(() => null)
          ));
          docs.forEach((pageDoc, i) => {
            if (!pageDoc) return;
            items = items.concat(this.collectToc(this.catalogRoot(pageDoc), extraPages[i], true));
          });
        }

        // 多页目录可能把同一章放在“最新章节”和“章节目录”两个区域，
        // 逐页抓取后统一按 href 去重，保持目录页顺序。
        const seen = new Set();
        items = items.filter((it) => {
          if (!it || !it.href || seen.has(it.href)) return false;
          seen.add(it.href);
          return true;
        }).slice(0, 600);

        this.tocLoadedUrl = url;
        this.tocLoadedItems = items;
        return items;
      });
      this.tocLoading = { url: url, promise: promise };
      return promise;
    },

    fetchToc: function () {
      const url = this.data && this.data.toc;
      if (!url || this.tocFetching || (this.tocLoadedUrl === url && this.tocSource === 'catalog')) return;
      this.tocFetching = true;
      this.loadTocItems().then((items) => {
        this.tocFetching = false;
        if (!items.length) {
          this.toast('目录页没有解析到章节，保留当前页可用的链接');
          return;
        }
        if (this.panelMode !== 'toc') return;
        if (items.length >= this.tocItems.length || this.tocSource !== 'catalog') {
          this.tocItems = items;
          this.tocSource = 'catalog';
          this.renderTocList();
          this.toast('已读取原站目录 · ' + items.length + ' 章');
        }
      }).catch(() => {
        this.tocFetching = false;
        this.toast('完整目录读取失败，已保留当前页可用的章节链接');
      });
    },

    // 分页拼接失败、或“下一章”仍指向本章分页时，从原站目录里找真正的下一章。
    resolveNextFromToc: function () {
      if (this.tocResolving) return;
      const tocUrl = this.data && this.data.toc;
      if (!tocUrl) {
        this.toast('没有目录入口，无法定位下一章');
        return;
      }
      const self = this;
      this.tocResolving = true;
      this.toast('正在从目录查找下一章…');
      this.loadTocItems().then((items) => {
        self.tocResolving = false;
        const cur = self.normalizeTocHref(location.href);
        let idx = items.findIndex((it) => self.normalizeTocHref(it.href) === cur);
        if (idx < 0 && self.data && self.data.title) {
          idx = items.findIndex((it) => it && it.title && it.title.indexOf(self.data.title) >= 0);
        }
        if (idx < 0) {
          self.toast('目录里没有匹配到当前章节');
          return;
        }
        const next = items[idx + 1];
        if (!next || !next.href) {
          self.toast('已经是目录里的最后一章');
          return;
        }
        if (self.normalizeTocHref(next.href) === cur) {
          self.toast('目录没有给出下一章');
          return;
        }
        self.data.next = next.href;
        self.data.chapterNext = next.href;
        self.__skipPartConfirm = true;
        self.updateChrome(false);
        self.go('next');
        self.__skipPartConfirm = false;
      }).catch(() => {
        self.tocResolving = false;
        self.toast('目录读取失败，暂时无法定位下一章');
      });
    },

    catalogRoot: function (doc) {
      // bqge 一类目录页在同一个 #list 里先放“最新九章”，再放“章节目录”。
      // 直接扫全页会先抓到最新章，目录顺序就乱了；优先取标题含“章节目录 / 全部章节”的 dd 分组。
      const dls = doc.querySelectorAll('#list dl, .list dl, dl');
      let bestNodes = null;
      let bestScore = -1;
      for (const dl of dls) {
        let title = '';
        const groups = new Map();
        for (const child of dl.children) {
          if (child.tagName === 'DT') {
            title = XN.cleanText(child.textContent);
          } else if (child.tagName === 'DD' && title) {
            if (!groups.has(title)) groups.set(title, []);
            groups.get(title).push(child);
          }
        }
        for (const [groupTitle, nodes] of groups) {
          let chapterCount = 0;
          for (const node of nodes) {
            const a = node.querySelector('a[href]');
            if (a && XN.CHAPTER_RX.test(XN.cleanText(a.textContent))) chapterCount += 1;
          }
          let score = chapterCount;
          if (/章节目录|全部章节|正文目录|作品目录/.test(groupTitle)) score += 1000;
          if (/最新|推荐|书友/.test(groupTitle)) score -= 1000;
          if (score > bestScore) {
            bestScore = score;
            bestNodes = nodes;
          }
        }
      }
      return bestNodes && bestNodes.length ? bestNodes : doc;
    },

    collectCatalogPages: function (doc, base) {
      const out = [];
      const seen = new Set();
      const add = function (raw) {
        if (!raw) return;
        let href = '';
        try {
          href = new URL(raw, base).href;
        } catch (e) {
          href = '';
        }
        if (!href || !/^https?:/i.test(href)) return;
        let host = '';
        try { host = new URL(href).host; } catch (e) { host = ''; }
        if (host !== location.host) return;
        if (seen.has(href)) return;
        seen.add(href);
        out.push(href);
      };

      // bqge: <div class="toc-pager"><select><option value="/book/x/2/">第101-200章</option>...
      const pager = doc.querySelector('.toc-pager, .pagination, .page');
      if (pager) {
        const select = pager.querySelector('select');
        if (select) {
          for (const opt of select.querySelectorAll('option')) add(opt.getAttribute('value'));
        }
        for (const a of pager.querySelectorAll('a[href]')) {
          const t = XN.cleanText(a.textContent);
          if (/下一页|下页|末页|第\s*\d+\s*页/.test(t)) add(a.getAttribute('href'));
        }
      }
      if (!out.length) add(base);
      return out;
    },

    collectToc: function (root, base, loose, onlySameBook) {
      const roots = Array.isArray(root) ? root : (root ? [root] : []);
      const cur = location.href.split('#')[0];
      const seen = new Set();
      const out = [];

      // 当前章节页的侧栏里经常混着别的书的推荐章节。只保留与
      // “上一章 / 下一章 / 目录”同一本书路径下的链接，避免目录一打开
      // 就是一堆不相干的章节。
      const bookKey = function (href) {
        try {
          const u = new URL(href, location.href);
          const parts = u.pathname.split('/').filter(Boolean);
          const depth = u.pathname.endsWith('/') ? parts.length : Math.max(0, parts.length - 1);
          const path = '/' + parts.slice(0, depth).join('/');
          const bookId = u.searchParams.get('book') || u.searchParams.get('bid') || u.searchParams.get('bookid') || '';
          return path + (bookId ? '?book=' + bookId : '');
        } catch (e) {
          return '';
        }
      };
      const seedKeys = new Set();
      if (onlySameBook && this.data) {
        [this.data.prev, this.data.next, this.data.toc].forEach((u) => {
          if (u) seedKeys.add(bookKey(u));
        });
      }

      for (const r of roots) {
        if (!r || !r.querySelectorAll) continue;
        for (const a of r.querySelectorAll('a[href]')) {
          if (out.length >= 600) break;
          const t = XN.cleanText(a.textContent);
          if (!t || t.length > 60) continue;
          const chapterText = XN.CHAPTER_RX.test(t);
          const looseText = !!loose && (
            /^[0-9０-９一二三四五六七八九十百千万两]{1,8}\s*[、.．:：\-—]/.test(t) ||
            /^[0-9０-９]{1,4}$/.test(t)
          );
          if (!chapterText && !looseText) continue;

          let href = '';
          try {
            href = new URL(a.getAttribute('href'), base || location.href).href;
          } catch (e) {
            href = '';
          }
          if (!href || !/^https?:/i.test(href)) continue;
          if (seedKeys.size && !seedKeys.has(bookKey(href))) continue;
          if (!loose && href.split('#')[0] === cur) continue;
          if (seen.has(href)) continue;
          seen.add(href);
          out.push({ title: t, href: href });
        }
      }
      return out;
    },

    /* ---------- 阅读进度 ---------- */
    restorePosition: function () {
      const self = this;
      if (!this.scrollEl) return;
      const finish = (item) => {
        const el = self.scrollEl;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (item && item.ratio > 0.02 && max > 0) {
          el.scrollTop = Math.round(max * Math.min(item.ratio, 0.96));
        }
        if (self.loadingEl) self.loadingEl.style.display = 'none';
        if (item && item.ratio > 0.03 && item.ratio < 0.94) {
          self.toast('已回到上次阅读位置 · ' + Math.round(item.ratio * 100) + '%');
        }
      };

      if (!this.scrollEl) return;
      try {
        chrome.storage.local.get(['xn_positions'], (res) => {
          const map = (res && res.xn_positions) || {};
          let item = map[self.positionKey()] || null;
          // 标题不一致时不要恢复：兜住同地址换章的 SPA 站点
          if (item && item.title && self.data && self.data.title) {
            const a = String(item.title).replace(/\s+/g, '');
            const b = String(self.data.title).replace(/\s+/g, '');
            if (a !== b) item = null;
          }
          finish(item);
        });
      } catch (e) {
        finish(null);
      }
      // 双保险：布局完成后再校正一次
      setTimeout(() => {
        if (!self.scrollEl) return;
      }, 0);
    },

    savePosition: function (immediate) {
      if (!this.scrollEl || !this.data) return;
      const el = this.scrollEl;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const ratio = clamp(el.scrollTop / max, 0, 1);
      const key = this.positionKey();
      const entry = {
        ratio: ratio,
        title: this.data.title,
        url: location.href,
        ts: Date.now()
      };

      try {
        chrome.storage.local.get(['xn_positions'], (res) => {
          const map = (res && res.xn_positions) || {};
          map[key] = entry;
          const keys = Object.keys(map).sort((a, b) => (map[b].ts || 0) - (map[a].ts || 0)).slice(0, 80);
          const pruned = {};
          keys.forEach((k) => {
            pruned[k] = map[k];
          });
          chrome.storage.local.set({ xn_positions: pruned });
        });
      } catch (e) {
        /* ignore */
      }
    },

    /* ---------- 自动连读 ---------- */
    startAutoNext: function () {
      if (!this.data || !this.data.next || this.data.partFailed || this.merging || this.countdownTimer) return;
      let left = 6;
      const label = this.autoNextEl ? this.autoNextEl.querySelector('.xr-cd') : null;
      if (!this.autoNextEl) return;
      this.autoNextEl.classList.add('show');
      if (label) label.textContent = left + ' 秒后进入下一章';
      this.countdownTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = 0;
          this.savePosition(true);
          location.href = this.data.next;
          return;
        }
        if (label) label.textContent = left + ' 秒后进入下一章';
      }, 1000);
    },

    cancelAutoNext: function () {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = 0;
      }
      if (this.autoNextEl) this.autoNextEl.classList.remove('show');
      this.toast('已取消自动跳转');
    },

    /* ---------- 提示 / 退出 ---------- */
    toast: function (msg) {
      if (!this.toastEl) {
        XN.pageToast(msg);
        return;
      }
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      clearTimeout(this.__toastTimer);
      this.__toastTimer = setTimeout(() => {
        if (this.toastEl) this.toastEl.classList.remove('show');
      }, 2400);
    },

    exit: function (opts) {
      if (!this.active && !this.host) return;
      opts = opts || {};
      const offerReturn = opts.offerReturn !== false;
      try {
        this.savePosition(true);
      } catch (e) {
        /* ignore */
      }
      try {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        if (this.__keyHandler) document.removeEventListener('keydown', this.__keyHandler, true);
        this.__keyHandler = null;
        if (this.host) this.host.remove();
        if (document.body) document.body.style.overflow = this.prevBodyOverflow || '';
        document.documentElement.style.overflow = this.prevHtmlOverflow || '';
      } catch (e) {
        /* ignore */
      }
      try {
        sessionStorage.setItem(this.exitFlagKey(), '1');
      } catch (e) {
        /* ignore */
      }
      this.active = false;
      this.host = null;
      this.root = null;
      this.data = null;
      this.countdownTimer = 0;
      this.nextArmed = false;
      this.merging = false;
      this.mergeToken = (this.mergeToken || 0) + 1;
      XN.setBadge('');

      // 退出后给一个短暂、不打扰的“继续”入口；
      // 自动进入仍由 xn_exit 标记拦住，不会自己弹回阅读器。
      if (offerReturn && XN.settings.enabled && XN.settings.showPill) {
        setTimeout(() => {
          if (!XN.reader.active) {
            XN.showPill({ label: '继续纯净阅读', autoHide: 6000 });
          }
        }, 260);
      }
    },

    toggle: function () {
      if (this.active) this.exit();
      else this.enter({ manual: true });
    },

    getStatus: function () {
      return {
        active: !!this.active,
        title: this.data ? this.data.title : '',
        textLen: this.data ? this.data.textLen : 0,
        score: XN.status ? XN.status.score : 0,
        source: XN.status ? XN.status.source : '',
        prev: this.data ? !!this.data.prev : false,
        next: this.data ? !!this.data.next : false,
        partCount: this.data ? Number(this.data.partCount) || 1 : 1,
        partTotal: this.data ? Number(this.data.partTotal) || 0 : 0,
        partFailed: !!(this.data && this.data.partFailed),
        merged: !!(this.data && this.data.mergedParts),
        merging: !!this.merging
      };
    }
  };

  XN.reader = XR;
})();
