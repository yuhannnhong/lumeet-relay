'use strict';
const platformRoot = document.documentElement;
const requestedPlatform = platformRoot.dataset.platform;
const lumeetPlatform =
  requestedPlatform === 'ios' || requestedPlatform === 'android'
    ? requestedPlatform
    : /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
      ? 'ios'
      : /Android/.test(navigator.userAgent)
        ? 'android'
        : 'web';
platformRoot.dataset.platform = lumeetPlatform;
// 版本：home 是我們自己用的；pure 是給別人的純淨版（打包時 build-web.mjs --pure 換掉），預設不帶我們的名字和照片
const LUMEET_EDITION = 'pure';
const PURE = LUMEET_EDITION === 'pure';
function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    toast('瀏覽器未能儲存，請確認可用空間與網站設定');
    return false;
  }
}
function keyboardOffset(layoutHeight, visualHeight, visualTop, focused) {
  const overlap = Math.max(0, layoutHeight - visualHeight - visualTop);
  return focused && overlap > 150 ? Math.round(overlap) : 0;
}
function updateViewport() {
  const viewport = window.visualViewport;
  const focused = !!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  const offset = viewport
    ? keyboardOffset(window.innerHeight, viewport.height, viewport.offsetTop, focused)
    : 0;
  platformRoot.style.setProperty('--keyboard-offset', offset + 'px');
  platformRoot.style.setProperty(
    '--visible-height',
    (viewport ? viewport.height : window.innerHeight) + 'px',
  );
  platformRoot.classList.toggle(
    'keyboard-open',
    focused && (offset > 0 || window.innerHeight < screen.height * 0.7),
  );
}
window.addEventListener('resize', updateViewport);
window.addEventListener('pageshow', updateViewport);
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
document.addEventListener('focusin', updateViewport);
document.addEventListener('focusout', () => requestAnimationFrame(updateViewport));
updateViewport();
function sendNativeExport(format, text) {
  if (lumeetPlatform !== 'android') return false;
  if (!window.LumeetNative) {
    if (location.hostname === 'appassets.androidplatform.net') {
      toast('請更新系統 WebView 後再匯出');
      return true;
    }
    return false;
  }
  window.LumeetNative.postMessage(JSON.stringify({ type: 'export', format, text }));
  return true;
}
const LUMEET_VERSION = '2.0.88';
function platformVersionRow() {
  return `<button class="theme-entry glass row" data-action="platform-info">${icon('phone')}${lumeetPlatform === 'ios' ? 'iOS Safari 版' : lumeetPlatform === 'android' ? 'Android 專用版' : '跨平台網頁版'}<small class="muted" style="margin-left:auto">版本 ${LUMEET_VERSION}</small>${icon('chevron')}</button>`;
}
