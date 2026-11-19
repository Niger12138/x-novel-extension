/* x-小说拓展 · 正文定位与结构化提取
 * 思路对齐夸克/阅读模式的做法：先站点规则直取，再正文密度聚类，最后做噪声剔除。
 */
(function () {
  const XN = window.__XNOVEL__;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'CANVAS', 'VIDEO',
    'AUDIO', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
    'HEAD', 'META', 'LINK'
  ]);

  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'LI', 'TD', 'TR', 'BLOCKQUOTE', 'PRE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'FIGCAPTION',
    'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'DL', 'DD', 'DT'
  ]);

  const CANDIDATE_SEL = 'div, article, section, main, td, pre';

  const POS_RX = /(content|chapter|article|read|novel|book|txt|zhengwen|main)/i;
  const NEG_RX = /(comment|share|footer|header|nav|menu|sidebar|breadcrumb|related|recommend|tuijian|hotlist|rank|advert|banner|download|qrcode|login|toolbar|guess|list)/i;

  XN.AD_HINT_RX = /(^|[-_\s])(ad|ads|adv|advert|adsbygoogle|adbox|adwrap|adunit|guanggao|gg|tuiguang|tuijian|sponsor|promo|banner|popup|popunder|float|floating|recommend|related|guess|youmaylike|hotlist|rank|ranking|qrcode|download|appdown|openapp|toolbar|share|comment)([-_\s]|$)/i;

  XN.BLOCK_TAGS = BLOCK_TAGS;
  XN.SKIP_TAGS = SKIP_TAGS;

  function hintOf(el) {
    try {
      const cls = typeof el.className === 'string'
        ? el.className
        : (el.className && el.className.baseVal) || '';
      return (cls + ' ' + (el.id || '')).toLowerCase();
    } catch (e) {
      return '';
    }
  }
  XN.hintOf = hintOf;

  function isVisible(el) {
    try {
      // DOMParser 解析出来的“离屏文档”没有布局，不能按可见性过滤
      if (el && el.ownerDocument && el.ownerDocument.__XN_DETACHED__) return true;
      if (!el || !el.getClientRects || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (cs.opacity !== '' && Number(cs.opacity) === 0) return false;
      return true;
    } catch (e) {
      return true;
    }
  }
  XN.isVisible = isVisible;

  /* ---------------- 全页文本/链接/块数量统计（一次遍历，O(n)） ---------------- */
  function buildMaps(root) {
    const text = new Map();
    const link = new Map();
    const count = new Map();
    const blocks = new Map();

    function walk(node) {
      if (node.nodeType === 3) {
        const n = XN.textLength(node.nodeValue);
        return { t: n, l: 0, c: 0, b: 0, own: n };
      }
      if (node.nodeType !== 1) return { t: 0, l: 0, c: 0, b: 0, own: 0 };
      if (SKIP_TAGS.has(node.tagName)) return { t: 0, l: 0, c: 0, b: 0, own: 0 };

      let t = 0, l = 0, c = 0, b = 0, own = 0;
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          const n = XN.textLength(ch.nodeValue);
          t += n;
          own += n;
        } else if (ch.nodeType === 1) {
          const r = walk(ch);
          t += r.t;
          l += r.l;
          c += r.c + 1;
          b += r.b;
        }
      }
      if (node.tagName === 'A') l = t;
      if (BLOCK_TAGS.has(node.tagName) && own >= 20) b += 1;

      text.set(node, t);
      link.set(node, l);
      count.set(node, c);
      blocks.set(node, b);
      return { t: t, l: l, c: c, b: b, own: 0 };
    }

    if (root) walk(root);
    return { text: text, link: link, count: count, blocks: blocks };
  }

  function statsOf(el, maps) {
    const t = maps.text.get(el) || 0;
    const l = maps.link.get(el) || 0;
    return {
      textLen: t,
      linkLen: l,
      linkRatio: t ? l / t : 0,
      blockCount: maps.blocks.get(el) || 0,
      elementCount: maps.count.get(el) || 0
    };
  }

  function scoreNode(el, maps) {
    const t = maps.text.get(el) || 0;
    if (t < 180) return -1;
    const l = maps.link.get(el) || 0;
    const ratio = l / Math.max(1, t);
    const b = maps.blocks.get(el) || 0;
    let s = t * (1 - Math.min(1, ratio) * 1.5);
    if (s < 1) s = 1;
    s += b * 24;
    const hint = hintOf(el);
    if (POS_RX.test(hint) && !NEG_RX.test(hint)) s *= 1.18;
    if (NEG_RX.test(hint)) s *= 0.5;
    if (el.tagName === 'BODY' || el.tagName === 'HTML') s *= 0.55;
    return s;
  }

  /* ---------------- 正文节点定位 ---------------- */
  function pickBestChild(el, maps) {
    let pick = null;
    let pickScore = -1;
    let pickText = 0;
    for (const c of el.children) {
      if (!c.tagName || SKIP_TAGS.has(c.tagName)) continue;
      const t = maps.text.get(c) || 0;
      if (t < 120) continue;
      const s = scoreNode(c, maps);
      if (s > pickScore) {
        pickScore = s;
        pick = c;
        pickText = t;
      }
    }
    return pick ? { el: pick, score: pickScore, text: pickText } : null;
  }

  function refineNode(base, maps) {
    let best = base;
    for (let i = 0; i < 7; i++) {
      const t = maps.text.get(best) || 0;
      if (!t) break;

      // 从 body/html 出发时，先进入正文占比最大的那个子容器
      if (best.tagName === 'BODY' || best.tagName === 'HTML') {
        const p = pickBestChild(best, maps);
        if (p && p.text >= t * 0.3) {
          best = p.el;
          continue;
        }
        break;
      }

      const p = pickBestChild(best, maps);
      if (!p) break;
      const parentScore = scoreNode(best, maps);
      if (p.text >= t * 0.72 || (p.score > parentScore * 1.05 && p.text >= t * 0.4)) {
        best = p.el;
      } else {
        break;
      }
    }
    return best;
  }

  XN.findContent = function (doc, site) {
    doc = doc || document;
    const body = doc.body;
    if (!body) return null;

    const maps = buildMaps(body);
    // 分页章节单页可能只有四五百字，门槛太高会直接漏掉
    const siteFloor = 320;
    const genericFloor = 380;

    // 1) 站点规则
    if (site && site.content) {
      for (const sel of site.content) {
        let nodes = [];
        try {
          nodes = Array.from(doc.querySelectorAll(sel));
        } catch (e) {
          continue;
        }
        const ok = nodes
          .map((el) => ({ el: el, s: statsOf(el, maps) }))
          .filter((x) => x.s.textLen >= siteFloor && x.s.linkRatio <= 0.32 && isVisible(x.el))
          .sort((a, b) => b.s.textLen - a.s.textLen)[0];
        if (ok) {
          return Object.assign({ node: ok.el, source: 'site:' + sel, siteName: site.name }, ok.s);
        }
      }
    }

    // 2) 通用正文选择器
    for (const sel of XN.GENERIC_CONTENT) {
      let nodes = [];
      try {
        nodes = Array.from(doc.querySelectorAll(sel));
      } catch (e) {
        continue;
      }
      const ok = nodes
        .map((el) => ({ el: el, s: statsOf(el, maps) }))
        .filter((x) => x.s.textLen >= genericFloor && x.s.linkRatio <= 0.3 && isVisible(x.el))
        .sort((a, b) => b.s.textLen - a.s.textLen)[0];
      if (ok) {
        return Object.assign({ node: ok.el, source: 'generic:' + sel }, ok.s);
      }
    }

    // 3) 正文密度聚类
    const candidates = [];
    const all = body.querySelectorAll(CANDIDATE_SEL);
    for (const el of all) {
      const s = scoreNode(el, maps);
      if (s > 0) candidates.push({ el: el, score: s });
    }
    candidates.sort((a, b) => b.score - a.score);

    let chosen = null;
    for (let i = 0; i < candidates.length && i < 8; i++) {
      if (isVisible(candidates[i].el)) {
        chosen = candidates[i].el;
        break;
      }
    }
    if (!chosen) chosen = body;

    const refined = refineNode(chosen, maps);
    return Object.assign({ node: refined, source: 'density' }, statsOf(refined, maps));
  };

  /* ---------------- 噪声剔除 ---------------- */
  function unwrap(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function sanitize(root) {
    const clone = root.cloneNode(true);

    const hard = clone.querySelectorAll(
      'script, style, noscript, iframe, form, input, button, select, textarea, svg, canvas, video, audio, aside, nav, footer, header'
    );
    hard.forEach((n) => n.remove());

    // 广告/推荐容器
    const nodes = Array.from(clone.querySelectorAll('*'));
    for (const el of nodes) {
      if (!el.parentNode) continue;
      const hint = hintOf(el);
      const isAdAttr = el.hasAttribute('data-ad') || el.hasAttribute('data-adslot') ||
        el.hasAttribute('data-tuiguang') || el.classList.contains('adsbygoogle');
      if (isAdAttr || XN.AD_HINT_RX.test(hint)) {
        // 不要把整块正文误删：正文容器通常同时含多个段落
        const t = XN.textLength(el.textContent);
        if (isAdAttr || t < 1200) {
          el.remove();
          continue;
        }
      }
      // 链接密度过高的小块：导航 / 推荐位
      if (el.tagName !== 'A') {
        const t = XN.textLength(el.textContent);
        if (t > 0 && t < 500) {
          let linkLen = 0;
          const anchors = el.querySelectorAll('a');
          anchors.forEach((a) => {
            linkLen += XN.textLength(a.textContent);
          });
          if (linkLen / t > 0.55) {
            el.remove();
            continue;
          }
        }
      }
      if (el.tagName === 'A') unwrap(el);
    }

    // 去掉残留的纯图片广告链接文字
    return clone;
  }

  /* ---------------- 结构化段落提取 ---------------- */
  function imageBlock(img) {
    const src = img.getAttribute('data-src') || img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') || img.getAttribute('src') || '';
    if (!src || !/^https?:/i.test(src)) return null;
    const hint = hintOf(img);
    if (/icon|logo|avatar|emoji|pixel|spacer|qr/i.test(hint)) return null;
    const w = Number(img.getAttribute('width')) || img.naturalWidth || 0;
    const h = Number(img.getAttribute('height')) || img.naturalHeight || 0;
    if (w && h && (w < 240 || h < 160)) return null;
    return { type: 'img', src: XN.absUrl(src), alt: img.getAttribute('alt') || '' };
  }

  function extractBlocks(root, maxImages) {
    const out = [];
    let buf = '';
    let images = 0;

    const flush = function () {
      const raw = XN.cleanText(buf);
      buf = '';
      if (!raw) return;
      raw.split('\n').forEach((line) => {
        const t = line.trim();
        if (!t) return;
        if (XN.junkLine(t)) return;
        out.push({ type: 'p', text: t });
      });
    };

    const walk = function (node) {
      if (node.nodeType === 3) {
        buf += node.nodeValue.replace(/\s+/g, ' ');
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (SKIP_TAGS.has(tag)) return;
      if (tag === 'BR') {
        flush();
        return;
      }
      if (tag === 'IMG') {
        flush();
        if (images < maxImages) {
          const b = imageBlock(node);
          if (b) {
            out.push(b);
            images += 1;
          }
        }
        return;
      }
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock) flush();
      for (const ch of node.childNodes) walk(ch);
      if (isBlock) flush();
    };

    walk(root);
    flush();
    return out;
  }

  function cleanDocTitle(raw) {
    let t = XN.cleanText(raw);
    if (!t) return '';
    const parts = t.split(/\s*[_|｜\-—–]\s*/).filter(Boolean);
    const hit = parts.find((p) => XN.CHAPTER_RX.test(p));
    t = (hit || parts[0] || t).trim();
    t = t.replace(/[【\[（(]\s*(最新章节|全文阅读|无弹窗|免费阅读|首发|连载)\s*[】\]）)]/g, '').trim();
    if (t.length > 72) t = t.slice(0, 72);
    return t;
  }

  function resolveTitle(doc, contentNode, blocks, site) {
    const list = [];

    if (site && site.title) {
      for (const sel of site.title) {
        let el = null;
        try {
          el = doc.querySelector(sel);
        } catch (e) {
          el = null;
        }
        if (!el || (contentNode && el.contains(contentNode))) continue;
        const t = XN.cleanText(el.textContent);
        if (t && t.length <= 80 && isVisible(el)) list.push(t);
      }
    }

    const heads = doc.querySelectorAll('h1, h2, h3');
    let headCount = 0;
    for (const h of heads) {
      if (headCount >= 6) break;
      if (!h.textContent) continue;
      if (contentNode && h.contains(contentNode)) continue;
      const t = XN.cleanText(h.textContent);
      if (!t || t.length > 80) continue;
      if (XN.CHAPTER_RX.test(t) && isVisible(h)) {
        list.push(t);
        headCount += 1;
      }
    }

    const firstLines = blocks.slice(0, 6);
    for (const b of firstLines) {
      if (b.type !== 'p') continue;
      if (b.text.length <= 80 && XN.CHAPTER_RX.test(b.text)) {
        list.push(b.text);
        break;
      }
    }

    const dt = cleanDocTitle(doc.title);
    if (dt) list.push(dt);

    const chapter = list.find((t) => XN.CHAPTER_RX.test(t) && t.length >= 4);
    return chapter || list[0] || '';
  }

  /* ---------------- 上一章 / 下一章 / 目录 / 章内翻页 ---------------- */
  XN.findNavLinks = function (doc, site) {
    doc = doc || document;
    const res = {
      prev: '', next: '', toc: '',
      chapterPrev: '', chapterNext: '',
      partPrev: '', partNext: ''
    };
    const self = location.href.split('#')[0];

    function valid(href) {
      if (!href) return '';
      let abs = '';
      try {
        abs = new URL(href, location.href).href;
      } catch (e) {
        return '';
      }
      if (!/^https?:/i.test(abs)) return '';
      if (abs.split('#')[0] === self) return '';
      return abs;
    }

    function fromSelector(selList) {
      if (!selList) return null;
      for (const sel of selList) {
        let el = null;
        try {
          el = doc.querySelector(sel);
        } catch (e) {
          el = null;
        }
        if (el && el.getAttribute) {
          const href = valid(el.getAttribute('href'));
          if (href) return { href: href, text: XN.cleanText(el.textContent || '') };
        }
      }
      return null;
    }

    function assign(el) {
      if (!el || !el.href) return;
      const raw = XN.cleanText(el.text || '').replace(/[←→<>«»〔〕\[\]【】（）()\s]/g, '');
      if (!raw) return;
      if (/^(previous|prev)$/i.test(raw)) {
        if (!res.chapterPrev) res.chapterPrev = el.href;
        return;
      }
      if (/^(next)$/i.test(raw)) {
        if (!res.chapterNext) res.chapterNext = el.href;
        return;
      }
      if (XN.CH_PREV_RX.test(raw)) {
        if (!res.chapterPrev) res.chapterPrev = el.href;
      } else if (XN.CH_NEXT_RX.test(raw)) {
        if (!res.chapterNext) res.chapterNext = el.href;
      } else if (XN.PART_PREV_RX.test(raw)) {
        if (!res.partPrev) res.partPrev = el.href;
      } else if (XN.PART_NEXT_RX.test(raw)) {
        if (!res.partNext) res.partNext = el.href;
      } else if (!res.toc && XN.TOC_RX.test(raw)) {
        res.toc = el.href;
      }
    }

    // 1) 站点规则：按链接文字判断是章节链接还是章内翻页
    if (site) {
      assign(fromSelector(site.prev));
      assign(fromSelector(site.next));
    }

    // 2) rel=prev/next
    if (!res.chapterPrev) {
      const el = doc.querySelector('link[rel="prev"], a[rel="prev"]');
      if (el) res.chapterPrev = valid(el.getAttribute('href'));
    }
    if (!res.chapterNext) {
      const el = doc.querySelector('link[rel="next"], a[rel="next"]');
      if (el) res.chapterNext = valid(el.getAttribute('href'));
    }

    // 3) 扫描全部锚文本
    const anchors = doc.querySelectorAll('a[href]');
    for (const a of anchors) {
      if (res.prev && res.next && res.toc && res.partNext) continue;
      assign({ href: valid(a.getAttribute('href')), text: a.textContent });
    }

    // 同一个地址同时被当成“下一章”和“下一页”时，以章节为准
    if (res.partNext && res.chapterNext && res.partNext.split('#')[0] === res.chapterNext.split('#')[0]) {
      res.partNext = '';
    }
    if (res.partPrev && res.chapterPrev && res.partPrev.split('#')[0] === res.chapterPrev.split('#')[0]) {
      res.partPrev = '';
    }

    res.prev = res.chapterPrev || res.partPrev;
    res.next = res.chapterNext || res.partNext;
    return res;
  };

  /* ---------------- 对外：提取整章 ---------------- */
  XN.extractChapter = function (doc, site) {
    doc = doc || document;
    site = site || XN.getSite(location.hostname);
    const found = XN.findContent(doc, site);
    if (!found || !found.node) {
      return {
        ok: false, blocks: [], textLen: 0, title: '', prev: '', next: '', toc: '',
        chapterPrev: '', chapterNext: '', partPrev: '', partNext: ''
      };
    }

    const clone = sanitize(found.node);
    let blocks = extractBlocks(clone, 3);

    // 去掉与标题重复的行、以及开头的书名/站点行
    let title = resolveTitle(doc, found.node, blocks, site);
    const norm = (s) => String(s || '').replace(/\s/g, '');
    if (title) {
      while (blocks.length && blocks[0].type === 'p' && norm(blocks[0].text) === norm(title)) {
        blocks.shift();
      }
    }

    // 章节小标题（"（1）"这种）保留；纯符号行、章节分页标记丢弃
    blocks = blocks.filter((b) => {
      if (b.type !== 'p') return true;
      const t = b.text;
      if (/^[（(【[〔]?\s*[0-9一二三四五六七八九十]{1,4}\s*[）)】\]〕]?$/.test(t)) return false;
      if (/^[（(【[]?\s*\d{1,2}\s*[/／]\s*\d{1,2}\s*[）)】\]]?$/.test(t)) return false;
      if (/^第\s*\d{1,2}\s*页(?:\s*[/／]?\s*共?\s*\d{1,2}\s*页)?$/.test(t)) return false;
      return true;
    });

    const textLen = blocks.reduce((n, b) => n + XN.textLength(b.text || ''), 0);
    const nav = XN.findNavLinks(doc, site);

    const result = {
      ok: textLen > 200,
      title: title || cleanDocTitle(doc.title) || '未命名章节',
      blocks: blocks,
      textLen: textLen,
      prev: nav.prev,
      next: nav.next,
      toc: nav.toc,
      chapterPrev: nav.chapterPrev,
      chapterNext: nav.chapterNext,
      partPrev: nav.partPrev,
      partNext: nav.partNext,
      container: found.node,
      source: found.source,
      linkRatio: found.linkRatio,
      blockCount: found.blockCount
    };

    // 章内分页信息（merge.js 加载后才可用）
    if (typeof XN.partInfo === 'function') {
      try {
        result.part = XN.partInfo(doc, result);
      } catch (e) {
        result.part = null;
      }
    }
    return result;
  };

  XN.plainText = function (blocks) {
    return (blocks || [])
      .map((b) => (b.type === 'p' ? b.text : ''))
      .filter(Boolean)
      .join('\n');
  };

  XN.textStats = function (doc, content) {
    const node = (content && content.node) || doc.body;
    if (!node) return { zhRatio: 0, quoteCount: 0 };
    const raw = String(node.textContent || '').slice(0, 6000);
    const compact = raw.replace(/\s/g, '');
    if (!compact) return { zhRatio: 0, quoteCount: 0 };
    let cjk = 0;
    for (let i = 0; i < compact.length; i++) {
      if (XN.isCjk(compact[i])) cjk += 1;
    }
    const quotes = (compact.match(/[“”「」『』]/g) || []).length;
    return { zhRatio: cjk / compact.length, quoteCount: quotes };
  };
})();
