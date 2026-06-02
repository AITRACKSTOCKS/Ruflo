document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Authentication Guard
  const loginOverlay = document.getElementById('login-overlay');
  const formLogin = document.getElementById('form-login');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnSignout = document.getElementById('btn-signout');

  // DOM Elements - Navigation Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const activeTabTitle = document.getElementById('active-tab-title');

  // DOM Elements - Core Actions
  const btnStartSystem = document.getElementById('btn-start-system');
  const btnStopSystem = document.getElementById('btn-stop-system');
  const btnClearStore = document.getElementById('btn-clear-store');
  const btnRefreshAgents = document.getElementById('btn-refresh-agents-chat') || document.getElementById('btn-refresh-agents');
  const btnClearTerminal = document.getElementById('btn-clear-terminal');
  
  // DOM Elements - Swarm Assistant Chat
  const formChatSubmit = document.getElementById('form-chat-submit');
  const chatInput = document.getElementById('chat-input');
  const missionMode = document.getElementById('mission-mode');
  const btnToggleConfig = document.getElementById('btn-toggle-config');
  const chatConfigPanel = document.getElementById('chat-config-panel');
  const chatRepo = document.getElementById('chat-repo');
  const chatBranch = document.getElementById('chat-branch');
  const chatModel = document.getElementById('chat-model');
  const chatStrategy = document.getElementById('chat-strategy');
  const chatAgentType = document.getElementById('chat-agent-type');
  const chatParallel = document.getElementById('chat-parallel');
  const pillMode = document.getElementById('pill-mode');
  const pillModelDisplay = document.getElementById('pill-model-display');
  const pillGit = document.getElementById('pill-git');
  const btnChatSend = document.getElementById('btn-chat-send');
  const chatTimeline = document.getElementById('chat-timeline');
  const chatWelcomePane = document.getElementById('chat-welcome-pane');

  // DOM Elements - Forms & Inputs
  const formMemorySearch = document.getElementById('form-memory-search');
  const formMemoryStore = document.getElementById('form-memory-store');
  const formSecurityVerify = document.getElementById('form-security-verify');
  
  // DOM Elements - Buttons/Toggles
  const chkAutopilot = document.getElementById('chk-autopilot');
  const btnSecurityScan = document.getElementById('btn-security-scan');
  const btnPerformanceBenchmark = document.getElementById('btn-performance-benchmark');
  const btnWorkerList = document.querySelectorAll('.btn-worker');
  const btnRefreshTasks = document.getElementById('btn-refresh-tasks');
  const btnRefreshSessions = document.getElementById('btn-refresh-sessions');

  // DOM Elements - Displays
  const systemStatusText = document.getElementById('system-status-text');
  const preferredProvider = document.getElementById('preferred-provider');
  const preferredModel = document.getElementById('preferred-model');
  const valTopology = document.getElementById('val-topology');
  const valMaxAgents = document.getElementById('val-max-agents');
  
  const agentsGrid = document.getElementById('agents-grid');
  const memoryResultsContainer = document.getElementById('memory-results-container');
  const securityResultsContainer = document.getElementById('security-results-container');
  const performanceResultsContainer = document.getElementById('performance-results-container');
  const tasksContainer = document.getElementById('tasks-container');
  const sessionsContainer = document.getElementById('sessions-container');
  
  const consoleOutput = document.getElementById('console-output');
  const termStatus = document.getElementById('term-status');

  // Authentication Handlers
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;

    if (username === 'Admin@07' && password === 'Admin@007') {
      localStorage.setItem('ruflo_authenticated', 'true');
      loginOverlay.classList.add('hidden');
      loginError.classList.add('hidden');
      loginUsernameInput.value = '';
      loginPasswordInput.value = '';
      checkStatus();
      logToTerminal('Console session successfully authenticated as security administrator.');
    } else {
      loginError.classList.remove('hidden');
      loginPasswordInput.value = '';
    }
  });

  btnSignout.addEventListener('click', () => {
    localStorage.removeItem('ruflo_authenticated');
    loginOverlay.classList.remove('hidden');
    logToTerminal('Authenticated session terminated. Redirecting to security login...');
  });

  // 1. Sidebar Tab Switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      
      // Toggle nav item classes
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Toggle tab content visibility
      tabContents.forEach(content => {
        if (content.id === `tab-${tabId}`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });

      // Update Header Title
      activeTabTitle.innerText = item.textContent.trim();

      // Trigger lazy loaded fetches
      if (tabId === 'missions') {
        fetchTasks();
        fetchSessions();
        if (typeof fetchHistory === 'function') fetchHistory();
      }
    });
  });

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 2. Terminal Logger
  function logToTerminal(text, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const escapedText = escapeHTML(text);
    const formattedText = `\n[${timestamp}] ${escapedText}`;
    if (isError) {
      consoleOutput.innerHTML += `<span style="color: #F87171;">${formattedText}</span>`;
    } else {
      consoleOutput.innerHTML += `<span>${formattedText}</span>`;
    }
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  btnClearTerminal.addEventListener('click', () => {
    consoleOutput.innerHTML = `> Ready for input. Waiting to launch Ruflo commands...`;
  });

  // 3. Core Status & Agents Polling
  async function checkStatus() {
    if (localStorage.getItem('ruflo_authenticated') !== 'true') return;
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('API unreachable');
      
      const data = await response.json();
      
      // Update system settings text
      if (data.config && data.config.agents && data.config.agents.providers) {
        const openaiConfig = data.config.agents.providers.find(p => p.name === 'openai');
        if (openaiConfig) {
          preferredProvider.innerText = 'OpenAI';
          preferredModel.innerText = openaiConfig.model || 'gpt-4.1-mini';
        }
      }
      
      if (data.config && data.config.swarm) {
        valTopology.innerText = data.config.swarm.topology || 'hierarchical-mesh';
        valMaxAgents.innerText = data.config.swarm.maxAgents || '8';
      }

      systemStatusText.innerText = 'System Active';
      systemStatusText.parentElement.querySelector('.dot').className = 'dot pulse green';

      renderAgents(data.agents);
      
    } catch (error) {
      console.error('Error fetching status:', error);
      systemStatusText.innerText = 'Daemon Offline';
      systemStatusText.parentElement.querySelector('.dot').className = 'dot pulse red';
    }
  }

  function renderAgents(agentsList) {
    const agentIds = Object.keys(agentsList);
    if (agentIds.length === 0) {
      agentsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <p>No agents spawned in the network yet.</p>
          <span>Spawn a Coder or QA Specialist using the form on the left!</span>
        </div>
      `;
      return;
    }

    let html = '';
    agentIds.forEach(id => {
      const agent = agentsList[id];
      const name = agent.name || id.substring(0, 12);
      const statusClass = `status-${agent.status || 'idle'}`;
      const provider = agent.config && agent.config.provider ? agent.config.provider : (agent.provider || 'openai');
      const model = agent.config && agent.config.model ? agent.config.model : (agent.model || 'gpt-4.1-mini');
      const task = agent.config && agent.config.task ? agent.config.task : 'No task details';

      html += `
        <div class="agent-card">
          <div class="agent-card-header">
            <div class="agent-meta">
              <h3>${name}</h3>
              <span class="agent-type-tag">${agent.agentType || 'Specialist'}</span>
            </div>
            <span class="agent-status-badge ${statusClass}">
              <span class="dot ${agent.status === 'active' ? 'green pulse' : agent.status === 'registered' ? 'gold' : 'blue'}"></span>
              ${agent.status || 'idle'}
            </span>
          </div>
          <div class="agent-specs">
            <div>Provider:</div>
            <span>${provider}</span>
            <div>Model:</div>
            <span style="color: var(--accent-cyan); font-weight: 700;">${model}</span>
          </div>
          <div class="agent-task-box">
            <span>Assignment</span>
            <p>${task}</p>
          </div>
        </div>
      `;
    });
    agentsGrid.innerHTML = html;
  }

  // Swarm Chat Configuration Listeners
  if (btnToggleConfig) {
    btnToggleConfig.addEventListener('click', () => {
      chatConfigPanel.classList.toggle('hidden');
    });
  }

  if (missionMode) {
    missionMode.addEventListener('change', () => {
      const mode = missionMode.value;
      if (mode === 'swarm') {
        pillMode.innerText = '👥 Swarm';
        btnChatSend.querySelector('span').innerText = 'Deploy Mission';
        chatInput.placeholder = 'Explain the complex swarm objective...';
      } else {
        pillMode.innerText = '👤 Single';
        btnChatSend.querySelector('span').innerText = 'Spawn Agent';
        chatInput.placeholder = 'Enter initial task instruction for specialist agent...';
      }
    });
  }

  if (chatModel) {
    chatModel.addEventListener('change', () => {
      pillModelDisplay.innerText = `🤖 ${chatModel.value}`;
    });
  }

  if (chatRepo) {
    chatRepo.addEventListener('input', () => {
      if (chatRepo.value.trim()) {
        pillGit.classList.remove('hidden');
      } else {
        pillGit.classList.add('hidden');
      }
    });
  }

  // Quick Start Prompts Binding
  document.querySelectorAll('.btn-quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.getAttribute('data-prompt');
      chatInput.focus();
    });
  });

  // Append conversational message bubbles
  function appendChatMessage(sender, text, isUser = false) {
    if (chatWelcomePane) {
      chatWelcomePane.style.display = 'none';
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = 'msg-' + Date.now();

    const bubbleHtml = `
      <div class="chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-system'}" id="${msgId}">
        <div class="chat-msg-avatar">
          ${isUser ? '👤' : '🤖'}
        </div>
        <div class="chat-msg-body">
          <div class="chat-msg-meta">
            <span class="chat-msg-sender">${sender}</span>
            <span class="chat-msg-time">${timestamp}</span>
          </div>
          <div class="chat-msg-content">
            ${text}
          </div>
        </div>
      </div>
    `;

    chatTimeline.innerHTML += bubbleHtml;
    chatTimeline.scrollTop = chatTimeline.scrollHeight;

    return msgId;
  }

  // Hook up main conversational action form
  if (formChatSubmit) {
    formChatSubmit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const promptText = chatInput.value.trim();
      if (!promptText) return;

      const mode = missionMode.value;

      if (mode === 'swarm') {
        const repoUrl = chatRepo.value.trim();
        if (!repoUrl) {
          const runLocal = confirm("⚠️ No GitHub Repository URL has been configured.\n\nDeploying a Swarm Mission in Local Mode will modify the command center directory itself (c:\\Users\\hp\\Desktop\\ruflo).\n\nDo you want to proceed in Local Mode?\n(Click 'Cancel' to expand settings and enter a GitHub Repository URL.)");
          if (!runLocal) {
            // Expand configuration panel
            if (chatConfigPanel.classList.contains('hidden')) {
              chatConfigPanel.classList.remove('hidden');
            }
            chatRepo.focus();
            return;
          }
        }
      }

      // Reset prompt field
      chatInput.value = '';

      // Append user bubble
      appendChatMessage('Administrator', promptText, true);

      // Add thinking bubble
      const thinkingText = `<span class="pulse">Swarm coordinating in the background... Analysing boundaries & launching agents.</span>`;
      const responseId = appendChatMessage('RuFlo Swarm', thinkingText, false);

      if (mode === 'swarm') {
        const objective = promptText;
        const strategy = chatStrategy.value;
        const parallel = chatParallel.value === 'true';
        const repoUrl = chatRepo.value.trim();
        const branch = chatBranch.value;

        logToTerminal(`Swarm Chat Action -> Objective: "${objective}" (Strategy: ${strategy})`);
        termStatus.innerText = 'Swarm active...';

        try {
          const response = await fetch('/api/swarm/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective, strategy, parallel, repoUrl, branch })
          });

          if (!response.ok) {
            const errText = await response.text();
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch(e) {}
            throw new Error((parsedErr && parsedErr.error) || errText || 'Failed to start swarm mission');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let result = { success: false, stdout: '', stderr: '', code: -1 };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep trailing incomplete line

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const packet = JSON.parse(line);
                if (packet.type === 'log') {
                  logToTerminal(packet.data);
                } else if (packet.type === 'result') {
                  result = packet;
                }
              } catch (err) {
                console.error('[Stream Parser] JSON parse error:', err);
              }
            }
          }

          termStatus.innerText = 'Terminal Ready';
          const bubbleElement = document.getElementById(responseId).querySelector('.chat-msg-content');

          if (result.success) {
            logToTerminal(`SWARM DEPLOYMENT SUCCESS:\n${result.stdout}`);
            bubbleElement.innerHTML = `
              <p>👥 <strong>Swarm Mission Successfully Dispatched!</strong></p>
              <p class="text-sm text-secondary">The specialist agent mesh network has completed their tasks and checked boundary safety metrics.</p>
              <pre class="code-snippet">${escapeHTML(result.stdout)}</pre>
            `;
            checkStatus();
            if (typeof fetchHistory === 'function') fetchHistory();
          } else {
            logToTerminal(`SWARM DEPLOYMENT FAILED:\n${result.stderr || result.stdout}`, true);
            bubbleElement.innerHTML = `
              <p style="color: #F87171;">⚠️ <strong>Swarm Execution Terminated with Errors</strong></p>
              <pre class="code-snippet" style="border-color: rgba(239, 68, 68, 0.25);">${escapeHTML(result.stderr || result.stdout || 'Unknown deployment error occurred.')}</pre>
            `;
            if (typeof fetchHistory === 'function') fetchHistory();
          }

        } catch (err) {
          termStatus.innerText = 'Error';
          logToTerminal(`Request Error: ${err.message}`, true);
          const bubbleElement = document.getElementById(responseId).querySelector('.chat-msg-content');
          bubbleElement.innerHTML = `<span style="color: #F87171;">Request Failure: ${err.message}</span>`;
        }

      } else {
        // Spawn Single Agent Mode
        const type = chatAgentType.value;
        const provider = 'openai';
        const model = chatModel.value;
        const task = promptText;

        logToTerminal(`Agent Spawn Chat Action -> Specialist [${type}] via ${provider} (${model})`);
        termStatus.innerText = 'Spawning agent...';

        try {
          const response = await fetch('/api/agent/spawn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, provider, model, task })
          });

          if (!response.ok) {
            const errText = await response.text();
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch(e) {}
            throw new Error((parsedErr && parsedErr.error) || errText || 'Failed to spawn specialist agent');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let result = { success: false, stdout: '', stderr: '', code: -1 };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep trailing incomplete line

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const packet = JSON.parse(line);
                if (packet.type === 'log') {
                  logToTerminal(packet.data);
                } else if (packet.type === 'result') {
                  result = packet;
                }
              } catch (err) {
                console.error('[Stream Parser] JSON parse error:', err);
              }
            }
          }

          termStatus.innerText = 'Terminal Ready';
          const bubbleElement = document.getElementById(responseId).querySelector('.chat-msg-content');

          if (result.success) {
            logToTerminal(`SPAWN SUCCESS:\n${result.stdout}`);
            bubbleElement.innerHTML = `
              <p>👤 <strong>Specialist Agent [${type.toUpperCase()}] Spawned & Executed!</strong></p>
              <pre class="code-snippet">${escapeHTML(result.stdout)}</pre>
            `;
            checkStatus();
          } else {
            logToTerminal(`SPAWN FAILED:\n${result.stderr || result.stdout}`, true);
            bubbleElement.innerHTML = `
              <p style="color: #F87171;">⚠️ <strong>Specialist Spawn Terminated with Errors</strong></p>
              <pre class="code-snippet" style="border-color: rgba(239, 68, 68, 0.25);">${escapeHTML(result.stderr || result.stdout || 'Spawn command failed.')}</pre>
            `;
          }

        } catch (err) {
          termStatus.innerText = 'Error';
          logToTerminal(`Request Error: ${err.message}`, true);
          const bubbleElement = document.getElementById(responseId).querySelector('.chat-msg-content');
          bubbleElement.innerHTML = `<span style="color: #F87171;">Request Failure: ${err.message}</span>`;
        }
      }
    });
  }

  // 6. Memory & Vector Operations
  formMemorySearch.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('search-query').value;
    const namespace = document.getElementById('search-namespace').value;

    logToTerminal(`Vector DB Search -> Namespace: [${namespace}], Query: "${query}"`);
    termStatus.innerText = 'Searching DB...';
    memoryResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon pulse">🧠</div><p>Searching Vector HNSW Index...</p></div>`;

    try {
      const response = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, namespace })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`SEARCH SUCCESS:\n${result.stdout}`);
        
        // Format memory search output matches
        memoryResultsContainer.innerHTML = `
          <div class="data-item">
            <h4>HNSW Index Search Results</h4>
            <span>Matched memories for query: <strong>"${escapeHTML(query)}"</strong></span>
            <pre class="code-snippet">${escapeHTML(result.stdout || 'No semantic matching memory fragments found.')}</pre>
          </div>
        `;
      } else {
        logToTerminal(`SEARCH FAILED:\n${result.stderr || result.stdout}`, true);
        memoryResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Search failed</p><span>Check terminal for details.</span></div>`;
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Search Error: ${err.message}`, true);
    }
  });

  formMemoryStore.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('store-key').value;
    const value = document.getElementById('store-value').value;
    const namespace = document.getElementById('store-namespace').value;

    logToTerminal(`Injecting Memory -> Namespace: [${namespace}], Key: "${key}"`);
    termStatus.innerText = 'Injecting memory...';

    try {
      const response = await fetch('/api/memory/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, namespace })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`MEMORY INJECTED SUCCESS:\n${result.stdout}`);
        document.getElementById('store-key').value = '';
        document.getElementById('store-value').value = '';
        alert('Memory successfully injected and indexed into Ruflo Vector DB!');
      } else {
        logToTerminal(`MEMORY INJECTED FAILED:\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Store Error: ${err.message}`, true);
    }
  });

  // 7. Autopilot persistent loop control
  chkAutopilot.addEventListener('change', async function() {
    const enable = this.checked;
    logToTerminal(`Toggling Autopilot persist loop -> ${enable ? 'ENABLED' : 'DISABLED'}`);
    termStatus.innerText = 'Autopilot...';

    try {
      const response = await fetch('/api/autopilot/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`AUTOPILOT SUCCESS:\n${result.stdout}`);
      } else {
        logToTerminal(`AUTOPILOT FAILED:\n${result.stderr || result.stdout}`, true);
        this.checked = !enable; // revert
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Autopilot toggle error: ${err.message}`, true);
      this.checked = !enable; // revert
    }
  });

  // 8. Security Audits & Verifications
  btnSecurityScan.addEventListener('click', async () => {
    logToTerminal('Running full-codebase vulnerability and threat scans...');
    termStatus.innerText = 'Scanning...';
    securityResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon pulse">🛡️</div><p>Performing Vulnerability Audits...</p></div>`;

    try {
      const response = await fetch('/api/security/scan', { method: 'POST' });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`SCAN SUCCESS:\n${result.stdout}`);
        securityResultsContainer.innerHTML = `
          <div class="data-item">
            <h4 style="color: var(--accent-danger);">Vulnerability CVE Scan Results</h4>
            <span>Threat status: <strong>Secure / Guarded</strong></span>
            <pre class="code-snippet">${escapeHTML(result.stdout || 'Scan complete. Codebase is clean!')}</pre>
          </div>
        `;
      } else {
        logToTerminal(`SCAN FAILED:\n${result.stderr || result.stdout}`, true);
        securityResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Scan failed</p><span>Check terminal for details.</span></div>`;
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Security Scan Error: ${err.message}`, true);
    }
  });

  formSecurityVerify.addEventListener('submit', async (e) => {
    e.preventDefault();
    const filePath = document.getElementById('threat-file-path').value;
    logToTerminal(`Verifying file threat: "${filePath}"`);
    termStatus.innerText = 'Verifying file...';
    securityResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon pulse">🔎</div><p>Analyzing File Boundaries...</p></div>`;

    try {
      const response = await fetch('/api/security/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`VERIFY SUCCESS:\n${result.stdout}`);
        securityResultsContainer.innerHTML = `
          <div class="data-item">
            <h4>File verification report</h4>
            <span>Boundary: <strong>"${escapeHTML(filePath)}"</strong></span>
            <pre class="code-snippet">${escapeHTML(result.stdout || 'Verification report details empty.')}</pre>
          </div>
        `;
      } else {
        logToTerminal(`VERIFY FAILED:\n${result.stderr || result.stdout}`, true);
        securityResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Verify failed</p><span>Check terminal for details.</span></div>`;
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Verify Error: ${err.message}`, true);
    }
  });

  // 9. Performance & Hook Workers
  btnPerformanceBenchmark.addEventListener('click', async () => {
    logToTerminal('Profiling engine speeds, vector metrics, and compile benchmarks...');
    termStatus.innerText = 'Profiling...';
    performanceResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon pulse">⚡</div><p>Calculating benchmarks...</p></div>`;

    try {
      const response = await fetch('/api/performance/benchmark', { method: 'POST' });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';

      if (result.success) {
        logToTerminal(`BENCHMARK SUCCESS:\n${result.stdout}`);
        performanceResultsContainer.innerHTML = `
          <div class="data-item">
            <h4 style="color: var(--accent-gold);">System Optimization Benchmarks</h4>
            <span>Profiling metrics and latency speeds:</span>
            <pre class="code-snippet">${escapeHTML(result.stdout || 'Profiling benchmarks loaded.')}</pre>
          </div>
        `;
      } else {
        logToTerminal(`BENCHMARK FAILED:\n${result.stderr || result.stdout}`, true);
        performanceResultsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Benchmark failed</p><span>Check terminal for details.</span></div>`;
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Benchmark Error: ${err.message}`, true);
    }
  });

  btnWorkerList.forEach(btn => {
    btn.addEventListener('click', async () => {
      const worker = btn.getAttribute('data-worker');
      logToTerminal(`Dispatched hook self-learning worker: [${worker}]`);
      termStatus.innerText = 'Worker dispatched...';

      try {
        const response = await fetch('/api/hooks/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker })
        });
        const result = await response.json();
        termStatus.innerText = 'Terminal Ready';

        if (result.success) {
          logToTerminal(`WORKER DISPATCHED SUCCESS:\n${result.stdout}`);
        } else {
          logToTerminal(`WORKER DISPATCHED FAILED:\n${result.stderr || result.stdout}`, true);
        }
      } catch (err) {
        termStatus.innerText = 'Error';
        logToTerminal(`Worker Dispatch Error: ${err.message}`, true);
      }
    });
  });

  // 10. Missions: Tasks & Sessions Listings
  async function fetchTasks() {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      
      if (data.textData) {
        tasksContainer.innerHTML = `
          <div class="data-item">
            <h4>Active Queue Queue</h4>
            <pre class="code-snippet">${data.textData}</pre>
          </div>
        `;
      } else {
        tasksContainer.innerHTML = `<pre class="code-snippet">${JSON.stringify(data, null, 2)}</pre>`;
      }
    } catch (err) {
      tasksContainer.innerHTML = `<div class="empty-state"><p>Connection error fetching tasks.</p></div>`;
    }
  }

  async function fetchSessions() {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      
      if (data.textData) {
        sessionsContainer.innerHTML = `
          <div class="data-item">
            <h4>Saved Session Logs</h4>
            <pre class="code-snippet">${data.textData}</pre>
          </div>
        `;
      } else {
        sessionsContainer.innerHTML = `<pre class="code-snippet">${JSON.stringify(data, null, 2)}</pre>`;
      }
    } catch (err) {
      sessionsContainer.innerHTML = `<div class="empty-state"><p>Connection error fetching sessions.</p></div>`;
    }
  }

  // 10b. Swarm Mission History Logs
  const historyContainer = document.getElementById('history-container');
  const btnRefreshHistory = document.getElementById('btn-refresh-history');
  const btnClearHistory = document.getElementById('btn-clear-history');

  async function fetchHistory() {
    if (!historyContainer) return;
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      
      if (!data || data.length === 0) {
        historyContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <p>No past missions recorded</p>
            <span>Deploy a mission using the Swarm Orchestrator to see your changes history.</span>
          </div>
        `;
        return;
      }

      let html = '';
      data.forEach(item => {
        const dateStr = new Date(item.timestamp).toLocaleString();
        const successText = item.success ? 'Succeeded' : 'Failed';
        const statusStyle = item.success ? 'color: #34D399; background: rgba(52, 211, 153, 0.1);' : 'color: #F87171; background: rgba(248, 113, 113, 0.1);';
        
        let changesHtml = '';
        if (item.changes && item.changes.length > 0) {
          changesHtml = `<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">`;
          item.changes.forEach(c => {
            changesHtml += `<span style="font-size: 12px; color: #E2E8F0;"><span style="color: #34D399; margin-right: 6px;">✓</span> <strong>${escapeHTML(c.file)}</strong> (by ${escapeHTML(c.agent)})</span>`;
          });
          changesHtml += `</div>`;
        } else if (item.success) {
          changesHtml = `<span style="font-size: 12px; color: #94A3B8; font-style: italic;">No files modified (code verification passed with no changes needed).</span>`;
        } else {
          changesHtml = `<span style="font-size: 12px; color: #F87171; font-style: italic;">Failed during agent execution or repository cloning.</span>`;
        }

        html += `
          <div class="data-item" style="border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.015); display: flex; flex-direction: column; gap: 8px; text-align: left; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
              <span style="font-size: 11px; color: #94A3B8; font-family: monospace;">${dateStr}</span>
              <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; ${statusStyle}">${successText}</span>
            </div>
            
            <div style="font-size: 14px; font-weight: 500; color: #F1F5F9; line-height: 1.4; margin-top: 4px;">
              <strong>Prompt:</strong> "${escapeHTML(item.prompt)}"
            </div>

            <div style="font-size: 12px; color: #94A3B8;">
              <strong>Repo:</strong> <span style="font-family: monospace; color: #38BDF8;">${escapeHTML(item.repoUrl)}</span> <span style="color: #A78BFA;">[${escapeHTML(item.branch)}]</span>
            </div>

            <div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 6px; padding-top: 8px;">
              <strong style="font-size: 12px; color: #94A3B8;">Modifications:</strong>
              ${changesHtml}
            </div>

            <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
              <button class="btn btn-secondary btn-small toggle-history-log" data-id="${item.id}" style="align-self: flex-start; font-size: 11px; padding: 4px 8px; font-weight: 500; cursor: pointer;">
                Show Console Logs
              </button>
              <pre class="code-snippet history-log-pre hidden" id="log-pre-${item.id}" style="margin-top: 6px; max-height: 250px; font-size: 11.5px; line-height: 1.5; border-color: rgba(255,255,255,0.05); text-align: left; overflow: auto; width: 100%; white-space: pre-wrap; background: rgba(0,0,0,0.25);">${escapeHTML(item.stdout || item.stderr || 'No console output logged.')}</pre>
            </div>
          </div>
        `;
      });
      
      historyContainer.innerHTML = html;

      // Add expand listeners
      document.querySelectorAll('.toggle-history-log').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const pre = document.getElementById(`log-pre-${id}`);
          if (pre.classList.contains('hidden')) {
            pre.classList.remove('hidden');
            btn.innerText = 'Hide Console Logs';
          } else {
            pre.classList.add('hidden');
            btn.innerText = 'Show Console Logs';
          }
        });
      });
    } catch (err) {
      console.error('[History fetch error]:', err);
      if (historyContainer) {
        historyContainer.innerHTML = `<div class="empty-state"><p>Connection error fetching mission history.</p></div>`;
      }
    }
  }

  if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', fetchHistory);

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete all past mission history logs?')) return;
      try {
        const response = await fetch('/api/history/clear', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
          logToTerminal('Mission history successfully cleared.');
          fetchHistory();
        }
      } catch (err) {
        logToTerminal(`History Clear Error: ${err.message}`, true);
      }
    });
  }

  btnRefreshTasks.addEventListener('click', fetchTasks);
  btnRefreshSessions.addEventListener('click', fetchSessions);

  // 11. Core Controls (Start/Stop Daemon & Clear)
  btnStartSystem.addEventListener('click', async () => {
    logToTerminal('Initializing Swarm coordination daemon...');
    termStatus.innerText = 'Starting...';
    try {
      const response = await fetch('/api/swarm/init', { method: 'POST' });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';
      if (result.success) {
        logToTerminal(`DAEMON SUCCESS:\n${result.stdout}`);
        checkStatus();
      } else {
        logToTerminal(`DAEMON START FAILED:\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Daemon Start Error: ${err.message}`, true);
    }
  });

  btnStopSystem.addEventListener('click', async () => {
    logToTerminal('Stopping Swarm coordination daemon...');
    termStatus.innerText = 'Stopping...';
    try {
      const response = await fetch('/api/swarm/stop', { method: 'POST' });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';
      if (result.success) {
        logToTerminal(`DAEMON STOP SUCCESS:\n${result.stdout}`);
      } else {
        logToTerminal(`DAEMON STOP FAILED:\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Daemon Stop Error: ${err.message}`, true);
    }
  });

  btnClearStore.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the Swarm Agent database configuration registry?')) return;
    logToTerminal('Resetting and cleaning the Swarm store database...');
    try {
      const response = await fetch('/api/store/clear', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        logToTerminal('System cleanup successful!');
        checkStatus();
      } else {
        logToTerminal(`CLEANUP FAILED:\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      logToTerminal(`Store Clear Error: ${err.message}`, true);
    }
  });

  btnRefreshAgents.addEventListener('click', checkStatus);

  // Initialize and run
  if (localStorage.getItem('ruflo_authenticated') === 'true') {
    loginOverlay.classList.add('hidden');
    checkStatus();
    if (typeof fetchHistory === 'function') fetchHistory();
  } else {
    loginOverlay.classList.remove('hidden');
  }

  setInterval(() => {
    if (localStorage.getItem('ruflo_authenticated') === 'true') {
      checkStatus();
    }
  }, 3000);
});
