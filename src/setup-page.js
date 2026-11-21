export function renderSetupPage({ token }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="setup-token" content="${token}">
  <title>agent-connector 配置台</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #e9f5ef;
      --muted: #9eb5ac;
      --dim: #698178;
      --base: #071310;
      --panel: #0d1d19;
      --panel-2: #112721;
      --line: #234139;
      --accent: #65e6bd;
      --accent-ink: #032a20;
      --warn: #f4bd67;
      --danger: #ff8c86;
      --radius: 18px;
      --font-ui: "Bahnschrift", "Microsoft YaHei UI", sans-serif;
      --font-code: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      color: var(--ink);
      background:
        radial-gradient(circle at 70% -15%, rgba(101, 230, 189, .12), transparent 34%),
        linear-gradient(145deg, #06100e 0%, var(--base) 46%, #091713 100%);
      font-family: var(--font-ui);
      line-height: 1.55;
    }

    button, input, select, textarea { font: inherit; }
    button { cursor: pointer; }
    a { color: var(--accent); }

    .shell {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      min-height: 100vh;
    }

    .rail {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 28px 22px;
      border-right: 1px solid var(--line);
      background: rgba(7, 19, 16, .82);
      backdrop-filter: blur(14px);
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 38px;
      height: 38px;
      border: 1px solid rgba(101, 230, 189, .5);
      border-radius: 50%;
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 20px rgba(101, 230, 189, .12);
    }
    .brand-mark::before {
      content: "";
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 18px var(--accent);
    }
    .brand-name { font-size: 17px; letter-spacing: .04em; }
    .brand-sub { color: var(--dim); font-size: 12px; }

    .rail-nav { display: grid; gap: 6px; }
    .rail-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
    }
    .rail-link:hover, .rail-link:focus-visible { background: var(--panel); color: var(--ink); }
    .rail-link::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--line); }
    .rail-link.active { color: var(--ink); background: var(--panel); }
    .rail-link.active::before { background: var(--accent); box-shadow: 0 0 12px var(--accent); }

    .runtime {
      margin-top: auto;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: linear-gradient(160deg, rgba(17, 39, 33, .9), rgba(9, 24, 20, .9));
      font-family: var(--font-code);
      font-size: 12px;
    }
    .runtime-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
    .runtime-label { color: var(--dim); }
    .online { color: var(--accent); }

    main { width: min(1160px, 100%); margin: 0 auto; padding: 48px clamp(20px, 5vw, 64px) 120px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(260px, .7fr); gap: 32px; align-items: end; margin-bottom: 38px; }
    h1 { margin: 0 0 14px; font-size: clamp(34px, 4.6vw, 62px); line-height: 1.05; letter-spacing: -.03em; font-weight: 540; max-width: 760px; }
    .lede { color: var(--muted); font-size: 17px; max-width: 680px; margin: 0; }
    .boundary {
      border-left: 1px solid var(--accent);
      padding: 4px 0 4px 18px;
      color: var(--muted);
      font-family: var(--font-code);
      font-size: 12px;
    }
    .boundary strong { display: block; margin-bottom: 7px; color: var(--ink); font-family: var(--font-ui); font-size: 14px; font-weight: 500; }

    .section { margin-top: 30px; }
    .section-heading { display: flex; justify-content: space-between; gap: 20px; align-items: baseline; margin-bottom: 14px; }
    h2 { margin: 0; font-size: 20px; font-weight: 530; letter-spacing: -.01em; }
    .section-note { margin: 0; color: var(--dim); font-size: 13px; }

    .quick-start {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 20px;
    }
    .quick-step {
      min-width: 0;
      padding: 10px 11px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(5, 15, 12, .5);
      color: var(--muted);
      font-size: 12px;
    }
    .quick-step b { display: block; margin-bottom: 2px; color: var(--accent); font-family: var(--font-code); font-size: 11px; font-weight: 500; }

    .panel {
      background: linear-gradient(155deg, rgba(17, 39, 33, .94), rgba(11, 28, 23, .94));
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: clamp(18px, 3vw, 28px);
      box-shadow: 0 24px 80px rgba(0, 0, 0, .18);
    }

    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .field { display: grid; gap: 7px; }
    .field.wide { grid-column: 1 / -1; }
    label { color: var(--muted); font-size: 13px; }
    .hint { color: var(--dim); font-size: 12px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      color: var(--ink);
      background: rgba(5, 15, 12, .72);
      padding: 11px 12px;
      outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(101, 230, 189, .1); }
    input::placeholder, textarea::placeholder { color: #526d63; }
    textarea { resize: vertical; min-height: 78px; }
    .secret-state { color: var(--accent); font-size: 12px; }

    .toggle-line { display: flex; align-items: flex-start; gap: 10px; padding-top: 6px; }
    .toggle-line input { width: 16px; height: 16px; margin-top: 3px; accent-color: var(--accent); }
    .toggle-copy { display: grid; gap: 2px; }

    .agent-list { display: grid; gap: 14px; }
    .agent-card { border: 1px solid var(--line); border-radius: 14px; padding: 18px; background: rgba(7, 19, 16, .62); }
    .agent-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
    .agent-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .agent-id { font-family: var(--font-code); font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
    .badge { border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 3px 9px; font-size: 11px; white-space: nowrap; }
    .badge.readonly { color: var(--accent); border-color: rgba(101, 230, 189, .35); }
    .agent-actions { display: flex; gap: 8px; }
    .agent-card .grid-2 { gap: 13px; }
    .agent-card .field.wide { grid-column: auto; }
    .agent-card .footer-error { color: var(--danger); font-size: 12px; margin-top: 9px; white-space: pre-wrap; }

    .button-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .button {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 9px 13px;
      color: var(--ink);
      background: rgba(17, 39, 33, .78);
    }
    .button:hover { border-color: #386458; background: var(--panel-2); }
    .button.primary { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); font-weight: 650; }
    .button.primary:hover { filter: brightness(1.06); }
    .button.quiet { background: transparent; color: var(--muted); }
    .button.danger { color: var(--danger); }
    .button:disabled { opacity: .48; cursor: wait; }

    .test-strip { display: flex; align-items: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
    .test-result { color: var(--muted); font-family: var(--font-code); font-size: 12px; white-space: pre-wrap; flex: 1; min-width: 220px; }
    .test-result.ok { color: var(--accent); }
    .test-result.error { color: var(--danger); }

    .save-dock {
      position: fixed;
      left: 260px;
      right: 0;
      bottom: 0;
      padding: 13px clamp(20px, 5vw, 64px);
      border-top: 1px solid var(--line);
      background: rgba(7, 19, 16, .9);
      backdrop-filter: blur(18px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      z-index: 10;
    }
    .save-message { color: var(--muted); font-size: 13px; min-width: 0; }
    .save-message.error { color: var(--danger); }
    .save-message.ok { color: var(--accent); }

    .start-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; }
    .command { margin-top: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: #05100d; font-family: var(--font-code); color: var(--accent); overflow-x: auto; }

    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .toast { position: fixed; right: 22px; top: 22px; max-width: min(420px, calc(100vw - 44px)); padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: #132b24; color: var(--ink); box-shadow: 0 20px 60px rgba(0, 0, 0, .35); transform: translateY(-12px); opacity: 0; pointer-events: none; transition: .2s ease; z-index: 20; }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.error { border-color: rgba(255, 140, 134, .55); }

    @media (max-width: 900px) {
      .shell { display: block; }
      .rail { position: static; height: auto; flex-direction: row; align-items: center; justify-content: space-between; padding: 16px 20px; border-right: 0; border-bottom: 1px solid var(--line); }
      .rail-nav, .runtime { display: none; }
      main { padding-top: 30px; }
      .hero { grid-template-columns: 1fr; gap: 22px; }
      .save-dock { left: 0; }
    }

    @media (max-width: 640px) {
      main { padding-left: 16px; padding-right: 16px; }
      .section-heading { display: grid; gap: 4px; }
      .section-note { line-height: 1.55; }
      .quick-start { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-2 { grid-template-columns: 1fr; }
      .field.wide { grid-column: auto; }
      .agent-top { align-items: flex-start; }
      .agent-actions { flex-direction: column; }
      .start-card { grid-template-columns: 1fr; }
      .save-dock { padding-left: 16px; padding-right: 16px; flex-wrap: wrap; }
      .save-dock .button { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="rail">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div>
          <div class="brand-name">agent-connector</div>
          <div class="brand-sub">本地 Agent 接入飞书</div>
        </div>
      </div>
      <nav class="rail-nav" aria-label="配置步骤">
        <a class="rail-link active" href="#feishu">飞书应用</a>
        <a class="rail-link" href="#agent">本地 Agent</a>
        <a class="rail-link" href="#start">启动连接器</a>
      </nav>
      <div class="runtime">
        <div class="runtime-row"><span class="runtime-label">setup</span><span class="online">127.0.0.1</span></div>
        <div class="runtime-row"><span class="runtime-label">secrets</span><span>仅本机保存</span></div>
        <div class="runtime-row"><span class="runtime-label">mode</span><span>read-only</span></div>
      </div>
    </aside>

    <main>
      <header class="hero">
        <div>
          <h1>把电脑上的 Agent 接进飞书。</h1>
          <p class="lede">在这里填写飞书应用和本地 Agent。Connector 会从这台电脑主动连接飞书，不需要公网 IP，也不会上传 Agent 凭据。</p>
        </div>
        <div class="boundary">
          <strong>连接边界</strong>
          飞书群 → 长连接 → 本机 Connector<br>
          → Codex / Claude / dsh / HTTP Agent
        </div>
      </header>

      <section class="section" id="feishu">
        <div class="section-heading">
          <h2>飞书应用</h2>
          <p class="section-note">在飞书开放平台创建企业自建应用，并启用机器人。</p>
        </div>
        <div class="panel">
          <div class="quick-start" aria-label="首次配置步骤">
            <div class="quick-step"><b>01</b>保存飞书凭据</div>
            <div class="quick-step"><b>02</b>启动 Connector</div>
            <div class="quick-step"><b>03</b>群里发 /whoami</div>
            <div class="quick-step"><b>04</b>回填 open_id</div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="appId">App ID</label>
              <input id="appId" autocomplete="off" placeholder="cli_xxxxxxxxxx">
            </div>
            <div class="field">
              <label for="appSecret">App Secret <span class="secret-state" id="secretState">未配置</span></label>
              <input id="appSecret" type="password" autocomplete="new-password" placeholder="留空表示保留已保存的 Secret">
              <span class="hint">Secret 只写入本机 <code>.env</code>，不会发送到 Agent 或出现在日志中。</span>
            </div>
            <div class="field">
              <label for="allowedOpenIds">允许的用户 open_id</label>
              <textarea id="allowedOpenIds" placeholder="ou_xxxxxxxxxx&#10;用逗号、空格或换行分隔"></textarea>
              <span class="hint">首次可以留空保存；此时机器人只响应 /whoami。拿到 open_id 后填回这里并再次保存。</span>
            </div>
            <div class="field">
              <label for="allowedChatIds">允许的群 chat_id（可选）</label>
              <textarea id="allowedChatIds" placeholder="oc_xxxxxxxxxx"></textarea>
              <span class="hint">留空表示所有已授权用户所在的群都可使用。</span>
            </div>
            <div class="field wide">
              <label class="toggle-line" for="allowRemoteAgentEndpoints">
                <input id="allowRemoteAgentEndpoints" type="checkbox">
                <span class="toggle-copy">
                  <span>允许访问局域网或公网 Agent</span>
                  <span class="hint">默认只允许 localhost。只应在你信任该网络和端点的场景开启。</span>
                </span>
              </label>
            </div>
          </div>
          <div class="test-strip">
            <button class="button quiet" id="testFeishu" type="button">测试飞书凭据</button>
            <div class="test-result" id="feishuResult" role="status"></div>
          </div>
        </div>
      </section>

      <section class="section" id="agent">
        <div class="section-heading">
          <h2>本地 Agent</h2>
          <p class="section-note">一个飞书机器人可以路由到多个 Agent，全部以只读方式运行。</p>
        </div>
        <div class="panel">
          <div class="agent-list" id="agentList"></div>
          <div class="button-row" style="margin-top:16px">
            <button class="button" id="addHttp" type="button">添加 HTTP Agent</button>
            <button class="button" id="addCli" type="button">添加 CLI Agent</button>
          </div>
          <div class="grid-2" style="margin-top:22px">
            <div class="field">
              <label for="defaultAgent">默认 Agent</label>
              <select id="defaultAgent"></select>
            </div>
            <div class="field">
              <label for="maxConcurrency">最大同时执行数</label>
              <input id="maxConcurrency" type="number" min="1" max="8" step="1">
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="start">
        <div class="section-heading">
          <h2>保存并启动</h2>
          <p class="section-note">测试通过后保存配置，再启动本机连接器。</p>
        </div>
        <div class="panel start-card">
          <div>
            <div id="startTitle">配置尚未保存</div>
            <div class="command" id="startCommand">.\start.ps1</div>
          </div>
          <button class="button" id="copyCommand" type="button">复制启动命令</button>
        </div>
      </section>
    </main>
  </div>

  <div class="save-dock">
    <div class="save-message" id="saveMessage" role="status">修改后点击保存，配置只保存在这台电脑上。</div>
    <button class="button primary" id="save" type="button">保存配置</button>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    const setupToken = document.querySelector('meta[name="setup-token"]').content;
    const $ = (id) => document.getElementById(id);
    let state = null;

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    }

    function showToast(message, kind = '') {
      const toast = $('toast');
      toast.textContent = message;
      toast.className = 'toast show ' + kind;
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => { toast.className = 'toast ' + kind; }, 3200);
    }

    function setBusy(button, busy) {
      button.disabled = busy;
      if (busy) button.dataset.label = button.textContent;
      button.textContent = busy ? '处理中…' : (button.dataset.label || button.textContent);
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { 'content-type': 'application/json', 'x-agent-connector-setup-token': setupToken, ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
      return data;
    }

    function agentTemplate(agent, index) {
      const type = agent.type || 'http';
      const isCli = type === 'cli';
      const responsePath = agent.responsePath || '';
      return '<article class="agent-card" data-index="' + index + '">'
        + '<div class="agent-top"><div class="agent-identity"><span class="agent-id">' + escapeHtml(agent.id || 'new-agent') + '</span><span class="badge readonly">只读</span><span class="badge">' + (isCli ? 'CLI' : 'HTTP') + '</span></div>'
        + '<div class="agent-actions"><button class="button quiet" type="button" data-action="test-agent">测试</button><button class="button quiet danger" type="button" data-action="remove-agent"' + (state.agents.length <= 1 ? ' disabled' : '') + '>移除</button></div></div>'
        + '<div class="grid-2">'
        + '<div class="field"><label>Agent ID</label><input data-field="id" aria-label="Agent ID" value="' + escapeHtml(agent.id || '') + '" placeholder="codex"></div>'
        + '<div class="field"><label>显示名称</label><input data-field="label" aria-label="Agent 显示名称" value="' + escapeHtml(agent.label || '') + '" placeholder="Codex"></div>'
        + (isCli
          ? '<div class="field"><label>可执行文件</label><input data-field="executable" aria-label="Agent 可执行文件" value="' + escapeHtml(agent.executable || '') + '" placeholder="C:\\\\path\\\\to\\\\codex.exe"></div>'
            + '<div class="field"><label>工作目录</label><input data-field="cwd" aria-label="Agent 工作目录" value="' + escapeHtml(agent.cwd || '') + '" placeholder="D:\\\\work\\\\my-project"></div>'
            + '<div class="field"><label>参数 JSON</label><textarea data-field="args" aria-label="Agent 参数 JSON" placeholder="[&quot;exec&quot;,&quot;--sandbox&quot;,&quot;read-only&quot;,&quot;-&quot;]">' + escapeHtml(JSON.stringify(agent.args || [])) + '</textarea></div>'
            + '<div class="field"><label>输入模板</label><input data-field="stdin" aria-label="Agent 输入模板" value="' + escapeHtml(agent.stdin || '{prompt}') + '"></div>'
          : '<div class="field"><label>本地地址</label><input data-field="endpoint" aria-label="Agent 本地地址" value="' + escapeHtml(agent.endpoint || '') + '" placeholder="http://127.0.0.1:8787/ask"></div>'
            + '<div class="field"><label>请求方法</label><select data-field="method" aria-label="Agent 请求方法"><option' + (agent.method === 'POST' ? ' selected' : '') + '>POST</option><option' + (agent.method === 'PUT' ? ' selected' : '') + '>PUT</option><option' + (agent.method === 'PATCH' ? ' selected' : '') + '>PATCH</option></select></div>'
            + '<div class="field"><label>响应字段路径（可选）</label><input data-field="responsePath" aria-label="Agent 响应字段路径" value="' + escapeHtml(responsePath) + '" placeholder="answer"></div>')
        + '<div class="field"><label>超时（毫秒）</label><input data-field="timeoutMs" aria-label="Agent 超时毫秒" type="number" min="5000" max="3600000" step="1000" value="' + Number(agent.timeoutMs || 600000) + '"></div>'
        + '</div><div class="footer-error" data-role="agent-error"></div></article>';
    }

    function renderAgents() {
      $('agentList').innerHTML = state.agents.map(agentTemplate).join('');
      const select = $('defaultAgent');
      select.innerHTML = state.agents.map((agent) => '<option value="' + escapeHtml(agent.id) + '"' + (agent.id === state.defaultAgent ? ' selected' : '') + '>' + escapeHtml(agent.id) + '</option>').join('');
    }

    function readAgentCard(card) {
      const current = state.agents[Number(card.dataset.index)];
      const value = (field) => card.querySelector('[data-field="' + field + '"]')?.value.trim() || '';
      const agent = { ...current, id: value('id'), label: value('label'), type: current.type, readOnly: true, timeoutMs: Number(value('timeoutMs') || 600000) };
      if (current.type === 'cli') {
        agent.executable = value('executable');
        agent.cwd = value('cwd');
        agent.stdin = value('stdin') || '{prompt}';
        try { agent.args = JSON.parse(value('args') || '[]'); }
        catch { throw new Error('Agent ' + agent.id + ' 的参数必须是合法 JSON 数组'); }
      } else {
        agent.endpoint = value('endpoint');
        agent.method = value('method') || 'POST';
        agent.responsePath = value('responsePath');
        agent.body = current.body || { prompt: '{prompt}', chatId: '{chatId}', userId: '{userId}', jobId: '{jobId}' };
      }
      return agent;
    }

    function syncAgentsFromDom() {
      const cards = [...document.querySelectorAll('.agent-card')];
      state.agents = cards.map(readAgentCard);
      state.defaultAgent = $('defaultAgent').value || state.agents[0]?.id || '';
    }

    async function load() {
      state = await api('/api/state');
      $('appId').value = state.appId || '';
      $('secretState').textContent = state.appSecretConfigured ? '已保存，留空保留' : '未配置';
      $('secretState').className = 'secret-state' + (state.appSecretConfigured ? ' ok' : '');
      $('allowedOpenIds').value = (state.security.allowedOpenIds || []).join('\\n');
      $('allowedChatIds').value = (state.security.allowedChatIds || []).join('\\n');
      $('allowRemoteAgentEndpoints').checked = state.security.allowRemoteAgentEndpoints === true;
      $('maxConcurrency').value = state.security.maxConcurrency || 2;
      renderAgents();
      renderSaveState(state.appId && state.appSecretConfigured);
    }

    function renderSaveState(ready) {
      $('startTitle').textContent = ready ? '配置已就绪，可以启动连接器' : '配置尚未保存';
      $('startCommand').textContent = ready ? '.\\start.ps1' : '保存配置后显示启动命令';
    }

    function buildPayload() {
      syncAgentsFromDom();
      return {
        appId: $('appId').value.trim(),
        appSecret: $('appSecret').value,
        allowedOpenIds: $('allowedOpenIds').value,
        allowedChatIds: $('allowedChatIds').value,
        allowRemoteAgentEndpoints: $('allowRemoteAgentEndpoints').checked,
        maxConcurrency: Number($('maxConcurrency').value || 2),
        defaultAgent: state.defaultAgent,
        agents: state.agents,
      };
    }

    async function save() {
      const button = $('save');
      const message = $('saveMessage');
      try {
        setBusy(button, true);
        state = await api('/api/save', { method: 'POST', body: JSON.stringify(buildPayload()) });
        $('appSecret').value = '';
        $('secretState').textContent = '已保存，留空保留';
        $('secretState').className = 'secret-state ok';
        renderAgents();
        renderSaveState(true);
        message.className = 'save-message ok';
        message.textContent = '配置已保存。启动 Connector 前，请先停止占用同一飞书应用的其他长连接。';
        showToast('配置已保存');
      } catch (error) {
        message.className = 'save-message error';
        message.textContent = error.message;
        showToast(error.message, 'error');
      } finally {
        setBusy(button, false);
      }
    }

    async function testFeishu() {
      const button = $('testFeishu');
      const result = $('feishuResult');
      try {
        setBusy(button, true);
        result.className = 'test-result';
        result.textContent = '正在向飞书换取临时凭证…';
        const payload = await api('/api/test-feishu', {
          method: 'POST',
          body: JSON.stringify({ appId: $('appId').value, appSecret: $('appSecret').value }),
        });
        result.className = 'test-result ok';
        result.textContent = '凭据有效 · ' + payload.appId;
      } catch (error) {
        result.className = 'test-result error';
        result.textContent = error.message;
      } finally {
        setBusy(button, false);
      }
    }

    async function testAgent(card) {
      const errorBox = card.querySelector('[data-role="agent-error"]');
      try {
        errorBox.textContent = '';
        const agent = readAgentCard(card);
        const result = await api('/api/test-agent', { method: 'POST', body: JSON.stringify({ agent, prompt: '请只回复 AGENT_CONNECTOR_OK' }) });
        errorBox.textContent = '连通成功：' + result.output.slice(0, 500);
        errorBox.style.color = 'var(--accent)';
        showToast('Agent ' + agent.id + ' 连通成功');
      } catch (error) {
        errorBox.style.color = 'var(--danger)';
        errorBox.textContent = error.message;
        showToast('Agent 测试失败', 'error');
      }
    }

    function addAgent(type) {
      try { syncAgentsFromDom(); } catch (error) { showToast(error.message, 'error'); return; }
      const id = type === 'http' ? 'local-http' : 'codex';
      if (state.agents.some((agent) => agent.id === id)) { showToast('当前已有 ID 为 ' + id + ' 的 Agent'); return; }
      state.agents.push(type === 'http'
        ? { id, label: 'Local HTTP Agent', type: 'http', endpoint: 'http://127.0.0.1:8787/ask', method: 'POST', responsePath: 'answer', timeoutMs: 300000, readOnly: true }
        : { id, label: 'Codex', type: 'cli', executable: 'C:\\\\path\\\\to\\\\codex.exe', cwd: '', args: ['exec','--sandbox','read-only','--skip-git-repo-check','--color','never','--ephemeral','-C','{cwd}','-'], stdin: '{prompt}', timeoutMs: 1200000, readOnly: true });
      state.defaultAgent = state.defaultAgent || state.agents[0].id;
      renderAgents();
    }

    $('agentList').addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const card = button.closest('.agent-card');
      if (button.dataset.action === 'test-agent') await testAgent(card);
      if (button.dataset.action === 'remove-agent') {
        try { syncAgentsFromDom(); } catch (error) { showToast(error.message, 'error'); return; }
        state.agents.splice(Number(card.dataset.index), 1);
        state.defaultAgent = state.agents[0]?.id || '';
        renderAgents();
      }
    });

    $('addHttp').addEventListener('click', () => addAgent('http'));
    $('addCli').addEventListener('click', () => addAgent('cli'));
    $('save').addEventListener('click', save);
    $('testFeishu').addEventListener('click', testFeishu);
    $('copyCommand').addEventListener('click', async () => {
      const command = $('startCommand').textContent;
      if (!command.includes('start.ps1')) return showToast('请先保存配置');
      try { await navigator.clipboard.writeText(command); showToast('启动命令已复制'); }
      catch { showToast('复制失败，请手动选择命令'); }
    });

    load().catch((error) => {
      $('saveMessage').className = 'save-message error';
      $('saveMessage').textContent = '加载配置失败：' + error.message;
    });
  </script>
</body>
</html>`;
}
