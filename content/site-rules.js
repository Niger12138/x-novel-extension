/* x-小说拓展 · 站点规则库
 * 说明：大站点给精确选择器，其余站点走通用启发式（正文密度 + 章节结构）。
 */
(function () {
  const XN = window.__XNOVEL__;

  XN.SITES = [
    {
      id: 'qidian',
      host: /(^|\.)qidian\.com$/i,
      name: '起点中文网',
      content: ['.read-content', '.content-wrap .content', '#content'],
      title: ['.j_chapterName', '.chapter-name', 'h1'],
      prev: ['.chapter-control a.prev', 'a.prev'],
      next: ['.chapter-control a.next', 'a.next'],
      remove: ['.admire', '.recommend', '.book-info', '.reader-banner', '.chapter-comment']
    },
    {
      id: 'fanqie',
      host: /(^|\.)(fanqienovel|changdunovel)\.com$/i,
      name: '番茄小说',
      content: ['.chapter-content', '#chapter-content', '.content', 'article'],
      title: ['.chapter-title', '.title', 'h1'],
      prev: ['.chapter-nav .prev', 'a.prev'],
      next: ['.chapter-nav .next', 'a.next'],
      remove: ['.ad', '.recommend', '.comment', '.bottom-bar']
    },
    {
      id: 'jjwxc',
      host: /(^|\.)jjwxc\.net$/i,
      name: '晋江文学城',
      content: ['#noveltext', '.noveltext', '.text'],
      title: ['h2', '.noveltext h2'],
      prev: [],
      next: [],
      remove: ['.comment', '.ad', '.read_tools']
    },
    {
      id: 'zongheng',
      host: /(^|\.)zongheng\.com$/i,
      name: '纵横中文网',
      content: ['#content', '.content', '.read-content'],
      title: ['.title', 'h1'],
      prev: ['a.prev', '.page a:first-child'],
      next: ['a.next', '.page a:last-child'],
      remove: ['.recommend', '.ad', '.comment']
    },
    {
      id: '17k',
      host: /(^|\.)17k\.com$/i,
      name: '17K小说网',
      content: ['#readContent', '.readContent', '#content'],
      title: ['.title', 'h1'],
      prev: ['#prev', 'a.prev'],
      next: ['#next', 'a.next'],
      remove: ['.ad', '.recommend', '.comment']
    },
    {
      id: 'ciweimao',
      host: /(^|\.)ciweimao\.com$/i,
      name: '刺猬猫',
      content: ['#article-item', '.article-item', '.chapter-content'],
      title: ['.title', 'h1'],
      prev: ['.prev', 'a.prev'],
      next: ['.next', 'a.next'],
      remove: ['.comment', '.recommend']
    },
    {
      id: 'sfacg',
      host: /(^|\.)sfacg\.com$/i,
      name: 'SF轻小说',
      content: ['#ChapterContent', '.chapter-content', '.content'],
      title: ['#ChapterTitle', '.chapter-title', 'h1'],
      prev: ['.prev', 'a.prev'],
      next: ['.next', 'a.next'],
      remove: ['.ad', '.recommend']
    },
    {
      id: 'linovelib',
      host: /(^|\.)(linovelib|linovel)\.com$/i,
      name: '轻之文库',
      content: ['#acg-content', '.chapter-content', '#content'],
      title: ['.chapter-title', 'h1'],
      prev: ['.prev', 'a.prev'],
      next: ['.next', 'a.next'],
      remove: ['.ad', '.recommend']
    },
    {
      id: 'qmxs',
      host: /(^|\.)(qmxs|qimao|shuqi)\.com$/i,
      name: '七猫小说',
      content: ['#content', '.content', '.chapter-content'],
      title: ['.title', 'h1'],
      prev: ['.prev', 'a.prev'],
      next: ['.next', 'a.next'],
      remove: ['.ad', '.recommend', '.comment']
    },
    {
      id: 'biquge',
      host: /(biquge|biqu|bqg|biqi|shuquge|69shu|piaotia|23qb|qbxsw|8yueshu|bookben|uuks|ixdzs|qudu|kanshu|xiaoshuo|booktxt|dushi|wuxia|txt|novel)/i,
      name: '小说站点',
      content: ['#content', '#chaptercontent', '#booktxt', '.showtxt', '.content', '#booktext'],
      title: ['.bookname h1', '.title', 'h1'],
      prev: ['.bottem1 a:nth-child(1)', 'a.prev'],
      next: ['.bottem1 a:nth-child(3)', 'a.next'],
      remove: ['.bottem', '.readpage', '.ad', '.recommend']
    }
  ];

  XN.GENERIC_CONTENT = [
    '#chaptercontent',
    '#chapter-content',
    '#booktxt',
    '#noveltext',
    '#readContent',
    '.read-content',
    '.chapter-content',
    '.article-content',
    '.showtxt',
    '#content',
    '.content',
    'article',
    '.article'
  ];

  XN.getSite = function (host) {
    if (!host) return null;
    for (const s of XN.SITES) {
      if (s.host.test(host)) return s;
    }
    return null;
  };

  // 域名里带这些词，基本是小说站
  XN.NOVEL_HOST_RX = /qidian|fanqie|changdu|jjwxc|zongheng|17k|ciweimao|sfacg|linovelib|qmxs|qimao|shuqi|kanshu|xiaoshuo|biquge|biqu|bqg|biqi|shuquge|69shu|piaotia|23qb|qbxsw|8yueshu|bookben|uuks|ixdzs|qudu|booktxt|novel|dushi|wuxia|txt/i;

  XN.CHAPTER_RX = /第[0-9０-９零一二三四五六七八九十百千万两]{1,10}[章节回卷集部篇幕]|楔子|序章|尾声|番外|后记|终章|第[0-9０-９]{1,5}章/i;

  // 章节级导航（不含“页”）
  XN.CH_PREV_RX = /^(上一[章节篇回]|上一章|上一篇|上一節|上一节)/;
  XN.CH_NEXT_RX = /^(下一[章节篇回]|下一章|下一篇|下一節|下一节)/;
  // 章内分页导航
  XN.PART_PREV_RX = /^(上一页|上页|上一頁|前一页)/;
  XN.PART_NEXT_RX = /^(下一页|下页|下一頁|下一部分|后一页|继续阅读本章|继续翻页|翻页继续)/;

  // 兼容旧逻辑
  XN.PREV_RX = /^(上一[章页节篇回]|上一章|上一页|上一篇)/;
  XN.NEXT_RX = /^(下一[章页节篇回]|下一章|下一页|下一篇)/;
  XN.TOC_RX = /^(目录|章节目录|返回目录|全部章节|章节列表|返回书页|作品目录)|章节目录$/;

  XN.hasChapterHeading = function (text) {
    if (!text) return false;
    return XN.CHAPTER_RX.test(XN.cleanText(text).slice(0, 80));
  };
})();
