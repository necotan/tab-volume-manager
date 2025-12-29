(function() {
  // 多重注入防止
  if (window.__volumeBoosterActive) return;
  window.__volumeBoosterActive = true;

  let audioCtx;
  let gainNode;
  const connectedElements = new WeakSet();
  let currentMultiplier = 1.0;
  let isWaitingForInteraction = false;

  // AudioContextとGainNodeの初期化
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
      gainNode.gain.value = currentMultiplier;
    } 

    if (audioCtx.state === 'suspended') {
      waitForUserInteraction();
    }
  }

  // ユーザー操作を待つ
  function waitForUserInteraction() {
    if (isWaitingForInteraction) return;
    isWaitingForInteraction = true;

    const resumeOnAction = () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
            document.removeEventListener(evt, resumeOnAction, true)
          );
          isWaitingForInteraction = false;
        }).catch((e) => {
          // エラーハンドリング
        });
      }
    };

    ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
      document.addEventListener(evt, resumeOnAction, true)
    );
  }

  // メディア要素をAudioContextに接続
  function attachToMedia(element) {
    if (connectedElements.has(element)) return;
    try {
      // CORS設定
      if (!element.crossOrigin && element.src && !element.src.startsWith('blob:') && !element.src.startsWith('data:')) {
         element.crossOrigin = "anonymous";
      }
      
      initAudioContext();
      
      const source = audioCtx.createMediaElementSource(element);
      source.connect(gainNode);
      connectedElements.add(element);
    } catch (e) {
      // 既に接続されている場合やセキュリティエラーなど
    }
  }

  // DOMの変化を監視し、動的に追加されたvideo/audioタグにも適用
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') attachToMedia(node);
        if (node.querySelectorAll) node.querySelectorAll('video, audio').forEach(attachToMedia);
        if (node.shadowRoot) observeShadow(node.shadowRoot);
      });
    });
  });

  function observeShadow(root) {
    observer.observe(root, { childList: true, subtree: true });
    root.querySelectorAll('video, audio').forEach(attachToMedia);
  }

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 既存のShadow DOM内もスキャン
  function scanAllShadows(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while(walker.nextNode()) {
      const node = walker.currentNode;
      if (node.shadowRoot) observeShadow(node.shadowRoot);
    }
  }
  scanAllShadows(document.documentElement);

  // Content Scriptからのメッセージ受信
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    
    // 音量設定
    if (event.data && event.data.type === "VOLUME_BOOSTER_SET") {
      currentMultiplier = event.data.value;
      if (gainNode) {
        gainNode.gain.value = currentMultiplier;
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        waitForUserInteraction();
      }
    }

    // 現在の音量値を返却
    if (event.data && event.data.type === "VOLUME_BOOSTER_GET_REQUEST") {
      window.postMessage({ 
        type: "VOLUME_BOOSTER_GET_RESPONSE", 
        value: currentMultiplier 
      }, "*");
    }
  });

  // createElementをフックして、作成時にcrossOriginを設定
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const el = originalCreateElement.call(document, tagName, options);
    if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
      el.crossOrigin = "anonymous";
    }
    return el;
  };
})();