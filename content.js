const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);

const rawUrl = decodeURIComponent(window.location.href);
const urlObj = new URL(rawUrl);
const domainKey = `vol_${urlObj.origin}`; 
const specificKey = `vol_${urlObj.origin}${urlObj.pathname}${urlObj.search}`;

// 初期ロード時の設定読み込みと適用
chrome.storage.local.get([domainKey, specificKey], (result) => {
  let targetData = result[specificKey] || result[domainKey];

  let savedVol = 1.0;
  if (targetData) {
    if (typeof targetData === 'object' && targetData.val !== undefined) {
      savedVol = targetData.val;
    } else if (typeof targetData === 'number') {
      savedVol = targetData;
    }
  }

  if (savedVol !== 1.0) {
    // スクリプト注入のタイミングを考慮して遅延を入れる
    setTimeout(() => {
      window.postMessage({ type: "VOLUME_BOOSTER_SET", value: savedVol }, "*");
    }, 100);
  }
});

// ポップアップからのメッセージを受信し、inject.jsへ転送
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setVolume") {
    window.postMessage({ type: "VOLUME_BOOSTER_SET", value: request.value }, "*");
  }
  
  if (request.action === "getVolume") {
    const responseHandler = (event) => {
      if (event.source === window && event.data.type === "VOLUME_BOOSTER_GET_RESPONSE") {
        window.removeEventListener("message", responseHandler);
        sendResponse({ value: event.data.value });
      }
    };
    window.addEventListener("message", responseHandler);
    window.postMessage({ type: "VOLUME_BOOSTER_GET_REQUEST" }, "*");
    return true; // 非同期レスポンスを示す
  }
});