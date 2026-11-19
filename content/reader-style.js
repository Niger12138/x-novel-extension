/* x-小说拓展 · 阅读器样式（全部注入 Shadow DOM，站点 CSS 无法干扰） */
(function () {
  const XN = window.__XNOVEL__;

  XN.READER_CSS = `
:host { all: initial; }

.xr {
  --bg: #faf7f0;
  --bg2: #f2ece0;
  --ink: #25231f;
  --ink2: #857e71;
  --line: #e5ddce;
  --accent: #9c3d2e;
  --accent-ink: #fff8f0;
  --shadow: 0 18px 46px rgba(37, 31, 22, .14);
  --fs: 19px;
  --lh: 1.95;
  --ps: .55em;
  --width: 720px;
  --font: "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", serif;
}

.xr[data-theme="sepia"] {
  --bg: #f4e8d3; --bg2: #ebdcc2; --ink: #35291a; --ink2: #8a7456;
  --line: #e2d2b4; --accent: #8c4a2f; --shadow: 0 18px 46px rgba(60, 44, 24, .16);
}
.xr[data-theme="mint"] {
  --bg: #e4ede1; --bg2: #d9e6d5; --ink: #232b24; --ink2: #6f8072;
  --line: #cfdcc9; --accent: #3f6b4a; --shadow: 0 18px 46px rgba(30, 50, 34, .14);
}
.xr[data-theme="slate"] {
  --bg: #e8edf4; --bg2: #dfe6ef; --ink: #232a33; --ink2: #6c7887;
  --line: #d3dce7; --accent: #3e5f86; --shadow: 0 18px 46px rgba(28, 40, 55, .14);
}
.xr[data-theme="night"] {
  --bg: #15171b; --bg2: #1c1f24; --ink: #c6cacf; --ink2: #868d95;
  --line: #262a30; --accent: #c46a55; --accent-ink: #1a120f; --shadow: 0 18px 46px rgba(0, 0, 0, .5);
}
.xr[data-theme="oled"] {
  --bg: #000000; --bg2: #0b0b0c; --ink: #b9bec6; --ink2: #767c84;
  --line: #1a1a1a; --accent: #c46a55; --accent-ink: #1a120f; --shadow: 0 18px 46px rgba(0, 0, 0, .7);
}

.xr {
  font-family: var(--font);
  color: var(--ink);
  background: var(--bg);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.xr * { box-sizing: border-box; }

/* ---------- 顶栏 ---------- */
.xr-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 58px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px 0 22px;
  z-index: 6;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  transition: transform .28s ease, opacity .28s ease;
}
.xr-top.is-hidden { transform: translateY(-100%); opacity: 0; }

.xr-mark {
  width: 26px; height: 26px;
  border: 1px solid var(--ink);
  display: flex; align-items: center; justify-content: center;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 15px; line-height: 1; font-weight: 700;
  color: var(--ink);
  flex: none;
  user-select: none;
}
.xr-brand {
  font-size: 12px;
  color: var(--ink2);
  letter-spacing: .08em;
  flex: none;
  user-select: none;
}
.xr-sep-dot {
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--ink2); opacity: .5; flex: none;
}
.xr-top-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--ink);
  opacity: .82;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: .02em;
}
.xr-tools { display: flex; align-items: center; gap: 2px; flex: none; }

.xr-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ink);
  width: 38px; height: 38px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: inherit;
  transition: background .16s ease;
  position: relative;
}
.xr-btn:hover { background: var(--bg2); }
.xr-btn:active { background: var(--line); }
.xr-btn[disabled] { opacity: .3; cursor: default; }
.xr-btn[disabled]:hover { background: transparent; }
.xr-btn svg { width: 19px; height: 19px; display: block; }
.xr-btn .xr-aa { font-size: 16px; font-family: Georgia, serif; line-height: 1; letter-spacing: -.02em; }

/* ---------- 阅读区 ---------- */
.xr-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scroll-behavior: auto;
  -webkit-overflow-scrolling: touch;
}
.xr-scroll::-webkit-scrollbar { width: 10px; }
.xr-scroll::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 6px;
  border: 3px solid var(--bg);
}
.xr-scroll::-webkit-scrollbar-track { background: transparent; }

.xr-main {
  max-width: var(--width);
  margin: 0 auto;
  padding: 96px 34px 132px;
}

.xr-head { text-align: center; margin-bottom: 38px; }
.xr-kicker {
  font-size: 11px;
  color: var(--ink2);
  letter-spacing: .22em;
  margin-bottom: 16px;
  text-transform: none;
}
.xr-title {
  font-size: calc(var(--fs) * 1.42);
  line-height: 1.45;
  font-weight: 600;
  margin: 0 0 14px;
  letter-spacing: .02em;
  color: var(--ink);
  word-break: break-word;
}
.xr-rule {
  width: 34px; height: 1px;
  background: var(--accent);
  opacity: .75;
  margin: 0 auto 16px;
}
.xr-meta {
  font-size: 12px;
  color: var(--ink2);
  letter-spacing: .04em;
}
.xr-meta i {
  display: inline-block;
  width: 1px; height: 9px;
  background: var(--ink2);
  opacity: .35;
  margin: 0 10px;
  vertical-align: -1px;
}
.xr-merged {
  display: inline-block;
  padding: 1px 6px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--accent);
  font-size: 11px;
  letter-spacing: .06em;
  vertical-align: 1px;
  opacity: .92;
}

.xr-body { font-size: var(--fs); line-height: var(--lh); text-align: justify; text-justify: inter-ideograph; word-break: break-word; }
.xr-body p {
  margin: 0 0 var(--ps);
  text-indent: 2em;
  letter-spacing: .012em;
  line-break: strict;
}
.xr-body.no-indent p { text-indent: 0; }
.xr-body.no-indent p + p { margin-top: 1.1em; }
.xr-body p:first-child { margin-top: 0; }
.xr-body figure { margin: 1.4em 0; text-align: center; }
.xr-body figure img {
  max-width: 100%;
  height: auto;
  border-radius: 2px;
  display: inline-block;
}
.xr-body figure figcaption {
  font-size: 12px;
  color: var(--ink2);
  margin-top: 8px;
}

.xr-end {
  margin-top: 56px;
  text-align: center;
}
.xr-end-rule {
  width: 100%;
  height: 1px;
  background: var(--line);
  margin-bottom: 26px;
}
.xr-end-note {
  font-size: 12px;
  color: var(--ink2);
  letter-spacing: .18em;
  margin: 0 0 22px;
}
.xr-end-next {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--bg2);
  color: var(--ink);
  font-family: inherit;
  font-size: 14px;
  padding: 11px 26px;
  border-radius: 2px;
  cursor: pointer;
  transition: border-color .18s ease, color .18s ease;
  letter-spacing: .06em;
}
.xr-end-next:hover { border-color: var(--accent); color: var(--accent); }
.xr-end-empty { font-size: 12px; color: var(--ink2); letter-spacing: .1em; }

/* ---------- 底栏 ---------- */
.xr-foot {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 22px;
  z-index: 6;
  background: var(--bg);
  border-top: 1px solid var(--line);
  transition: transform .28s ease, opacity .28s ease;
}
.xr-foot.is-hidden { transform: translateY(100%); opacity: 0; }

.xr-nav {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ink2);
  font-family: inherit;
  font-size: 13px;
  letter-spacing: .04em;
  height: 40px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background .16s ease, color .16s ease;
  flex: none;
}
.xr-nav:hover { background: var(--bg2); color: var(--ink); }
.xr-nav[disabled] { opacity: .3; cursor: default; }
.xr-nav[disabled]:hover { background: transparent; color: var(--ink2); }
.xr-nav svg { width: 14px; height: 14px; }

.xr-foot-mid {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.xr-foot-mid .xr-nav { color: var(--ink); }
.xr-percent {
  font-size: 11px;
  color: var(--ink2);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  letter-spacing: .05em;
  flex: none;
}

.xr-progress {
  position: absolute;
  top: 58px; left: 0;
  height: 2px;
  width: 0%;
  background: var(--accent);
  z-index: 7;
  transition: width .12s linear, top .28s ease;
  pointer-events: none;
}
.xr-progress.top-hidden { top: 0; }

/* ---------- 设置 / 目录面板 ---------- */
.xr-scrim {
  position: absolute;
  inset: 0;
  background: rgba(10, 9, 7, .28);
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease;
  z-index: 8;
}
.xr-scrim.open { opacity: 1; pointer-events: auto; }

.xr-panel {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 336px;
  max-width: 88vw;
  background: var(--bg);
  border-left: 1px solid var(--line);
  box-shadow: var(--shadow);
  transform: translateX(102%);
  transition: transform .26s cubic-bezier(.2, .8, .2, 1);
  z-index: 9;
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.xr-panel.open { transform: translateX(0); }

.xr-panel-head {
  padding: 22px 22px 16px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.xr-panel-title {
  font-size: 15px;
  letter-spacing: .08em;
  margin: 0;
  color: var(--ink);
}
.xr-panel-close {
  appearance: none; border: 0; background: transparent;
  font-family: inherit; font-size: 12px; color: var(--ink2);
  cursor: pointer; padding: 4px 6px; border-radius: 4px;
}
.xr-panel-close:hover { color: var(--ink); background: var(--bg2); }

.xr-panel-body { flex: 1 1 auto; overflow-y: auto; padding: 6px 22px 28px; }
.xr-panel-body::-webkit-scrollbar { width: 8px; }
.xr-panel-body::-webkit-scrollbar-thumb { background: var(--line); border-radius: 6px; }

.xr-group { padding: 20px 0 18px; border-bottom: 1px solid var(--line); }
.xr-group:last-child { border-bottom: 0; }
.xr-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink);
  font-size: 13px;
  letter-spacing: .04em;
  margin-bottom: 13px;
}
.xr-label small { color: var(--ink2); font-size: 11px; letter-spacing: .02em; }

.xr-swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.xr-swatch {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 1px solid var(--line);
  cursor: pointer;
  position: relative;
  padding: 0;
  background: #fff;
}
.xr-swatch span { position: absolute; inset: 4px; border-radius: 50%; display: block; }
.xr-swatch.on { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--accent); }

.xr-stepper { display: flex; align-items: center; gap: 12px; }
.xr-step {
  appearance: none; border: 1px solid var(--line); background: var(--bg2);
  color: var(--ink); width: 44px; height: 30px; border-radius: 4px;
  padding: 0; white-space: nowrap;
  cursor: pointer; font-family: inherit; font-size: 15px; line-height: 1;
}
.xr-step:hover { border-color: var(--accent); color: var(--accent); }
.xr-step-val { min-width: 38px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; }

.xr-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 2px;
  background: var(--line);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.xr-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px; height: 15px; border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
  box-shadow: 0 1px 3px rgba(0,0,0,.18);
}

.xr-seg { display: flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
.xr-seg button {
  flex: 1 1 0;
  appearance: none; border: 0; background: transparent;
  font-family: inherit; font-size: 12px; color: var(--ink2);
  padding: 9px 0; cursor: pointer; letter-spacing: .06em;
}
.xr-seg button + button { border-left: 1px solid var(--line); }
.xr-seg button.on { background: var(--bg2); color: var(--ink); }

.xr-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0;
}
.xr-toggle-row .tx { color: var(--ink); font-size: 13px; }
.xr-toggle-row .tx small { display: block; color: var(--ink2); font-size: 11px; margin-top: 3px; letter-spacing: 0; }
.xr-switch {
  position: relative;
  width: 40px; height: 22px;
  flex: none;
  margin-left: 14px;
}
.xr-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.xr-switch .track {
  position: absolute; inset: 0;
  background: var(--line);
  border-radius: 11px;
  transition: background .18s ease;
  pointer-events: none;
}
.xr-switch .knob {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px;
  background: var(--bg);
  border-radius: 50%;
  transition: transform .18s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
  pointer-events: none;
}
.xr-switch input:checked + .track { background: var(--accent); }
.xr-switch input:checked ~ .knob { transform: translateX(18px); }

.xr-links { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.xr-link {
  appearance: none; border: 0; background: transparent;
  text-align: left; font-family: inherit; font-size: 13px;
  color: var(--ink); padding: 10px 8px; border-radius: 4px;
  cursor: pointer; letter-spacing: .02em;
}
.xr-link:hover { background: var(--bg2); }
.xr-link small { display: block; color: var(--ink2); font-size: 11px; margin-top: 3px; }

.xr-panel-foot {
  flex: none;
  border-top: 1px solid var(--line);
  padding: 14px 22px 18px;
  color: var(--ink2);
  font-size: 11px;
  line-height: 1.8;
  letter-spacing: .02em;
}

/* ---------- 目录列表 ---------- */
.xr-toc-meta {
  color: var(--ink2);
  font-size: 11px;
  letter-spacing: .04em;
  padding: 4px 4px 10px;
}
.xr-toc-list { padding: 4px 0; }
.xr-toc-item {
  display: block;
  width: 100%;
  text-align: left;
  appearance: none; border: 0; background: transparent;
  font-family: inherit; font-size: 13px; color: var(--ink);
  padding: 11px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-left: 2px solid transparent;
}
.xr-toc-item:hover { background: var(--bg2); }
.xr-toc-item.current { color: var(--accent); border-left-color: var(--accent); background: var(--bg2); }
.xr-toc-empty { color: var(--ink2); font-size: 12px; line-height: 1.9; padding: 14px 4px; }

/* ---------- 轻提示 / 自动连读 ---------- */
.xr-toast {
  position: absolute;
  left: 50%; bottom: 84px;
  transform: translate(-50%, 12px);
  background: var(--ink);
  color: var(--bg);
  font-size: 12px;
  letter-spacing: .04em;
  padding: 9px 16px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease, transform .22s ease;
  z-index: 10;
  max-width: 80vw;
  text-align: center;
  line-height: 1.6;
}
.xr-toast.show { opacity: .94; transform: translate(-50%, 0); }

.xr-autonext {
  position: absolute;
  right: 22px; bottom: 78px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  padding: 11px 14px;
  border-radius: 6px;
  z-index: 9;
  font-size: 12px;
  color: var(--ink);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity .2s ease, transform .2s ease;
}
.xr-autonext.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
.xr-autonext button {
  appearance: none; border: 0; background: transparent;
  color: var(--accent); font-family: inherit; font-size: 12px;
  cursor: pointer; padding: 4px 2px;
}

.xr-loading {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg); z-index: 11;
  color: var(--ink2); font-size: 13px; letter-spacing: .1em;
  transition: opacity .2s ease;
}
.xr-loading.hide { opacity: 0; pointer-events: none; }

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .xr-top { height: 52px; padding: 0 10px 0 14px; gap: 8px; }
  .xr-brand, .xr-sep-dot { display: none; }
  .xr-mark { width: 23px; height: 23px; font-size: 13px; }
  .xr-btn { width: 34px; height: 34px; }
  .xr-main { padding: 82px 20px 118px; }
  .xr-body p { margin-bottom: .5em; }
  .xr-foot { height: 58px; padding: 0 8px; gap: 6px; }
  .xr-nav { padding: 0 7px; font-size: 12px; }
  .xr-percent { display: none; }
  .xr-progress { top: 52px; }
  .xr-toast { bottom: 74px; }
  .xr-autonext { right: 12px; bottom: 68px; }
  .xr-panel { width: 100%; max-width: 100%; }
  .xr-head { margin-bottom: 28px; }
  .xr-main { max-width: 100%; }
}
@media (max-width: 380px) {
  .xr-main { padding-left: 16px; padding-right: 16px; }
  .xr-nav span { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .xr-top, .xr-foot, .xr-panel, .xr-toast, .xr-scrim, .xr-autonext { transition: none; }
}
`;

  /* 进入阅读模式前的轻提示 / 悬浮入口（同样是独立 Shadow 容器） */
  XN.PILL_CSS = `
:host { all: initial; }
.pill {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 2147483000;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #23201b;
  color: #faf7f0;
  font-family: "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif;
  font-size: 13px;
  letter-spacing: .04em;
  border-radius: 999px;
  padding: 9px 16px 9px 13px;
  box-shadow: 0 10px 28px rgba(20, 16, 10, .28);
  cursor: pointer;
  user-select: none;
  transition: transform .18s ease, box-shadow .18s ease;
  animation: pillIn .28s ease both;
}
.pill:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(20, 16, 10, .32); }
.pill svg { width: 15px; height: 15px; flex: none; opacity: .92; }
.pill .t { white-space: nowrap; }
.pill .close {
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: rgba(250,247,240,.55); font-size: 14px; line-height: 1;
  margin-left: 2px;
}
.pill .close:hover { color: #fff; background: rgba(255,255,255,.12); }
@keyframes pillIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
})();
