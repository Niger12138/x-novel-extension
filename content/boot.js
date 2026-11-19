/* x-小说拓展 · 页面调度：识别 → 净化 → 自动进入 / 悬浮入口 */
(function () {
  const XN = window.__XNOVEL__;
  if (!XN) return;

  let started = false;
  let autoScheduled = false;
  let autoDone = false;
  let pillDone = false;
  let lastSig = '';

  function siteAutoFor() {
    const ov = XN.getSiteOverride(location.hostname);
    if (ov && typeof ov.auto === 'boolean') return ov.auto;
    return !!XN.settings.autoEnter;
  }

  function userExited() {
    try {
      const key = typeof XN.exitKey === 'function' ? XN.exitKey() : 'xn_exit:' + location.href;
      return sessionStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function pageSignature() {
    let len = 0;
    try {
      const node = XN.status && XN.status.content && XN.status.content.node;
      if (node) len = (node.textContent || '').length;
    } catch (e) {
      len = 0;
    }
    const h1 = document.querySelector('h1');
    return (
      location.href + '|' +
      String(document.title || '').slice(0, 80) + '|' +
      (h1 ? String(h1.textContent || '').slice(0, 60) : '') + '|' +
      Math.floor(len / 200)
    );
  }

  function summarize() {
    return {
      score: XN.status ? XN.status.score : 0,
      label: XN.status ? XN.status.label : '未识别',
      reasons: XN.status ? XN.status.reasons : [],
      threshold: XN.status ? XN.status.threshold : 55,
      autoEligible: XN.status ? XN.status.autoEligible : false,
      textLen: XN.status ? XN.status.textLen : 0,
      blockCount: XN.status ? XN.status.blockCount : 0,
      source: XN.status ? XN.status.source : '',
      part: XN.status ? XN.status.part : null,
      pageTitle: XN.status ? XN.status.pageTitle : document.title
    };
  }

  function purifyEligible(det) {
    // 普通网页也可能有 banner / promo / download 之类的类名。
    // 只有正文已定位、且具备章节语境、识别分达到“可能是小说”时才净化，
    // 避免在新闻、购物、工具站误伤正常页面。
    return !!(
      det && det.content && det.content.node &&
      det.chapterContext && det.score >= 38
    );
  }

  function evaluate() {
    if (!XN.settings.enabled) return;
    if (XN.reader.active) return;

    let det;
    try {
      det = XN.detectPage(document, XN.getSite(location.hostname));
    } catch (e) {
      return;
    }
    XN.status = det;

    // 原页面净化（可重复增量执行）
    if (XN.settings.purify && purifyEligible(det)) {
      try {
        if (!XN.purify.started) XN.purify.run(XN.getSite(location.hostname), det.content);
        else {
          XN.purify.contentNode = det.content && det.content.node ? det.content.node : null;
          XN.purify.scan();
        }
      } catch (e) {
        /* 净化失败不影响主流程 */
      }
    }

    if (!pillDone && XN.settings.showPill && det.content && det.content.node &&
        (det.score >= 38 || det.autoFallback)) {
      pillDone = true;
      // 用户点过 × 的站点，本次标签页会话内不再弹出普通入口。
      if (!XN.pillDismissed || !XN.pillDismissed()) XN.showPill();
    }

    if (!autoScheduled && !autoDone && siteAutoFor() && det.autoEligible && !userExited()) {
      autoScheduled = true;
      setTimeout(() => {
        if (!XN.settings.enabled || XN.reader.active) return;
        const ok = XN.reader.enter({ auto: true });
        if (ok) autoDone = true;
        else autoScheduled = false;
      }, 450);
    }

    lastSig = pageSignature();
  }

  function registerMessages() {
    try {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || typeof msg.type !== 'string') return;
        switch (msg.type) {
          case 'XN_STATUS':
            sendResponse({
              ok: true,
              host: location.hostname,
              version: XN.VERSION,
              detection: XN.detectionSummary(XN.status),
              reader: XN.reader.getStatus(),
              purified: XN.purify.count,
              settings: {
                enabled: XN.settings.enabled,
                autoEnter: XN.settings.autoEnter,
                autoThreshold: XN.settings.autoThreshold,
                purify: XN.settings.purify,
                mergeParts: XN.settings.mergeParts,
                theme: XN.settings.theme,
                fontSize: XN.settings.fontSize,
                autoNext: XN.settings.autoNext,
                siteAuto: siteAutoFor()
              }
            });
            break;
          case 'XN_ENTER':
            sendResponse({ ok: XN.reader.enter({ manual: true }), active: XN.reader.active });
            break;
          case 'XN_EXIT':
            XN.reader.exit();
            sendResponse({ ok: true, active: false });
            break;
          case 'XN_TOGGLE': {
            if (XN.reader.active) XN.reader.exit();
            else XN.reader.enter({ manual: true });
            sendResponse({ ok: true, active: XN.reader.active });
            break;
          }
          case 'XN_APPLY': {
            const patch = msg.patch || {};
            Object.keys(patch).forEach((k) => {
              if (k in XN.DEFAULTS) XN.settings[k] = patch[k];
            });
            XN.persist();
            XN.reader.applySettings();
            if (!XN.settings.enabled) {
              XN.reader.exit();
              XN.hidePill();
            }
            if (!XN.settings.purify && XN.purify.clear) XN.purify.clear();
            if (XN.settings.mergeParts && XN.reader.active) XN.reader.maybeMerge(true);
            if (XN.settings.enabled) setTimeout(() => evaluate(), 120);
            sendResponse({ ok: true });
            break;
          }
          case 'XN_SITE_AUTO':
            XN.siteOverride(location.hostname, { auto: !!msg.value });
            sendResponse({ ok: true, siteAuto: siteAutoFor() });
            break;
          case 'XN_RESCAN':
            XN.status = XN.detectPage(document, XN.getSite(location.hostname));
            lastSig = pageSignature();
            sendResponse({ ok: true, detection: XN.detectionSummary(XN.status) });
            break;
          default:
            break;
        }
      });
    } catch (e) {
      /* ignore */
    }
  }

  function registerStorageSync() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.xn_settings) return;
        const saved = changes.xn_settings.newValue || {};
        Object.keys(XN.DEFAULTS).forEach((k) => {
          if (saved[k] !== undefined) XN.settings[k] = saved[k];
        });
        if (saved.siteOverrides && typeof saved.siteOverrides === 'object') {
          XN.settings.siteOverrides = saved.siteOverrides;
        }
        XN.reader.applySettings();
        if (XN.settings.mergeParts && XN.reader.active) XN.reader.maybeMerge(true);
        if (!XN.settings.enabled) {
          XN.reader.exit();
          XN.hidePill();
        }
      });
    } catch (e) {
      /* ignore */
    }
  }

  async function init() {
    if (window.__XNOVEL_BOOTED__) return;
    window.__XNOVEL_BOOTED__ = true;

    await XN.loadSettings();
    registerMessages();
    registerStorageSync();

    if (!XN.settings.enabled) return;

    evaluate();
    lastSig = pageSignature();

    // 正文可能异步加载 / 站点在首屏后再插内容：短时间内跟随 DOM
    const deadline = Date.now() + 30000;
    let mutations = 0;
    let observer = null;
    try {
      observer = new MutationObserver(
        XN.throttle(() => {
          if (XN.reader.active || Date.now() > deadline || mutations >= 18) {
            if (observer) observer.disconnect();
            return;
          }
          mutations += 1;
          evaluate();
        }, 900)
      );
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      observer = null;
    }
    setTimeout(() => {
      if (observer) {
        try {
          observer.disconnect();
        } catch (e) {
          /* ignore */
        }
      }
    }, 32000);

    // 兜底轮询：处理 SPA 换章（URL 不变但标题/正文变了）与延迟加载
    let polls = 0;
    let lateChecks = 0;
    setInterval(() => {
      polls += 1;
      if (!XN.settings.enabled) return;

      const sig = pageSignature();
      if (sig !== lastSig) {
        lastSig = sig;
        if (XN.reader.active) return;
        autoScheduled = false;
        autoDone = false;
        pillDone = false;
        evaluate();
        return;
      }

      // 没有明显变化时，前 2 分半钟每 6 秒再识别一次，抓住“正文很晚才出现”的站点
      if (!XN.reader.active && polls % 4 === 0 && lateChecks < 25) {
        lateChecks += 1;
        evaluate();
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
