/* x-小说拓展 · 公共核心：配置、存储、文本工具 */
(function () {
  const XN = (window.__XNOVEL__ = window.__XNOVEL__ || {});
  XN.VERSION = '1.1.7';

  XN.DEFAULTS = {
    enabled: true,
    autoEnter: true,
    autoThreshold: 55,
    settingsVersion: 2,
    mergeParts: true,
    purify: true,
    theme: 'paper',
    fontSize: 19,
    lineHeight: 1.95,
    pageWidth: 720,
    fontFamily: 'serif',
    indent: true,
    autoNext: false,
    showPill: true,
    siteOverrides: {}
  };

  XN.settings = Object.assign({}, XN.DEFAULTS);

  /* ---------- 存储 ---------- */
  XN.loadSettings = function () {
    return new Promise((resolve) => {
      let done = false;
      const finish = (res) => {
        if (done) return;
        done = true;
        try {
          if (res && res.xn_settings && typeof res.xn_settings === 'object') {
            const saved = res.xn_settings;
            Object.keys(XN.DEFAULTS).forEach((k) => {
              if (saved[k] !== undefined) XN.settings[k] = saved[k];
            });
            if (saved.siteOverrides && typeof saved.siteOverrides === 'object') {
              XN.settings.siteOverrides = saved.siteOverrides;
            }
            // 老版本默认阈值是 62：升级后自动放宽到 55，用户没改过才迁移
            if (Number(saved.settingsVersion || 1) < 2) {
              if (Number(XN.settings.autoThreshold) === 62) XN.settings.autoThreshold = 55;
              XN.settings.settingsVersion = 2;
              try {
                if (typeof XN.persist === 'function') XN.persist();
              } catch (e) {
                /* ignore */
              }
            }
          }
        } catch (e) {
          /* 配置损坏时回退默认值 */
        }
        resolve(XN.settings);
      };
      try {
        const ret = chrome.storage.local.get(['xn_settings'], finish);
        if (ret && typeof ret.then === 'function') {
          ret.then(finish).catch(() => finish(null));
        }
      } catch (e) {
        finish(null);
      }
      setTimeout(() => finish(null), 800);
    });
  };

  XN.persist = function () {
    const data = {};
    Object.keys(XN.DEFAULTS).forEach((k) => {
      data[k] = XN.settings[k];
    });
    try {
      chrome.storage.local.set({ xn_settings: data });
    } catch (e) {
      /* 无存储权限时忽略 */
    }
  };

  XN.patchSettings = function (patch) {
    Object.keys(patch || {}).forEach((k) => {
      if (k in XN.DEFAULTS) XN.settings[k] = patch[k];
      else if (k === 'siteOverrides') XN.settings.siteOverrides = patch[k] || {};
    });
    XN.persist();
  };

  XN.siteOverride = function (host, patch) {
    const map = Object.assign({}, XN.settings.siteOverrides);
    map[host] = Object.assign({}, map[host], patch);
    XN.settings.siteOverrides = map;
    XN.persist();
    return map[host];
  };

  XN.getSiteOverride = function (host) {
    const map = XN.settings.siteOverrides || {};
    return map[host] || null;
  };

  /* ---------- 文本工具 ---------- */
  XN.cleanText = function (s) {
    if (!s) return '';
    return String(s)
      .replace(/[\u00a0\u3000\u200b-\u200f\ufeff]/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  XN.textLength = function (s) {
    if (!s) return 0;
    return String(s).replace(/\s/g, '').length;
  };

  XN.isCjk = function (ch) {
    return /[\u3400-\u9fff]/.test(ch);
  };

  XN.junkLine = function (line) {
    const t = XN.cleanText(line);
    if (!t) return true;
    if (t.length <= 2) return false;
    const JUNK = [
      /^(上一[章页节回]|下一[章页节回]|上一页|下一页|目录|章节目录|返回目录|返回书页|加入书架|投推荐票|投月票|章节报错|举报|手机阅读)$/,
      /本章未完|点击下一页|继续阅读|请收藏|收藏本站|请记住|记住本站|一秒记住|天才一秒|最快更新|无弹窗|全文阅读|手机用户请|百度搜索|搜索更多|下载.{0,6}APP|打开APP|APP内阅读|扫码|公众号|求收藏|求月票|求推荐|本站域名|笔趣阁|新笔趣阁|www\.|http[s]?:\/\/|最新章节|章节列表/i
    ];
    if (t.length < 120 && JUNK.some((rx) => rx.test(t))) return true;
    return false;
  };

  XN.absUrl = function (href) {
    if (!href) return '';
    try {
      return new URL(href, location.href).href;
    } catch (e) {
      return '';
    }
  };

  // 退出标记带上标题：同一地址的 SPA 换章后，标题变了就允许重新自动进入
  XN.exitKey = function () {
    return 'xn_exit:' + location.href + '|' + String(document.title || '').slice(0, 60);
  };

  XN.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  XN.debounce = function (fn, wait) {
    let timer = 0;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  };

  XN.throttle = function (fn, wait) {
    let last = 0;
    let timer = 0;
    return function () {
      const now = Date.now();
      const args = arguments;
      if (now - last >= wait) {
        last = now;
        fn.apply(null, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = 0;
          last = Date.now();
          fn.apply(null, args);
        }, wait - (now - last));
      }
    };
  };

  XN.fmt = function (n) {
    const v = Number(n) || 0;
    return v >= 10000 ? (v / 10000).toFixed(1) + ' 万' : String(Math.round(v));
  };

  XN.readMinutes = function (chars) {
    return Math.max(1, Math.round((Number(chars) || 0) / 500));
  };

  XN.sleep = function (ms) {
    return new Promise((r) => setTimeout(r, ms));
  };

  XN.log = function () {
    // 统一日志出口，便于排查；不影响页面。
    if (!XN.debug) return;
    try {
      console.log.apply(console, ['[x-novel]'].concat([].slice.call(arguments)));
    } catch (e) {
      /* ignore */
    }
  };
})();
