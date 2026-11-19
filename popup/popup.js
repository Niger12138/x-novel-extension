/* x-小说拓展 · 弹窗 */
const DEFAULTS = {
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

const THEMES = [
  { id: 'paper', name: '纸白', swatch: '#faf7f0' },
  { id: 'sepia', name: '米黄', swatch: '#f4e8d3' },
  { id: 'mint', name: '护眼绿', swatch: '#e4ede1' },
  { id: 'slate', name: '雾蓝', swatch: '#e8edf4' },
  { id: 'night', name: '夜间', swatch: '#15171b' },
  { id: 'oled', name: '纯黑', swatch: '#000000' }
];

let settings = Object.assign({}, DEFAULTS);
let tabId = null;
let host = '';
let detection = null;
let readerActive = false;
let readerStatus = null;
let siteAuto = true;
let supported = false;

function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function send(msg, cb) {
  if (tabId == null) {
    if (cb) cb(null);
    return;
  }
  try {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) {
        if (cb) cb(null);
        return;
      }
      if (cb) cb(res);
    });
  } catch (e) {
    if (cb) cb(null);
  }
}

/* ---------------- 状态 ---------------- */
function requestStatus() {
  send({ type: 'XN_STATUS' }, (res) => {
    if (!res || !res.ok) {
      setUnsupported('此页面未加载扩展');
      return;
    }
    supported = true;
    host = res.host || '';
    detection = res.detection || null;
    readerActive = !!(res.reader && res.reader.active);
    readerStatus = res.reader || null;

    const s = res.settings || {};
    if (typeof s.autoEnter === 'boolean') settings.autoEnter = s.autoEnter;
    if (typeof s.autoThreshold === 'number') settings.autoThreshold = s.autoThreshold;
    if (typeof s.purify === 'boolean') settings.purify = s.purify;
    if (typeof s.mergeParts === 'boolean') settings.mergeParts = s.mergeParts;
    if (typeof s.theme === 'string') settings.theme = s.theme;
    if (typeof s.fontSize === 'number') settings.fontSize = s.fontSize;
    if (typeof s.autoNext === 'boolean') settings.autoNext = s.autoNext;
    siteAuto = typeof s.siteAuto === 'boolean' ? s.siteAuto : !!settings.autoEnter;

    $('siteHost').textContent = host || '—';
    $('purifyCount').textContent = res.purified ? '已在原页面隐藏 ' + res.purified + ' 个广告 / 推荐位' : '';
    renderStatus();
    renderSettings();
    loadRecent();
  });
}

function setUnsupported(reason) {
  supported = false;
  detection = null;
  readerActive = false;
  $('scoreText').textContent = '—';
  $('scoreBar').style.width = '0%';
  $('stateText').textContent = '当前页面不支持';
  $('reasons').innerHTML = '<div class="reason"><span>' + esc(reason) + '</span><b>—</b></div>';
  $('hostText').style.display = 'block';
  $('hostText').textContent = '请在小说网页中使用；如果刚安装扩展，请刷新页面后重试。';
  $('mainBtn').disabled = true;
  $('mainBtn').classList.remove('ghost');
  $('mainBtn').textContent = '进入纯净阅读';
  $('purifyCount').textContent = '';
}

function renderStatus() {
  const det = detection;
  const score = det ? det.score : 0;
  const threshold = det && det.threshold ? det.threshold : settings.autoThreshold;

  $('scoreText').textContent = det ? score + ' / 100' : '—';
  const bar = $('scoreBar');
  bar.style.width = Math.min(100, Math.max(0, score)) + '%';
  bar.style.background = score >= threshold ? 'var(--accent)' : score >= 40 ? '#b08a4a' : 'var(--line)';

  let state = '等待识别…';
  let btn = '进入纯净阅读';
  let ghost = false;
  let disabled = false;

  if (!supported) {
    state = '当前页面不支持';
    disabled = true;
  } else if (readerActive) {
    state = readerStatus && readerStatus.merging ? '正在拼接本章分页' :
      (readerStatus && readerStatus.partFailed ? '本章分页未完整拼接' : '正在纯净阅读');
    btn = '退出阅读模式';
    ghost = true;
  } else if (det && score >= threshold) {
    state = '已识别为小说';
  } else if (det && score >= 40) {
    state = '可能是小说页面';
  } else if (det) {
    state = '未识别为小说';
    btn = '强制进入纯净阅读';
  } else {
    state = '等待识别…';
    disabled = true;
  }

  $('stateText').textContent = state;
  $('mainBtn').disabled = disabled;
  $('mainBtn').textContent = btn;
  if (ghost) $('mainBtn').classList.add('ghost');
  else $('mainBtn').classList.remove('ghost');

  if (det) {
    const reasons = (det.reasons || []).filter((r) => r.pts > 0).slice(0, 4);
    if (reasons.length) {
      $('reasons').innerHTML = reasons
        .map((r) => '<div class="reason"><span>' + esc(r.label) + '</span><b class="pos">+' + r.pts + '</b></div>')
        .join('');
    } else {
      $('reasons').innerHTML = '<div class="reason"><span>暂无小说特征</span><b>0</b></div>';
    }
    $('hostText').style.display = 'block';
    $('hostText').textContent =
      host + ' · 正文 ' + (det.textLen || 0) + ' 字 · 段落 ' + (det.blockCount || 0) +
      (det.part && (det.part.total > 1 || det.part.active) ? ' · 本章分页 ' + (det.part.total || '?') + ' 页' : '') +
      (det.source ? ' · 定位：' + det.source : '') +
      (readerActive && readerStatus && readerStatus.partCount > 1 ? ' · 已拼接 ' + readerStatus.partCount + ' 页' : '');
  } else {
    $('reasons').innerHTML = '<div class="reason"><span>暂无识别数据</span><b>—</b></div>';
  }
}

