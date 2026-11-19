/* x-小说拓展 · 原页面净化：广告位、推荐位、下载浮层就地隐藏 */
(function () {
  const XN = window.__XNOVEL__;

  const PROTECT_TAGS = ['BODY', 'HTML', 'MAIN', 'ARTICLE', 'HEAD'];

  // 明确属于广告 / 推荐 / 下载位的类名，命中即可隐藏（正文容器另有保护）
  const STRONG_RX = /(^|[-_\s])(ad|ads|adv|advert|adsbygoogle|adbox|adwrap|adunit|guanggao|gg|tuiguang|tuijian|recommend|banner|popup|popunder|float|floating|sponsor|promo|download|appdown|openapp)([-_\s]|$)/i;

  // 推荐位标题：站点常把标题写在普通 div 里，没有可用的类名
  const REC_TITLE_RX = /猜你喜欢|猜你想看|大家都在看|大家都在读|热门推荐|相关推荐|本周热榜|热榜|排行榜|推荐榜|喜欢这本书|更多推荐|精品推荐|同类推荐|推荐阅读|书单|新书推荐|编辑推荐|本周强推|强推|完本推荐|热门小说|小说推荐|热门作品|人气作品/;

  XN.purify = {
    count: 0,
    hidden: new WeakSet(),
    list: [],
    contentNode: null,
    observer: null,
    started: false,

    clear: function () {
      this.list.forEach((el) => {
        try {
          el.classList.remove('xn-hide');
          el.removeAttribute('data-xn-hidden');
        } catch (e) {
          /* ignore */
        }
      });
      this.list = [];
      this.count = 0;
      this.hidden = new WeakSet();
    },

    run: function (site, content) {
      if (!document.body || this.started) return;
      this.started = true;
      this.site = site || null;
      this.contentNode = content && content.node ? content.node : null;

      this.scan();

      try {
        this.observer = new MutationObserver(XN.throttle(() => this.scan(), 500));
        this.observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        this.observer = null;
      }

      // 只在页面加载后的活跃期观察，避免长期占用
      setTimeout(() => this.stopObserver(), 20000);
    },

    stopObserver: function () {
      if (this.observer) {
        try {
          this.observer.disconnect();
        } catch (e) {
          /* ignore */
        }
        this.observer = null;
      }
    },

    isProtected: function (el) {
      if (!el || !el.tagName) return true;
      if (PROTECT_TAGS.indexOf(el.tagName) >= 0) return true;
      const c = this.contentNode;
      if (c && (el === c || el.contains(c))) return true;
      return false;
    },

    hide: function (el) {
      if (!el || this.hidden.has(el)) return false;
      el.classList.add('xn-hide');
      el.setAttribute('data-xn-hidden', '1');
      this.hidden.add(el);
      this.list.push(el);
      this.count += 1;
      return true;
    },

    scan: function () {
      if (!document.body) return;
      let nodes;
      try {
        nodes = document.body.querySelectorAll('div, section, aside, ul, li, iframe, span, a, img, header, footer');
      } catch (e) {
        return;
      }

      let budget = 0;
      for (const el of nodes) {
        if (budget > 5000) break;
        budget += 1;
        if (this.hidden.has(el)) continue;
        if (this.isProtected(el)) continue;

        const hint = XN.hintOf(el);
        const adAttr = el.hasAttribute('data-ad') ||
          el.hasAttribute('data-adslot') ||
          el.hasAttribute('data-tuiguang') ||
          el.getAttribute('data-ad-client') !== null ||
          el.classList.contains('adsbygoogle');

        const strongHint = STRONG_RX.test(hint);
        if (!adAttr && !strongHint && !XN.AD_HINT_RX.test(hint)) continue;

        const textLen = XN.textLength(el.textContent || '');
        let linkLen = 0;
        const anchors = el.querySelectorAll('a');
        for (const a of anchors) linkLen += XN.textLength(a.textContent || '');
        const ratio = textLen ? linkLen / textLen : 0;
        const tag = el.tagName;

        // 明确广告/推荐位：整块隐藏；模糊命中：只隐藏“像广告位”的节点，避免误伤正文
        const looksAd = (adAttr || strongHint)
          ? textLen < 3000
          : tag === 'IFRAME' || textLen < 80 || ratio > 0.3;
        if (!looksAd) continue;

        // 固定定位的整屏“打开 App”遮罩
        this.hide(el);
      }

      // 标题为“猜你喜欢 / 本周热榜”一类的推荐模块
      this.hideRecommendBoxes();
      // 被清空后只剩占位的侧栏整体收起
      this.sweepEmptySidebars();
      // 兜底：整屏浮层（下载 App / 领券）
      this.hideBlockingOverlay();
    },

    hideRecommendBoxes: function () {
      if (!document.body) return;
      let heads;
      try {
        heads = document.body.querySelectorAll('div, span, p, li, h2, h3, h4, h5, strong, b, em');
      } catch (e) {
        return;
      }
      let budget = 0;
      for (const el of heads) {
        if (budget > 6000) break;
        budget += 1;
        if (el.querySelector && el.querySelector('div, p, ul, li, h2, h3, h4, h5')) continue;
        const c = this.contentNode;
        if (c && (c.contains(el) || el.contains(c))) continue;

        const t = XN.cleanText(el.textContent || '');
        if (!t || t.length > 16) continue;
        if (!REC_TITLE_RX.test(t)) continue;

        let box = el.parentElement;
        for (let i = 0; i < 3 && box && box !== document.body; i++) {
          if (this.isProtected(box) || (c && c.contains(box))) break;
          if (box.querySelectorAll('a').length >= 2 && XN.textLength(box.textContent || '') < 3000) {
            this.hide(box);
            break;
          }
          box = box.parentElement;
        }
      }
    },

    sweepEmptySidebars: function () {
      if (!document.body) return;
      let cands;
      try {
        cands = document.body.querySelectorAll('aside, [class*="side"], [id*="side"]');
      } catch (e) {
        return;
      }
      for (const el of cands) {
        if (this.hidden.has(el) || this.isProtected(el)) continue;
        const kids = el.children;
        if (!kids || kids.length < 2 || kids.length > 6) continue;
        let allHidden = true;
        for (const k of kids) {
          if (!k.classList.contains('xn-hide')) {
            allHidden = false;
            break;
          }
        }
        if (!allHidden) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.5) continue;
        this.hide(el);
      }
    },

    hideBlockingOverlay: function () {
      if (!document.body) return;
      const els = document.body.querySelectorAll('div, section');
      let budget = 0;
      for (const el of els) {
        if (budget > 3000) break;
        budget += 1;
        if (this.hidden.has(el) || this.isProtected(el)) continue;
        let cs;
        try {
          cs = getComputedStyle(el);
        } catch (e) {
          continue;
        }
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const z = Number(cs.zIndex) || 0;
        if (z < 100) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const areaRatio = (rect.width * rect.height) / (window.innerWidth * window.innerHeight);
        if (areaRatio < 0.5) continue;
        const t = XN.cleanText(el.textContent || '').slice(0, 200);
        if (!t || t.length > 80) continue;
        if (!/(打开|下载|安装|APP|App|客户端|领券|红包|立即)/.test(t)) continue;
        if (!el.querySelector('a, button')) continue;
        this.hide(el);
      }
    }
  };
})();
