/* x-小说拓展 · 章内分页拼接
 * 站点把一章拆成「（1/3）(2/3)…」多页时，按章内“下一页”逐页抓取，合并成一个阅读视图。
 */
(function () {
  const XN = window.__XNOVEL__;

  // 标题里的分页标记：(1/3)、（2/3）、【3/3】、第2页/共3页
  const MARKERS = [
    /[（(【\[]\s*(\d{1,2})\s*[/／]\s*(\d{1,2})\s*[）)】\]]/,
    /第\s*(\d{1,2})\s*页\s*[/／]\s*(?:共\s*)?(\d{1,2})\s*页?/,
    /第\s*(\d{1,2})\s*页\s*共\s*(\d{1,2})\s*页/,
    /\s(\d{1,2})\s*[/／]\s*(\d{1,2})\s*页(?:\s|$)/
  ];

  const HINT_RX = /本章(?:节)?未完|本章未完|点击下一页|下一页继续|继续阅读本章|翻页继续|本章尚未结束|未完，?请?点击?下一页/;

  function tidyTitle(raw) {
    let t = XN.cleanText(raw);
    if (!t) return '';
    const parts = t.split(/\s*[_|｜\-—–]\s*/).filter(Boolean);
    const hit = parts.find((p) => XN.CHAPTER_RX.test(p));
    t = (hit || parts[0] || t).trim();
    return t.replace(/[（(【\[]\s*\d{1,2}\s*[/／]\s*\d{1,2}\s*[）)】\]]/g, '').trim();
  }

  function markerOf(text) {
    if (!text) return null;
    for (const rx of MARKERS) {
      const m = String(text).match(rx);
      if (!m) continue;
      const index = Number(m[1]);
      const total = Number(m[2]);
      if (index >= 1 && total >= 2 && index <= total + 1) {
        const base = tidyTitle(String(text).replace(m[0], ' '));
        return { index: index, total: total, baseTitle: base };
      }
    }
    return null;
  }

  function h1Of(doc) {
    const h = doc.querySelector('h1, .chapter-title, .title');
    if (!h) return '';
    const t = XN.cleanText(h.textContent || '');
    return t.length <= 80 ? t : '';
  }

  XN.partInfo = function (doc, data) {
    doc = doc || document;
    data = data || {};

    let mark = null;
    const candidates = [data.title, doc.title, h1Of(doc)];
    for (const t of candidates) {
      if (!mark) mark = markerOf(t);
    }

    let tail = '';
    // 优先看原始正文容器：extractChapter 会把“本章未完”提示行过滤掉，
    // 若只看 blocks，没有标题分页标记的站点就永远识别不到软分页
    if (data.container) tail = String(data.container.textContent || '').slice(-420);
    else if (data.blocks && data.blocks.length) tail = XN.plainText(data.blocks).slice(-420);
    else if (doc.body) tail = String(doc.body.textContent || '').slice(-420);
    const hint = HINT_RX.test(tail);

    const partNext = data.partNext || '';
    const chapterNext = data.chapterNext || '';
    const hasChapter = !!(
      (data.title && XN.CHAPTER_RX.test(data.title)) ||
      XN.hasChapterHeading(doc.title || '') ||
      XN.hasChapterHeading(h1Of(doc))
    );
    const distinct = !!partNext && (!chapterNext || partNext.split('#')[0] !== chapterNext.split('#')[0]);
    const active = distinct && (!!mark || (hint && hasChapter));

    return {
      index: mark ? mark.index : 1,
      total: mark ? mark.total : 0,
      baseTitle: mark ? mark.baseTitle : '',
      hint: hint,
      hasChapter: hasChapter,
      hasMarker: !!mark,
      active: active,
      partNext: partNext,
      chapterNext: chapterNext
    };
  };

  /* ---------------- 抓取分页 ---------------- */
  function absolutize(doc, base) {
    doc.__XN_DETACHED__ = true;
    const anchors = doc.querySelectorAll('a[href]');
    for (const a of anchors) {
      const raw = a.getAttribute('href');
      if (!raw) continue;
      try {
        a.setAttribute('href', new URL(raw, base).href);
      } catch (e) {
        /* ignore */
      }
    }
    const imgs = doc.querySelectorAll('img');
    for (const img of imgs) {
      ['src', 'data-src', 'data-original', 'data-lazy-src'].forEach((attr) => {
        const raw = img.getAttribute(attr);
        if (!raw || /^(data:|https?:|blob:)/i.test(raw)) return;
        try {
          img.setAttribute(attr, new URL(raw, base).href);
        } catch (e) {
          /* ignore */
        }
      });
    }
  }

  XN.fetchChapterPage = function (url) {
    return new Promise((resolve, reject) => {
      let ctrl = null;
      let timer = 0;
      try {
        ctrl = new AbortController();
        timer = setTimeout(() => ctrl.abort(), 9000);
      } catch (e) {
        ctrl = null;
      }
      fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
        signal: ctrl ? ctrl.signal : undefined
      })
        .then((res) => {
          if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'error'));
          return res.text();
        })
        .then((html) => {
          if (timer) clearTimeout(timer);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          absolutize(doc, url);
          resolve(doc);
        })
        .catch((err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });
    });
  };

  /* ---------------- 合并 ---------------- */
  function normTitle(t) {
    return XN.cleanText(t || '')
      .replace(/[（(【\[]\s*\d{1,2}\s*[/／]\s*\d{1,2}\s*[）)】\]]/g, '')
      .replace(/[（(]\s*(上|中|下|续|完|终)\s*[）)]/g, '')
      .replace(/第\s*\d{1,2}\s*页(?:\s*共\s*\d{1,2}\s*页)?/g, '')
      .replace(/[\s\u3000，。！？、；：·…]/g, '');
  }

  function sameChapter(base, title) {
    const a = normTitle(base);
    const b = normTitle(title);
    if (!a || !b) return false;
    if (a === b) return true;
    const n = Math.min(a.length, b.length, 14);
    return n >= 5 && a.slice(0, n) === b.slice(0, n);
  }

  function normBody(t) {
    return String(t || '')
      .replace(/[\s\u3000]/g, '')
      .replace(/[，。！？、；：]/g, '')
      .slice(0, 400);
  }

  function isPartLine(t) {
    const s = XN.cleanText(t);
    if (!s) return true;
    if (s.length > 120) return false;
    if (/^[（(【[]?\s*\d{1,2}\s*[/／]\s*\d{1,2}\s*[）)】\]]?$/.test(s)) return true;
    if (/^第\s*\d{1,2}\s*页(?:\s*[/／]?\s*共?\s*\d{1,2}\s*页)?$/.test(s)) return true;
    return HINT_RX.test(s);
  }

  function sameUrl(a, b) {
    return !!a && !!b && a.split('#')[0].replace(/\/$/, '') === b.split('#')[0].replace(/\/$/, '');
  }

  XN.mergeChapter = async function (firstData, site) {
    const info = firstData.part || XN.partInfo(document, firstData);
    if (!info || !info.active) return { merged: false, partCount: 1, failed: false };

    const total = Number(info.total) || 0;
    const maxParts = Math.min(total > 0 ? total : 8, 10);
    const baseTitle = info.baseTitle || tidyTitle(firstData.title);

    let blocks = (firstData.blocks || []).slice();
    let textLen = firstData.textLen || 0;
    let chapterNext = firstData.chapterNext || (
      firstData.next && firstData.next.split('#')[0] !== (firstData.partNext || '').split('#')[0] ? firstData.next : ''
    );
    let nextCandidate = chapterNext;
    let toc = firstData.toc || '';
    let partNext = info.partNext || firstData.partNext || '';
    let count = 1;
    let failed = false;

    // 判断一个链接是不是“当前章的下一页/第 N 节”，而不是真正的下一章。
    // bqge 这类站点第一页只有“下一页”，最后一页才出现“下一章”；
    // 如果最后一页的链接被误认成 next，直接跳过去就会退回本章第 2 节。
    function sameChapterPart(href) {
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
    }

    const seen = new Set();
    const seenImg = new Set();
    blocks.forEach((b) => {
      if (b.type === 'p') seen.add(normBody(b.text));
      else if (b.type === 'img') seenImg.add(b.src);
    });
    const visited = new Set([location.href.split('#')[0]]);

    while (partNext && count < maxParts) {
      const url = partNext;
      if (visited.has(url.split('#')[0])) break;
      visited.add(url.split('#')[0]);
      if (chapterNext && sameUrl(url, chapterNext)) break;

      let doc = null;
      let data = null;
      try {
        doc = await XN.fetchChapterPage(url);
        data = XN.extractChapter(doc, site);
      } catch (e) {
        failed = true;
        break;
      }
      if (!data || !data.ok) {
        failed = true;
        break;
      }

      // 防止把“下一章”误当成下一页：标题必须是同一章
      const pBase = baseTitle || firstData.title;
      if (data.title && pBase && !sameChapter(pBase, data.title)) break;

      let added = 0;
      for (const b of data.blocks || []) {
        if (b.type === 'img') {
          if (!seenImg.has(b.src)) {
            seenImg.add(b.src);
            blocks.push(b);
            added += 1;
          }
          continue;
        }
        if (isPartLine(b.text)) continue;
        const nb = normBody(b.text);
        if (!nb || seen.has(nb)) continue;
        seen.add(nb);
        blocks.push(b);
        textLen += XN.textLength(b.text || '');
        added += 1;
      }

      count += 1;
      if (data.chapterNext) chapterNext = data.chapterNext;
      // 有些站点最后一页只有“下一章”，没有 chapterNext；也把它作为
      // 候选，但当前章的分页地址一律排除，避免“下一章”回到第 2 节。
      const rawNext = data.next || data.chapterNext;
      if (rawNext && !sameChapterPart(rawNext) && !visited.has(rawNext.split('#')[0])) {
        nextCandidate = rawNext;
      }
      if (data.toc) toc = data.toc;

      const pInfo = data.part || XN.partInfo(doc, data);
      if (pInfo && pInfo.total && count >= pInfo.total) {
        partNext = '';
        break;
      }
      partNext = data.partNext || (pInfo && pInfo.partNext) || '';
      if (partNext && chapterNext && sameUrl(partNext, chapterNext)) partNext = '';
      if (!partNext) break;

      // 分页页数异常（比如 2/3 之后直接跳 4/3）时停止
      if (pInfo && pInfo.total && pInfo.index && pInfo.index !== count && pInfo.index > count) {
        partNext = '';
        break;
      }
      if (added === 0 && count > 1) {
        // 内容重复说明已经绕回同一页
        partNext = '';
        break;
      }
    }

    // 合并后“下一章”绝不能还是刚拼接过的分页地址。优先用明确的
    // chapterNext；没有时再用最后一页的 next 候选；两者都要经过
    // “当前章分页”过滤。
    let safeNext = '';
    if (chapterNext && !sameChapterPart(chapterNext)) safeNext = chapterNext;
    if (!safeNext && nextCandidate && !sameChapterPart(nextCandidate)) safeNext = nextCandidate;
    if (chapterNext && firstData.partNext && sameUrl(chapterNext, firstData.partNext)) safeNext = '';

    return {
      merged: count > 1,
      partCount: count,
      partTotal: total || count,
      failed: failed,
      title: baseTitle || firstData.title,
      blocks: blocks,
      textLen: textLen,
      prev: firstData.prev || '',
      next: safeNext,
      toc: toc || firstData.toc || '',
      chapterNext: safeNext,
      partNext: partNext || ''
    };
  };

  XN.isPartLine = isPartLine;
})();