/* ---------------- 设置 ---------------- */
function renderSettings() {
  $('autoEnter').checked = !!settings.autoEnter;
  $('purify').checked = !!settings.purify;
  $('mergeParts').checked = !!settings.mergeParts;
  $('siteAuto').checked = !!siteAuto;
  $('fsVal').textContent = String(settings.fontSize || 19);

  const wrap = $('swatches');
  wrap.innerHTML = '';
  THEMES.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (settings.theme === t.id ? ' on' : '');
    b.title = t.name;
    b.setAttribute('aria-label', t.name);
    const inner = document.createElement('span');
    inner.style.background = t.swatch;
    b.appendChild(inner);
    b.addEventListener('click', () => save({ theme: t.id }));
    wrap.appendChild(b);
  });
}

/* ---------------- 最近阅读 ---------------- */
function fmtWhen(ts) {
  const n = Number(ts) || 0;
  if (!n) return '';
  const diff = Date.now() - n;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  const d = new Date(n);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function recentHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function renderRecent(items) {
  const group = $('recentGroup');
  const list = $('recentList');
  const count = $('recentCount');
  if (!group || !list || !count) return;
  if (!items.length) {
    group.hidden = true;
    list.innerHTML = '';
    return;
  }
  group.hidden = false;
  count.textContent = items.length + ' 条 · 展开';
  list.innerHTML = items.map((it) => {
    const title = it.title || '未命名章节';
    const ratio = Math.round(clamp(Number(it.ratio) || 0, 0, 1) * 100);
    const meta = [recentHost(it.url), ratio + '%', fmtWhen(it.ts)].filter(Boolean).join(' · ');
    return '<a class="recent-item" href="' + esc(it.url) + '" data-url="' + esc(it.url) + '">' +
      '<span class="recent-title">' + esc(title) + '</span>' +
      '<span class="recent-meta">' + esc(meta) + '</span>' +
      '</a>';
  }).join('');
}

function loadRecent() {
  try {
    chrome.storage.local.get(['xn_positions'], (res) => {
      const map = (res && res.xn_positions) || {};
      const items = Object.keys(map).map((key) => {
        const it = map[key] || {};
        return {
          title: String(it.title || ''),
          url: String(it.url || ''),
          ratio: Number(it.ratio) || 0,
          ts: Number(it.ts) || 0
        };
      }).filter((it) => /^https?:/i.test(it.url) && it.title)
        .sort((a, b) => b.ts - a.ts);
      const seen = new Set();
      const out = [];
      for (const it of items) {
        const sig = it.url + '\n' + it.title;
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push(it);
        if (out.length >= 5) break;
      }
      renderRecent(out);
    });
  } catch (e) {
    /* ignore */
  }
}

function save(patch) {
  settings = Object.assign({}, settings, patch);
  try {
    chrome.storage.local.set({ xn_settings: Object.assign({}, settings) });
  } catch (e) {
    /* ignore */
  }
  send({ type: 'XN_APPLY', patch: patch }, () => {});
  renderSettings();
  renderStatus();
  setTimeout(requestStatus, 160);
}

/* ---------------- 交互 ---------------- */
function bind() {
  $('mainBtn').addEventListener('click', () => {
    if (!supported) return;
    if (readerActive) {
      send({ type: 'XN_EXIT' }, () => setTimeout(requestStatus, 260));
    } else {
      send({ type: 'XN_ENTER' }, () => setTimeout(requestStatus, 320));
    }
  });

  $('autoEnter').addEventListener('change', (e) => {
    save({ autoEnter: !!e.target.checked });
  });

  $('purify').addEventListener('change', (e) => {
    save({ purify: !!e.target.checked });
  });

  $('mergeParts').addEventListener('change', (e) => {
    save({ mergeParts: !!e.target.checked });
  });

  $('siteAuto').addEventListener('change', (e) => {
    siteAuto = !!e.target.checked;
    send({ type: 'XN_SITE_AUTO', value: siteAuto }, (res) => {
      if (res && res.ok) siteAuto = !!res.siteAuto;
      renderSettings();
    });
  });

  $('fsMinus').addEventListener('click', () => {
    save({ fontSize: clamp((Number(settings.fontSize) || 19) - 1, 14, 34) });
  });

  $('fsPlus').addEventListener('click', () => {
    save({ fontSize: clamp((Number(settings.fontSize) || 19) + 1, 14, 34) });
  });

  const recentList = $('recentList');
  if (recentList) {
    recentList.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-url]');
      if (!a) return;
      e.preventDefault();
      const url = a.getAttribute('data-url');
      if (!url) return;
      try {
        chrome.tabs.create({ url: url });
        window.close();
      } catch (err) {
        window.open(url, '_blank');
      }
    });
  }
}

/* ---------------- 启动 ---------------- */
function init() {
  bind();
  loadRecent();

  try {
    chrome.storage.local.get(['xn_settings'], (res) => {
      if (res && res.xn_settings) settings = Object.assign({}, DEFAULTS, res.xn_settings);
      renderSettings();
    });
  } catch (e) {
    renderSettings();
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      setUnsupported('无法读取当前标签页');
      return;
    }
    tabId = tab.id;
    const url = tab.url || '';
    if (/^(chrome|edge|about|devtools|chrome-extension|extension):/i.test(url)) {
      setUnsupported('浏览器内置页面不支持识别');
      return;
    }
    requestStatus();
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.xn_settings) return;
      settings = Object.assign({}, DEFAULTS, changes.xn_settings.newValue || {});
      renderSettings();
    });
  } catch (e) {
    /* ignore */
  }
}

init();
