document.addEventListener('DOMContentLoaded', () => {
  // 慣性スクロール
  class MomentumScroller {
    constructor(element) {
      this.el = element;
      this.currentY = 0;
      this.targetY = 0;
      this.ease = 0.08;
      this.isScrolling = false;
      this.rafId = null;

      this.onWheel = this.onWheel.bind(this);
      this.update = this.update.bind(this);

      this.el.addEventListener('wheel', this.onWheel, { passive: false });
    }

    onWheel(e) {
      e.preventDefault();

      if (!this.isScrolling) {
        this.currentY = this.el.scrollTop;
        this.targetY = this.el.scrollTop;
      }

      const delta = e.deltaY;
      this.targetY += delta;

      const maxScroll = this.el.scrollHeight - this.el.clientHeight;
      this.targetY = Math.max(0, Math.min(this.targetY, maxScroll));

      if (!this.isScrolling) {
        this.isScrolling = true;
        this.rafId = requestAnimationFrame(this.update);
      }
    }

    update() {
      if (!this.isScrolling) return;

      const diff = this.targetY - this.currentY;
      this.currentY += diff * this.ease;

      this.el.scrollTop = this.currentY;

      // 目標値に近づいたらスクロール終了
      if (Math.abs(diff) < 0.5) {
        this.currentY = this.targetY;
        this.el.scrollTop = this.targetY;
        this.isScrolling = false;
        cancelAnimationFrame(this.rafId);
      } else {
        this.rafId = requestAnimationFrame(this.update);
      }
    }
    
    // 状態リセット
    refresh() {
      this.currentY = this.el.scrollTop;
      this.targetY = this.el.scrollTop;
      this.isScrolling = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }
  }

  // DOM要素のキャッシュ
  const els = {
    slider: document.getElementById('volume-slider'),
    display: document.getElementById('volume-value'),
    themeToggle: document.getElementById('theme-toggle'),
    langToggle: document.getElementById('lang-toggle'),
    langText: document.getElementById('lang-text'),
    titleText: document.getElementById('title-text'),
    resetBtn: document.getElementById('reset-btn'),
    labelLevel: document.getElementById('label-level'),
    navCurrent: document.getElementById('nav-current'),
    navList: document.getElementById('nav-list'),
    navDomains: document.getElementById('nav-domains'),
    secCurrent: document.getElementById('section-current'),
    secList: document.getElementById('section-list'),
    secDomains: document.getElementById('section-domains'),
    listContainer: document.getElementById('audio-list-container'),
    domainListContainer: document.getElementById('domain-list-container'),
    domainInput: document.getElementById('domain-input'),
    addDomainBtn: document.getElementById('add-domain-btn')
  };

  // アプリバージョンの表示
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = chrome.runtime.getManifest().version;
  }

  // スクロールインスタンスの作成
  const listScroller = new MomentumScroller(els.listContainer);
  const domainScroller = new MomentumScroller(els.domainListContainer);

  const knownKeys = new Set();
  const MAX_SAVED_ITEMS = 500; // 保存する最大エントリー数
  let isAccordionOpen = false;

  // SVG定義
  const GLOBE_ICON_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
  const CHEVRON_ICON_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  const RESET_ICON_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
  const CLOSE_ICON_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  // 言語データ
  const i18n = (typeof i18nData !== 'undefined') ? i18nData : {
    en: { 
      title: "Volume Control", reset: "Reset", tabCurrent: "Current", tabList: "Tabs", tabDomains: "Defaults", 
      empty: "No tabs found", emptyDomains: "No default settings saved", placeholder: "example.com", 
      hiddenTitle: "Hidden Tabs", level: "Level", currentTag: "(Current)" 
    },
    ja: { 
      title: "音量コントロール", reset: "リセット", tabCurrent: "現在のタブ", tabList: "タブ一覧", tabDomains: "デフォルト設定", 
      empty: "タブが見つかりません", emptyDomains: "保存されたデフォルト設定はありません", placeholder: "example.com", 
      hiddenTitle: "非表示のタブ", level: "レベル", currentTag: "(現在のタブ)" 
    }
  };
  
  let currentLang = localStorage.getItem('lang') || 'en';

  // スクロールアニメーションの監視
  function attachScrollObserver(containerElement) {
    const options = {
      root: containerElement,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, index * 40); 
          obs.unobserve(entry.target);
        }
      });
    }, options);

    const items = containerElement.querySelectorAll('.scroll-anim-item:not(.is-visible)');
    items.forEach(item => observer.observe(item));
  }

  function getIconHtml(url) {
    if (url) {
      return `<img src="${url}">`;
    } else {
      return `<div class="default-icon">${GLOBE_ICON_SVG}</div>`;
    }
  }

  function getSmallIconHtml(url) {
    if (url) {
      return `<img src="${url}" style="width:16px;height:16px;object-fit:contain;border-radius:2px;">`;
    } else {
      return `<div style="width:16px;height:16px;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;">${GLOBE_ICON_SVG}</div>`;
    }
  }

  // 言語の更新
  function updateLangUI() {
    els.langText.textContent = currentLang.toUpperCase();
    els.titleText.textContent = i18n[currentLang].title;
    els.resetBtn.textContent = i18n[currentLang].reset;
    els.navCurrent.textContent = i18n[currentLang].tabCurrent;
    els.navList.textContent = i18n[currentLang].tabList;
    els.navDomains.textContent = i18n[currentLang].tabDomains;
    els.domainInput.placeholder = i18n[currentLang].placeholder;

    if (els.labelLevel) {
      els.labelLevel.textContent = i18n[currentLang].level;
    }

    localStorage.setItem('lang', currentLang);
  }

  // 言語切り替えイベント
  els.langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'ja' : 'en';
    updateLangUI();
    if (!els.secList.classList.contains('hidden')) renderAudioList();
    if (!els.secDomains.classList.contains('hidden')) renderDomainList();
  });

  // テーマ設定
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.documentElement.classList.add('dark-mode');
  
  els.themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
  });

  // タブ切り替え処理
  function switchTab(target) {
    [els.navCurrent, els.navList, els.navDomains].forEach(btn => btn.classList.remove('active'));
    [els.secCurrent, els.secList, els.secDomains].forEach(sec => sec.classList.add('hidden'));
    
    if (target === 'current') {
      els.navCurrent.classList.add('active');
      els.secCurrent.classList.remove('hidden');
    } else if (target === 'list') {
      els.navList.classList.add('active');
      els.secList.classList.remove('hidden');
      listScroller.refresh();
      renderAudioList();
    } else if (target === 'domains') {
      els.navDomains.classList.add('active');
      els.secDomains.classList.remove('hidden');
      domainScroller.refresh();
      renderDomainList();
    }
  }

  els.navCurrent.addEventListener('click', () => switchTab('current'));
  els.navList.addEventListener('click', () => switchTab('list'));
  els.navDomains.addEventListener('click', () => switchTab('domains'));

  // スライダー表示更新
  function updateSliderUI(value) {
    els.slider.value = value;
    els.display.textContent = value;
  }

  // URLからキー（オリジン、フルパス）を生成
  function getUrlKeys(url) {
    try { 
      const rawUrl = decodeURIComponent(url);
      const u = new URL(rawUrl);
      return {
        origin: u.origin,                             
        full: u.origin + u.pathname + u.search        
      };
    } catch(e) { return null; }
  }

  // 保存データからボリューム値を抽出
  function extractVolume(item) {
    if (typeof item === 'number') return item;
    if (item && typeof item.val === 'number') return item.val;
    return 1.0;
  }

  // ストレージから既知のキーを読み込む
  function loadKnownKeys(callback) {
    knownKeys.clear();
    chrome.storage.local.get(null, (items) => {
      Object.keys(items).forEach(key => {
        if (key.startsWith('vol_http')) {
          knownKeys.add(key.replace('vol_', ''));
        }
      });
      if (callback) callback();
    });
  }

  // 非表示リストの取得
  function getHiddenUrls() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['hiddenUrls'], (result) => {
        resolve(result.hiddenUrls || []);
      });
    });
  }

  // 非表示リストの切り替え
  function toggleHiddenUrl(url, shouldHide) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['hiddenUrls'], (result) => {
        let list = result.hiddenUrls || [];
        if (shouldHide) {
          if (!list.includes(url)) list.push(url);
        } else {
          list = list.filter(u => u !== url);
        }
        chrome.storage.local.set({ hiddenUrls: list }, resolve);
      });
    });
  }

  // 音量保存
  function saveVolumeWithLimit(keySuffix, value) {
    const key = `vol_${keySuffix}`;
    const multiplier = parseFloat(value) / 100;
    const newData = { val: multiplier, ts: Date.now() };

    chrome.storage.local.get(null, (items) => {
      const allKeys = Object.keys(items).filter(k => k.startsWith('vol_'));
      const isNew = !items[key];

      if (isNew && allKeys.length >= MAX_SAVED_ITEMS) {
        // 古いエントリを削除
        let oldestKey = null;
        let minTs = Infinity;
        allKeys.forEach(k => {
          const item = items[k];
          const ts = (typeof item === 'object' && item.ts) ? item.ts : 0;
          if (ts < minTs) {
            minTs = ts;
            oldestKey = k;
          }
        });
        if (oldestKey) {
          chrome.storage.local.remove(oldestKey, () => {
             chrome.storage.local.set({ [key]: newData });
             knownKeys.delete(oldestKey.replace('vol_', ''));
             knownKeys.add(keySuffix);
          });
          return;
        }
      }

      chrome.storage.local.set({ [key]: newData }, () => {
        knownKeys.add(keySuffix);
      });
    });
  }

  // タブへボリューム変更コマンドを送信
  function sendVolumeCommand(tab, value, shouldSave = false) {
    const multiplier = value / 100;
    
    chrome.tabs.sendMessage(tab.id, { action: "setVolume", value: multiplier })
      .catch(() => {
        // コンテンツスクリプトがロードされていない場合は注入を試みる
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {}); 
      });

    if (shouldSave) {
      const keys = getUrlKeys(tab.url);
      if (keys) {
        saveVolumeWithLimit(keys.full, value);
      }
    }
  }

  // タブから現在のボリューム値を取得
  function getTabVolume(tabId) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 500);
      chrome.tabs.sendMessage(tabId, { action: "getVolume" }, (response) => {
        clearTimeout(timeoutId);
        if (!chrome.runtime.lastError && response && response.value !== undefined) {
          resolve(Math.round(response.value * 100));
        } else {
          resolve(null);
        }
      });
    });
  }

  // 初期化処理
  loadKnownKeys(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if(!tabs[0]) return;
      const tab = tabs[0];
      const keys = getUrlKeys(tab.url);

      let displayVal = 100;
      let defaultVal = null;

      // 保存された設定があるか確認
      if (keys) {
        const specificKey = `vol_${keys.full}`;
        const originKey = `vol_${keys.origin}`;
        
        const result = await chrome.storage.local.get([specificKey, originKey]);
        
        if (result[specificKey] !== undefined) {
          defaultVal = Math.round(extractVolume(result[specificKey]) * 100);
        } else if (result[originKey] !== undefined) {
          defaultVal = Math.round(extractVolume(result[originKey]) * 100);
        }
      }

      const realVol = await getTabVolume(tab.id);

      if (realVol !== null && realVol !== 100) {
        displayVal = realVol;
      } else if (defaultVal !== null && defaultVal !== 100) {
        displayVal = defaultVal;
        sendVolumeCommand(tab, displayVal, false);
      } else if (realVol !== null) {
        displayVal = realVol;
      }
      
      updateSliderUI(displayVal);
    });
  });

  // リアルタイムスライダーイベント
  els.slider.addEventListener('input', (e) => {
    const val = e.target.value;
    els.display.textContent = val;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if(tabs[0]) sendVolumeCommand(tabs[0], val, false);
    });
  });

  // スライダー確定イベント
  els.slider.addEventListener('change', (e) => {
    const val = e.target.value;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if(tabs[0]) sendVolumeCommand(tabs[0], val, true);
    });
  });

  // リセットボタン
  els.resetBtn.addEventListener('click', () => {
    updateSliderUI(100);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if(tabs[0]) sendVolumeCommand(tabs[0], 100, true);
    });
  });

  // タブ一覧リストのレンダリング
  function renderAudioList() {
    els.listContainer.innerHTML = '';
    loadKnownKeys(() => {
      chrome.tabs.query({ currentWindow: true }, async (allTabs) => {
        const validTabs = allTabs.filter(t => t.url && !t.url.startsWith('chrome://'));
        
        if (validTabs.length === 0) {
          els.listContainer.innerHTML = `<div class="empty-state"><p class="empty-msg">${i18n[currentLang].empty}</p></div>`;
          return;
        }

        const storageData = await chrome.storage.local.get(null);
        const hiddenUrls = await getHiddenUrls();

        const tabPromises = validTabs.map(async (tab) => {
          const keys = getUrlKeys(tab.url);
          let savedVol = null;

          if (keys) {
             const specificV = storageData[`vol_${keys.full}`];
             const originV = storageData[`vol_${keys.origin}`];
             
             if (specificV !== undefined) savedVol = Math.round(extractVolume(specificV) * 100);
             else if (originV !== undefined) savedVol = Math.round(extractVolume(originV) * 100);
          }

          const realVol = await getTabVolume(tab.id);
          let finalVol = 100;
          if (realVol !== null) finalVol = realVol;
          else if (savedVol !== null) finalVol = savedVol;

          return { tab, finalVol };
        });

        let tabsWithVol = await Promise.all(tabPromises);

        // ソート順 (音が出ている > アクティブ > インデックス順)
        tabsWithVol.sort((a, b) => {
          const tA = a.tab, tB = b.tab;
          if (tA.audible && !tB.audible) return -1;
          if (!tA.audible && tB.audible) return 1;
          if (tA.active && !tB.active) return -1;
          if (!tA.active && tB.active) return 1;
          return tA.index - tB.index;
        });

        const visibleTabs = tabsWithVol.filter(item => !hiddenUrls.includes(item.tab.url));
        const hiddenTabs = tabsWithVol.filter(item => hiddenUrls.includes(item.tab.url));

        visibleTabs.forEach(({ tab, finalVol }) => {
          const item = document.createElement('div');
          item.className = 'tab-item scroll-anim-item';
          const iconHtml = getIconHtml(tab.favIconUrl);
          
          let badges = tab.active ? `<span style="font-size:10px; opacity:0.6; margin-left:4px;">${i18n[currentLang].currentTag}</span>` : '';
          if (tab.audible) badges += `<span style="margin-left:auto;">🔊</span>`;
          const titleStyle = (tab.active || tab.audible) ? 'font-weight:600; color:var(--text-primary);' : 'color:var(--text-secondary);';

          item.innerHTML = `
            <div class="tab-header">
              <div class="tab-icon">${iconHtml}</div>
              <div class="tab-title" title="${tab.title}" style="${titleStyle}">${tab.title}${badges}</div>
              <div class="tab-actions">
                <button class="reset-tab-btn" title="${i18n[currentLang].reset}">${RESET_ICON_SVG}</button>
                <button class="hide-tab-btn" title="Hide">${CLOSE_ICON_SVG}</button>
              </div>
            </div>
            <div class="tab-slider-row">
              <input type="range" class="tab-slider" min="0" max="400" value="${finalVol}">
              <span class="tab-val">${finalVol}%</span>
            </div>
          `;
          els.listContainer.appendChild(item);

          const slider = item.querySelector('.tab-slider');
          const valDisplay = item.querySelector('.tab-val');
          const hideBtn = item.querySelector('.hide-tab-btn');
          const resetBtn = item.querySelector('.reset-tab-btn');

          slider.addEventListener('input', (e) => {
            const v = e.target.value;
            valDisplay.textContent = v + '%';
            sendVolumeCommand(tab, v, false);
            if (tab.active) updateSliderUI(v);
          });

          slider.addEventListener('change', (e) => {
            const v = e.target.value;
            sendVolumeCommand(tab, v, true);
          });

          resetBtn.addEventListener('click', () => {
             const defaultVal = 100;
             slider.value = defaultVal;
             valDisplay.textContent = defaultVal + '%';
             sendVolumeCommand(tab, defaultVal, true);
             if (tab.active) updateSliderUI(defaultVal);
          });

          hideBtn.addEventListener('click', async () => {
            await toggleHiddenUrl(tab.url, true);
            renderAudioList();
          });
        });

        if (visibleTabs.length === 0 && hiddenTabs.length === 0) {
           els.listContainer.innerHTML = `<div class="empty-state"><p class="empty-msg">${i18n[currentLang].empty}</p></div>`;
        }

        // 非表示タブがある場合はアコーディオンを表示
        if (hiddenTabs.length > 0) {
          const accContainer = document.createElement('div');
          accContainer.className = 'accordion-container';
          
          const hiddenTitle = i18n[currentLang].hiddenTitle || "Hidden Tabs";
          const header = document.createElement('button');
          header.className = `accordion-header ${isAccordionOpen ? 'active' : ''}`;
          header.innerHTML = `<span>${hiddenTitle} (${hiddenTabs.length})</span><span class="accordion-icon">${CHEVRON_ICON_SVG}</span>`;
          
          const content = document.createElement('div');
          content.className = `accordion-content ${isAccordionOpen ? 'open' : ''}`;
          
          if (isAccordionOpen) {
            content.style.height = 'auto';
            content.style.opacity = '1';
            content.style.marginTop = '8px';
          }
          
          hiddenTabs.forEach(({ tab }) => {
            const row = document.createElement('div');
            row.className = 'hidden-tab-item scroll-anim-item';
            const smallIconHtml = getSmallIconHtml(tab.favIconUrl);

            row.innerHTML = `
              <div style="display:flex;align-items:center;gap:8px;overflow:hidden;">
                ${smallIconHtml}
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tab.title}</span>
              </div>
              <button class="restore-btn" title="Restore">＋</button>
            `;
            
            row.querySelector('.restore-btn').addEventListener('click', async () => {
              await toggleHiddenUrl(tab.url, false);
              renderAudioList();
            });
            content.appendChild(row);
          });

          // アコーディオン開閉ロジック
          header.addEventListener('click', () => {
            isAccordionOpen = !isAccordionOpen;
            header.classList.toggle('active');
            
            if (isAccordionOpen) {
              content.classList.add('open');
              const height = content.scrollHeight;
              content.style.height = '0px';
              
              requestAnimationFrame(() => {
                  content.style.height = height + 'px';
                  content.style.opacity = '1';
                  content.style.marginTop = '8px';
              });
              
              content.addEventListener('transitionend', function setAuto() {
                  if(isAccordionOpen) content.style.height = 'auto';
              }, { once: true });
              
            } else {
              const height = content.scrollHeight;
              content.style.height = height + 'px';
              content.style.opacity = '1';
              content.style.marginTop = '8px';
              
              content.offsetHeight;
              
              requestAnimationFrame(() => {
                  content.classList.remove('open');
                  content.style.height = '0px';
                  content.style.opacity = '0';
                  content.style.marginTop = '0';
              });
            }
          });

          accContainer.appendChild(header);
          accContainer.appendChild(content);
          els.listContainer.appendChild(accContainer);
        }

        // アニメーション用オブザーバーのアタッチ
        requestAnimationFrame(() => {
          attachScrollObserver(els.listContainer);
        });
      });
    });
  }

  // ドメイン設定リストのレンダリング
  function renderDomainList() {
    els.domainListContainer.innerHTML = '';
    loadKnownKeys(() => {
      chrome.storage.local.get(null, (items) => {
        // オリジンのみの設定を抽出
        const keys = Object.keys(items).filter(k => {
          if (!k.startsWith('vol_http')) return false;
          const urlStr = k.replace('vol_', '');
          try {
            return urlStr === new URL(urlStr).origin;
          } catch(e) { return false; }
        });
        
        if (keys.length === 0) {
          els.domainListContainer.innerHTML = `<div class="empty-state"><p class="empty-msg">${i18n[currentLang].emptyDomains}</p></div>`;
          return;
        }

        keys.sort();

        keys.forEach(key => {
          const urlStr = key.replace('vol_', '');
          const raw = items[key];
          const val = Math.round(extractVolume(raw) * 100);
          
          let displayName = urlStr;
          try { displayName = new URL(urlStr).hostname; } catch(e){}

          const item = document.createElement('div');
          item.className = 'domain-item scroll-anim-item';
          
          item.innerHTML = `
            <div class="domain-header">
              <span class="domain-title" title="${urlStr}">${displayName}</span>
              <button class="delete-btn" title="Remove">${CLOSE_ICON_SVG}</button>
            </div>
            <div class="tab-slider-row">
              <input type="range" class="domain-slider" min="0" max="400" value="${val}">
              <span class="tab-val">${val}%</span>
            </div>
          `;
          els.domainListContainer.appendChild(item);

          const slider = item.querySelector('.domain-slider');
          const valDisplay = item.querySelector('.tab-val');
          
          slider.addEventListener('input', (e) => {
            valDisplay.textContent = e.target.value + '%';
          });

          slider.addEventListener('change', (e) => { 
            const v = e.target.value;
            saveVolumeWithLimit(urlStr, v);
            syncTabsByKey(urlStr, v / 100);
          });
          
          item.querySelector('.delete-btn').addEventListener('click', () => {
            chrome.storage.local.remove(key, () => {
               knownKeys.delete(urlStr);
               syncTabsByKey(urlStr, 1.0);
               renderDomainList();
               chrome.tabs.query({active:true, currentWindow:true}, (tabs)=>{
                 if(tabs[0]) updateSliderUI(100);
               });
            });
          });
        });

        requestAnimationFrame(() => {
          attachScrollObserver(els.domainListContainer);
        });
      });
    });
  }

  // 設定変更を現在開いている該当タブに同期
  function syncTabsByKey(changedKey, multiplier) {
    chrome.tabs.query({}, async (tabs) => {
      const storageData = await chrome.storage.local.get(null);
      tabs.forEach(t => {
        const k = getUrlKeys(t.url);
        if (!k) return;
        
        if (k.full === changedKey) {
           chrome.tabs.sendMessage(t.id, { action: "setVolume", value: multiplier }).catch(()=>{});
        }
        else if (k.origin === changedKey) {
           const specificKey = `vol_${k.full}`;
           // 個別設定がない場合のみドメイン設定を適用
           if (storageData[specificKey] === undefined) {
             chrome.tabs.sendMessage(t.id, { action: "setVolume", value: multiplier }).catch(()=>{});
           }
        }
      });
    });
  }

  // ドメイン手動追加
  els.addDomainBtn.addEventListener('click', () => {
    const input = els.domainInput.value.trim();
    if (!input) return;
    let urlStr = input;
    if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
    
    try {
      const u = new URL(urlStr);
      const originKey = u.origin; 
      saveVolumeWithLimit(originKey, 100);
      els.domainInput.value = '';
      setTimeout(renderDomainList, 100);
    } catch(e) {
      alert("Invalid domain or URL");
    }
  });

  updateLangUI();
});