<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuickDictionary</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --surface: #1c1b1f;
      --surface-2: #211f26;
      --surface-3: #2b2930;
      --text: #e6e1e5;
      --text-muted: #cac4d0;
      --outline: #938f99;
      --outline-2: #49454f;
      --primary: #d0bcff;
      --primary-2: #4f378b;
      --error: #f2b8b5;
      --gold: #f2c94c;
      --radius-lg: 24px;
      --radius-md: 16px;
      --radius-sm: 12px;
      --shadow: 0 8px 24px rgba(0,0,0,.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 390px;
      min-height: 520px;
      max-height: 640px;
      background: var(--surface);
      color: var(--text);
      font-family: 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 18px 18px 12px;
      border-bottom: 1px solid var(--outline-2);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 22px;
      height: 22px;
      color: var(--primary);
      flex: 0 0 auto;
    }
    .title-wrap { flex: 1; min-width: 0; }
    .title {
      font-family: 'Roboto', sans-serif;
      font-size: 16px;
      font-weight: 600;
    }
    .subtitle {
      font-size: 12px;
      color: var(--outline);
      margin-top: 2px;
    }
    .tabs {
      display: flex;
      padding: 0 18px;
      border-bottom: 1px solid var(--outline-2);
      gap: 14px;
    }
    .tab {
      border: 0;
      background: none;
      color: var(--outline);
      padding: 12px 2px 10px;
      font: 500 13px 'Roboto', sans-serif;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }
    .tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .search-wrap {
      padding: 12px 16px 10px;
    }
    .search {
      width: 100%;
      border: 1px solid var(--outline-2);
      background: var(--surface-3);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 14px;
      outline: none;
      font: 13px 'Google Sans Text', sans-serif;
    }
    .list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0 10px;
    }
    .section-label {
      padding: 10px 18px 6px;
      color: var(--outline);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .6px;
      font-weight: 500;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      cursor: default;
    }
    .item:hover { background: rgba(255,255,255,.04); }
    .meta { flex: 1; min-width: 0; }
    .word {
      font: 500 14px 'Roboto', sans-serif;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .detail {
      margin-top: 2px;
      color: var(--outline);
      font-size: 11.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .detail .pos { color: var(--primary); font-style: italic; margin-right: 4px; }
    .time { color: var(--outline); font-size: 11px; flex: 0 0 auto; }
    .theme-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .theme-label { color: var(--outline); font-size: 12px; }
    .theme-switcher { display:flex; gap:8px; }
    .theme-btn { width:28px; height:28px; border-radius:50%; border:1px solid var(--outline-2); background:transparent; padding:0; display:grid; place-items:center; cursor:pointer; }
    .theme-btn.active { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent); }
    .logo { color: var(--primary); }
    .pos { color: var(--primary) !important; }
    .swatch { width:16px; height:16px; border-radius:50%; display:block; }
    .swatch.violet { background: linear-gradient(135deg, #d0bcff, #4f378b); }
    .swatch.teal { background: linear-gradient(135deg, #7ddbd1, #006a64); }
    .swatch.sunset { background: linear-gradient(135deg, #ffb59d, #b3261e); }
    .swatch.forest { background: linear-gradient(135deg, #a7d49b, #386a20); }
    body.theme-violet { --theme-accent:#d0bcff; --theme-accent-2:#4f378b; }
    body.theme-teal { --theme-accent:#7ddbd1; --theme-accent-2:#006a64; }
    body.theme-sunset { --theme-accent:#ffb59d; --theme-accent-2:#b3261e; }
    body.theme-forest { --theme-accent:#a7d49b; --theme-accent-2:#386a20; }
    .star {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--gold);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .star:hover { background: rgba(242,201,76,.12); }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px 14px;
      border-top: 1px solid var(--outline-2);
    }
    .btn {
      border: 1px solid var(--outline-2);
      background: transparent;
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      font: 500 12px 'Roboto', sans-serif;
    }
    .btn:hover { background: rgba(255,255,255,.05); color: var(--text); }
    .btn.danger:hover { color: var(--error); border-color: var(--error); background: rgba(242,184,181,.08); }
    .empty {
      min-height: 280px;
      display: grid;
      place-items: center;
      padding: 28px;
      text-align: center;
      color: var(--outline);
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="header">
    <svg class="logo" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"></path>
    </svg>
    <div class="title-wrap">
      <div class="title">QuickDictionary</div>
      <div class="subtitle">Your review list and lookup history</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-panel="history">History</button>
    <button class="tab" data-panel="saved">Saved</button>
  </div>

  <div class="search-wrap">
    <input id="search-input" class="search" type="search" placeholder="Filter words" autocomplete="off" />
  </div>

  <div id="word-list" class="list"></div>

  <div class="footer">
    <button id="clear-btn" class="btn danger">Clear list</button>
  </div>

  <script src="history.js"></script>
</body>
</html>
