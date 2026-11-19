/* x-小说拓展 · 小说页面识别（多信号加权打分） */
(function () {
  const XN = window.__XNOVEL__;

  XN.URL_RX = [
    /\/\d{2,}\/\d{4,}\.html?/i,
    /\/book\/\d+/i,
    /\/novel\//i,
    /\/chapter[-\/]?\d+/i,
    /\/read[-\/]/i,
    /\/n\/\d+/i,
    /\/\d+[-_]\d+\.html?/i,
    /[?&](chapter|read|book|page|nid)=/i,
    /\/txt\//i,
    /\/\d+_\d+\.html?/i
  ];

  XN.detectPage = function (doc, site) {
    doc = doc || document;
    site = site || XN.getSite(location.hostname);

    let found = null;
    try {
      found = XN.findContent(doc, site);
    } catch (e) {
      found = null;
    }

    const stats = {
      textLen: found ? found.textLen : 0,
      blockCount: found ? found.blockCount : 0,
      linkRatio: found ? found.linkRatio : 1,
      elementCount: found ? found.elementCount : 0
    };

    const hostHit = XN.NOVEL_HOST_RX.test(location.hostname);
    const urlHit = XN.URL_RX.some((rx) => rx.test(location.pathname + location.search));
    const nav = XN.findNavLinks(doc, site);

    const pageTitle = doc.title || '';
    const titleHit = /(最新章节|全文阅读|无弹窗|免费阅读|章节目录|小说阅读)/.test(pageTitle);

    let chapterHit = XN.hasChapterHeading(pageTitle);
    if (!chapterHit) {
      const heads = doc.querySelectorAll('h1, h2');
      let checked = 0;
      for (const h of heads) {
        if (checked >= 5) break;
        const t = XN.cleanText(h.textContent);
        if (!t) continue;
        checked += 1;
        if (t.length <= 80 && XN.CHAPTER_RX.test(t)) {
          chapterHit = true;
          break;
        }
      }
    }

    let metaHit = false;
    const kw = doc.querySelector('meta[name="keywords"]');
    if (kw) {
      const c = kw.getAttribute('content') || '';
      if (/小说|章节|全文阅读|book|novel/i.test(c)) metaHit = true;
    }

    const textStats = XN.textStats(doc, found);

    let part = null;
    if (typeof XN.partInfo === 'function') {
      try {
        part = XN.partInfo(doc, {
          container: found ? found.node : null,
          partNext: nav.partNext,
          chapterNext: nav.chapterNext
        });
      } catch (e) {
        part = null;
      }
    }

    let score = 0;
    const reasons = [];
    const add = (pts, label) => {
      if (!pts) return;
      score += pts;
      reasons.push({ label: label, pts: pts });
    };

    add(!!site ? 46 : 0, '命中站点规则' + (site ? '（' + site.name + '）' : ''));
    add(hostHit ? 16 : 0, '小说站点域名');
    add(urlHit ? 12 : 0, '章节页 URL 特征');
    if (nav.chapterPrev && nav.chapterNext) add(14, '上一章 / 下一章导航');
    else if (nav.chapterPrev || nav.chapterNext) add(7, '章节翻页导航');
    else if (nav.partNext || nav.partPrev) add(8, '章内分页导航');
    add(nav.toc ? 5 : 0, '目录入口');
    add(titleHit ? 8 : 0, '标题含小说特征');
    add(chapterHit ? 8 : 0, '章节标题结构');
    add(metaHit ? 4 : 0, '页面关键词含小说');
    add(part && (part.active || (part.hasMarker && nav.partNext)) ? 8 : 0, '章内分页章节');

    const L = stats.textLen;
    add(L >= 1500 ? 12 : L >= 800 ? 9 : L >= 400 ? 5 : 0, '正文长度');

    // 不少笔趣阁类站点用一个 <div id="content"> 承载全章，段落之间只用 <br> 分隔。
    // 这种内容在 CSS 上仍是可读的多个段落，density 统计却只会算出 1 个 block。
    // 自动进入如果还按 1 个 block 判断，就会出现“98 分却进不去”的怪事。
    let brCount = 0;
    try {
      brCount = found && found.node ? found.node.querySelectorAll('br').length : 0;
    } catch (e) {
      brCount = 0;
    }
    const B = Math.max(stats.blockCount, brCount > 0 ? brCount + 1 : 1);
    add(B >= 8 ? 6 : B >= 4 ? 4 : 0, '段落结构');
    const r = stats.linkRatio;
    add(r <= 0.08 ? 6 : r <= 0.2 ? 4 : 0, '低链接密度');
    add(textStats.zhRatio >= 0.6 ? 5 : textStats.zhRatio >= 0.4 ? 3 : 0, '中文占比');
    add(textStats.quoteCount >= 6 ? 3 : 0, '对白特征');

    const penalties = [];
    if (r > 0.35) {
      add(-22, '链接密度过高');
      penalties.push('可能是目录页或导航页');
    }
    if (L < 400) {
      add(-22, '正文过短');
    }
    if (B < 3) add(-10, '缺少段落结构');
    if (!site && !hostHit && !urlHit && !nav.prev && !nav.next && !chapterHit) {
      add(-12, '缺少小说页面特征');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const label = score >= 76 ? '高' : score >= 55 ? '较高' : score >= 38 ? '可能' : '未识别';
    const threshold = Number(XN.settings.autoThreshold) || 55;

    // 分数之外必须有“章节语境”，避免把普通长文误判成小说
    const chapterContext = !!(
      site || hostHit || urlHit || chapterHit || nav.chapterPrev || nav.chapterNext || nav.toc ||
      (part && part.active)
    );

    // 有些小说站的标题只写“林蛙（1/3）”，或者没有目录入口，
    // 单靠 55 分门槛会漏掉真正能读的章节页。这里加一层“强章节语境”兜底：
    // 已知小说站 / 小说域名，或同时有上一章+下一章，或章内分页明确可跟随时，
    // 只要正文结构够、分数达到“可能”档位，就允许自动进入。
    // 普通文章没有这些信号，仍然不会触发。
    const strongSite = !!(site || hostHit);
    const strongNav = !!(nav.chapterPrev && nav.chapterNext);
    const strongPart = !!(part && part.active && nav.partNext);
    const minAutoLen = strongSite ? 320 : (strongNav || strongPart) ? 300 : 400;
    const autoFallback = !!(
      score >= 38 &&
      L >= minAutoLen &&
      B >= 3 &&
      chapterContext &&
      (strongSite || strongNav || strongPart) &&
      (chapterHit || titleHit || strongSite || (part && part.active))
    );
    const autoEligible =
      ((score >= threshold && L >= minAutoLen && B >= 3 && chapterContext) || autoFallback);

    return {
      score: score,
      label: label,
      reasons: reasons,
      penalties: penalties,
      threshold: threshold,
      autoEligible: autoEligible,
      autoFallback: autoFallback,
      autoReason: autoFallback && score < threshold ? '强章节语境兜底' : '',
      siteHit: !!site,
      siteName: site ? site.name : '',
      hostHit: hostHit,
      urlHit: urlHit,
      titleHit: titleHit,
      chapterHit: chapterHit,
      metaHit: metaHit,
      stats: stats,
      textLen: L,
      blockCount: B,
      linkRatio: r,
      zhRatio: textStats.zhRatio,
      quoteCount: textStats.quoteCount,
      nav: nav,
      part: part,
      chapterContext: chapterContext,
      content: found,
      source: found ? found.source : '',
      pageTitle: pageTitle
    };
  };

  XN.detectionSummary = function (det) {
    if (!det) return null;
    return {
      score: det.score,
      label: det.label,
      reasons: det.reasons.slice(0, 8),
      penalties: det.penalties,
      threshold: det.threshold,
      autoEligible: det.autoEligible,
      autoFallback: !!det.autoFallback,
      autoReason: det.autoReason || '',
      siteHit: det.siteHit,
      siteName: det.siteName,
      hostHit: det.hostHit,
      urlHit: det.urlHit,
      titleHit: det.titleHit,
      chapterHit: det.chapterHit,
      textLen: det.textLen,
      blockCount: det.blockCount,
      linkRatio: Number((det.linkRatio || 0).toFixed(3)),
      source: det.source,
      part: det.part
        ? { active: !!det.part.active, index: det.part.index || 1, total: det.part.total || 0 }
        : null,
      pageTitle: det.pageTitle
    };
  };
})();
