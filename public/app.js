document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Navigation Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const activeTabTitle = document.getElementById('active-tab-title');

  // DOM Elements - Core Actions
  const btnStartSystem = document.getElementById('btn-start-system');
  const btnStopSystem = document.getElementById('btn-stop-system');
  const btnClearStore = document.getElementById('btn-clear-store');
  const btnRefreshAgents = document.getElementById('btn-refresh-agents');
  const btnClearTerminal = document.getElementById('btn-clear-terminal');
  
  // DOM Elements - Forms & Inputs
  const formSpawnAgent = document.getElementById('form-spawn-agent');
  const formSwarmObjective = document.getElementById('form-swarm-objective');
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
      }
    });
  });

  // 2. Terminal Logger
  function logToTerminal(text, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const formattedText = `\n[${timestamp}] ${text}`;
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

  // 4. Form Submits: Spawn Specialist Agent
  formSpawnAgent.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('agent-type').value;
    const provider = document.getElementById('agent-provider').value;
    const model = document.getElementById('agent-model').value;
    const task = document.getElementById('agent-task').value;

    logToTerminal(`Spawn Request -> Specialist [${type}] via ${provider} (${model})`);
    termStatus.innerText = 'Spawning agent...';

    try {
      const response = await fetch('/api/agent/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, provider, model, task })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';
      
      if (result.success) {
        logToTerminal(`SPAWN SUCCESS:\n${result.stdout}`);
        checkStatus();
      } else {
        logToTerminal(`SPAWN FAILED (Code ${result.code}):\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Request Error: ${err.message}`, true);
    }
  });

  // 5. Form Submits: Deploy Swarm Mission
  formSwarmObjective.addEventListener('submit', async (e) => {
    e.preventDefault();
    const objective = document.getElementById('swarm-objective').value;
    const strategy = document.getElementById('swarm-strategy').value;
    const parallel = document.getElementById('swarm-parallel').value === 'true';

    logToTerminal(`Deploying Swarm Mission -> "${objective}" (Strategy: ${strategy})`);
    termStatus.innerText = 'Swarm active...';

    try {
      const response = await fetch('/api/swarm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, strategy, parallel })
      });
      const result = await response.json();
      termStatus.innerText = 'Terminal Ready';
      
      if (result.success) {
        logToTerminal(`MISSION DEPLOYED SUCCESS:\n${result.stdout}`);
        checkStatus();
      } else {
        logToTerminal(`MISSION DEPLOYED FAILED:\n${result.stderr || result.stdout}`, true);
      }
    } catch (err) {
      termStatus.innerText = 'Error';
      logToTerminal(`Request Error: ${err.message}`, true);
    }
  });

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
            <span>Matched memories for query: <strong>"${query}"</strong></span>
            <pre class="code-snippet">${result.stdout || 'No semantic matching memory fragments found.'}</pre>
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
            <pre class="code-snippet">${result.stdout || 'Scan complete. Codebase is clean!'}</pre>
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
            <span>Boundary: <strong>"${filePath}"</strong></span>
            <pre class="code-snippet">${result.stdout || 'Verification report details empty.'}</pre>
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
            <pre class="code-snippet">${result.stdout || 'Profiling benchmarks loaded.'}</pre>
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
  checkStatus();
  setInterval(checkStatus, 3000);
});
