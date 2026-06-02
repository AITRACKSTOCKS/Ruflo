const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');

// Load environment variables from local .env file (if it exists)
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  const envConfig = fs.readFileSync(dotenvPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, ''); // Strip outer quotes
      process.env[key] = val;
    }
  });
}

// Global Resilience Handlers to prevent any unhandled child socket drops from crashing the Node.js Express process (nodemon.json is now active)
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] Prevented crash:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Prevented crash at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path definitions
const configPath = path.join(__dirname, 'claude-flow.config.json');
const storePath = path.join(__dirname, '.claude-flow', 'agents', 'store.json');

// Helper to run shell commands safely
function runCommand(cmd, customCwd = __dirname) {
  return new Promise((resolve) => {
    const env = { 
      ...process.env, 
      GIT_TERMINAL_PROMPT: '0', 
      GIT_ASKPASS: 'echo', 
      GCM_INTERACTIVE: 'never' 
    };
    exec(cmd, { cwd: customCwd, env }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? error.code : 0
      });
    });
  });
}

// Secure PowerShell script generation helpers to prevent shell escaping/quotation parse errors on Windows systems
function runCommandSafe(objective, strategy, parallel, workingDir = __dirname) {
  return new Promise((resolve) => {
    const jobId = Date.now();
    const scriptPath = path.join(__dirname, `temp_run_${jobId}.ps1`);
    const binPath = path.join(__dirname, 'node_modules', 'ruflo', 'bin', 'ruflo.js');
    
    // Construct PS1 script. Use literal single quotes for arguments. Double internal single-quotes to escape.
    const psScript = `$env:GIT_TERMINAL_PROMPT="0"
$env:GIT_ASKPASS="echo"
$env:GCM_INTERACTIVE="never"
${process.env.OPENAI_API_KEY ? `$env:OPENAI_API_KEY="${process.env.OPENAI_API_KEY}"` : ''}
node '${binPath.replace(/'/g, "''")}' swarm start -o '${objective.replace(/'/g, "''")}'${strategy ? ` -s ${strategy}` : ''}${parallel === false ? ' --no-parallel' : ''}
`;

    try {
      fs.writeFileSync(scriptPath, psScript, 'utf8');
      
      console.log(`[Safe Exec] Executing temp script: ${scriptPath}`);
      execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { cwd: workingDir, env: { ...process.env } }, (error, stdout, stderr) => {
        // Safe cleanup
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          console.error('[Safe Exec] Temporary script cleanup failed:', e);
        }
        
        resolve({
          success: !error,
          stdout: stdout || '',
          stderr: stderr || '',
          code: error ? error.code : 0
        });
      });
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: `Failed to initialize script bridge: ${err.message}`,
        code: -1
      });
    }
  });
}

function runAgentSafe(type, provider, model, task, workingDir = __dirname) {
  return new Promise((resolve) => {
    const jobId = Date.now();
    const scriptPath = path.join(__dirname, `temp_agent_${jobId}.ps1`);
    const binPath = path.join(__dirname, 'node_modules', 'ruflo', 'bin', 'ruflo.js');
    
    // Construct PS1 script. Use literal single quotes for task. Double internal single-quotes to escape.
    const psScript = `$env:GIT_TERMINAL_PROMPT="0"
$env:GIT_ASKPASS="echo"
$env:GCM_INTERACTIVE="never"
node '${binPath.replace(/'/g, "''")}' agent spawn -t ${type}${provider ? ` -p ${provider}` : ''}${model ? ` -m ${model}` : ''} --task '${task.replace(/'/g, "''")}'
`;

    try {
      fs.writeFileSync(scriptPath, psScript, 'utf8');
      
      console.log(`[Safe Agent] Executing temp script: ${scriptPath}`);
      execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { cwd: workingDir }, (error, stdout, stderr) => {
        // Safe cleanup
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          console.error('[Safe Agent] Temporary script cleanup failed:', e);
        }
        
        resolve({
          success: !error,
          stdout: stdout || '',
          stderr: stderr || '',
          code: error ? error.code : 0
        });
      });
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: `Failed to initialize agent bridge: ${err.message}`,
        code: -1
      });
    }
  });
}

function runCommandSafeStream(objective, strategy, parallel, workingDir, onData) {
  return new Promise((resolve) => {
    const jobId = Date.now();
    const scriptPath = path.join(__dirname, `temp_run_${jobId}.ps1`);
    const binPath = path.join(__dirname, 'node_modules', 'ruflo', 'bin', 'ruflo.js');
    
    // Construct PS1 script. Use literal single quotes for arguments. Double internal single-quotes to escape.
    const psScript = `$env:GIT_TERMINAL_PROMPT="0"
$env:GIT_ASKPASS="echo"
$env:GCM_INTERACTIVE="never"
node '${binPath.replace(/'/g, "''")}' swarm start -o '${objective.replace(/'/g, "''")}'${strategy ? ` -s ${strategy}` : ''}${parallel === false ? ' --no-parallel' : ''}
`;

    try {
      fs.writeFileSync(scriptPath, psScript, 'utf8');
      
      console.log(`[Safe Stream Exec] Executing temp script: ${scriptPath}`);
      const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
        cwd: workingDir,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
          GCM_INTERACTIVE: 'never'
        },
        shell: false
      });
      
      let stdout = '';
      let stderr = '';
      
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          stdout += text;
          onData({ type: 'log', data: text });
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          const text = data.toString();
          stderr += text;
          onData({ type: 'log', data: text });
        });
      }
      
      proc.on('close', (code) => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          console.error('[Safe Stream Exec] Temporary script cleanup failed:', e);
        }
        
        resolve({
          success: code === 0,
          stdout,
          stderr,
          code
        });
      });
      
      proc.on('error', (err) => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {}
        
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          code: -1
        });
      });
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: `Failed to initialize script stream bridge: ${err.message}`,
        code: -1
      });
    }
  });
}

function runAgentSafeStream(type, provider, model, task, workingDir, onData) {
  return new Promise((resolve) => {
    const jobId = Date.now();
    const scriptPath = path.join(__dirname, `temp_agent_${jobId}.ps1`);
    const binPath = path.join(__dirname, 'node_modules', 'ruflo', 'bin', 'ruflo.js');
    
    // Construct PS1 script. Use literal single quotes for task. Double internal single-quotes to escape.
    const psScript = `$env:GIT_TERMINAL_PROMPT="0"
$env:GIT_ASKPASS="echo"
$env:GCM_INTERACTIVE="never"
node '${binPath.replace(/'/g, "''")}' agent spawn -t ${type}${provider ? ` -p ${provider}` : ''}${model ? ` -m ${model}` : ''} --task '${task.replace(/'/g, "''")}'
`;

    try {
      fs.writeFileSync(scriptPath, psScript, 'utf8');
      
      console.log(`[Safe Agent Stream] Executing temp script: ${scriptPath}`);
      const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
        cwd: workingDir,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
          GCM_INTERACTIVE: 'never'
        },
        shell: false
      });
      
      let stdout = '';
      let stderr = '';
      
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          stdout += text;
          onData({ type: 'log', data: text });
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          const text = data.toString();
          stderr += text;
          onData({ type: 'log', data: text });
        });
      }
      
      proc.on('close', (code) => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          console.error('[Safe Agent Stream] Temporary script cleanup failed:', e);
        }
        
        resolve({
          success: code === 0,
          stdout,
          stderr,
          code
        });
      });
      
      proc.on('error', (err) => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {}
        
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          code: -1
        });
      });
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: `Failed to initialize agent stream bridge: ${err.message}`,
        code: -1
      });
    }
  });
}


// 1. Get System Status & Settings
app.get('/api/status', (req, res) => {
  let config = {};
  let agents = {};

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error('Error parsing config:', e);
    }
  }

  if (fs.existsSync(storePath)) {
    try {
      const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      agents = storeData.agents || {};
    } catch (e) {
      console.error('Error parsing agent store:', e);
    }
  }

  res.json({
    config,
    agents,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    }
  });
});

// 1b. Save Settings (API key, model)
app.post('/api/settings/save', (req, res) => {
  const { apiKey, model } = req.body;
  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    if (!config.agents) config.agents = {};
    if (!config.agents.providers) config.agents.providers = [];
    const openaiIdx = config.agents.providers.findIndex(p => p.name === 'openai');
    const entry = { name: 'openai', enabled: true, apiKey: apiKey || '', model: model || 'gpt-4.1' };
    if (openaiIdx >= 0) {
      config.agents.providers[openaiIdx] = entry;
    } else {
      config.agents.providers.push(entry);
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. Spawn a New Specialist Agent
app.post('/api/agent/spawn', async (req, res) => {
  const { type, provider, model, task } = req.body;
  if (!type || !task) {
    return res.status(400).json({ error: 'Agent type and task are required.' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const onData = (packet) => {
    if (!res.destroyed && res.writable) {
      res.write(JSON.stringify(packet) + '\n');
    }
  };

  const result = await runAgentSafeStream(type, provider, model, task, __dirname, onData);

  if (!res.destroyed && res.writable) {
    res.write(JSON.stringify({
      type: 'result',
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    }) + '\n');
    res.end();
  }
});

// Helper to save missions to local persistent JSON file
function saveMissionToHistory(record) {
  const historyDir = path.join(__dirname, 'data');
  const historyFile = path.join(historyDir, 'mission_history.json');
  try {
    fs.mkdirSync(historyDir, { recursive: true });
    let history = [];
    if (fs.existsSync(historyFile)) {
      try {
        const fileContent = fs.readFileSync(historyFile, 'utf8');
        history = JSON.parse(fileContent || '[]');
      } catch (err) {
        history = [];
      }
    }
    history.push(record);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.error('[History Manager] Failed to write to history:', err);
  }
}

// 3. Start Swarm Execution (Supports Git Bridge & Local workspaces)
app.post('/api/swarm/start', async (req, res) => {
  const { objective, strategy, parallel, repoUrl, branch } = req.body;
  if (!objective) {
    return res.status(400).json({ error: 'Objective is required.' });
  }

  console.log(`\n===================================================`);
  console.log(`🚀 [Swarm Mission Initiated]`);
  console.log(`Objective: "${objective}"`);
  console.log(`Repository: ${repoUrl || 'Local Workspace'}`);
  console.log(`Branch: ${branch || 'default'}`);
  console.log(`===================================================\n`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Keepalive heartbeat every 15s to prevent browser dropping long-running streams
  const heartbeat = setInterval(() => {
    if (!res.destroyed && res.writable) {
      res.write(JSON.stringify({ type: 'ping', data: '.' }) + '\n');
    }
  }, 15000);

  const onData = (packet) => {
    if (packet.type === 'log') {
      process.stdout.write(`[SERVER Swarm Log] ${packet.data}`);
    }
    if (!res.destroyed && res.writable) {
      res.write(JSON.stringify(packet) + '\n');
    }
  };

  const safeEnd = (data) => {
    clearInterval(heartbeat);
    console.log(`\n===================================================`);
    if (data.success) {
      console.log(`✅ [Swarm Mission Succeeded]`);
    } else {
      console.error(`❌ [Swarm Mission Failed]`);
      console.error(`Error details:`, data.stderr || 'Unknown error');
    }
    console.log(`===================================================\n`);
    
    // Save to persistent history log
    const changesArray = [];
    if (typeof allChanges !== 'undefined' && allChanges && allChanges.forEach) {
      allChanges.forEach((val, fp) => {
        changesArray.push({ file: fp, agent: val.agentName });
      });
    }
    
    saveMissionToHistory({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      prompt: objective,
      repoUrl,
      branch: branch || 'main',
      success: !!data.success,
      changes: changesArray,
      stdout: data.stdout || stdoutLogs || '',
      stderr: data.stderr || stderrLogs || ''
    });

    if (!res.destroyed && res.writable) {
      res.write(JSON.stringify(data) + '\n');
      res.end();
    }
  };

  let workingDir = null;
  let stdoutLogs = '';
  let stderrLogs = '';

  // Require a GitHub repo URL — swarm agents need a target repo to work on
  if (!repoUrl) {
    return safeEnd({ type: 'result', success: false, stdout: '', stderr: '[Swarm] A GitHub Repository URL is required. Please configure your repo in the settings panel before deploying a mission.', code: 1 });
  }

  // Git Bridge Target Workspace Orchestration
  if (repoUrl) {
    onData({ type: 'log', data: `[Git Bridge] Initializing repository: ${repoUrl}\n` });
    const jobId = Date.now();
    const tempDir = path.join(os.tmpdir(), 'ruflo-jobs', `job-${jobId}`);
    
    fs.mkdirSync(path.join(os.tmpdir(), 'ruflo-jobs'), { recursive: true });
    
    onData({ type: 'log', data: `[Git Bridge] Cloning repository to temporary workspace...\n` });
    const cloneResult = await runCommand(`git clone ${repoUrl} "${tempDir}"`);
    
    if (!cloneResult.success) {
      return safeEnd({
        type: 'result',
        success: false,
        stdout: cloneResult.stdout,
        stderr: `Failed to clone repository: ${cloneResult.stderr}`,
        code: cloneResult.code
      });
    }
    
    workingDir = tempDir;
    stdoutLogs += `[Git Bridge] Cloned repository successfully!\n`;
    onData({ type: 'log', data: `[Git Bridge] Cloned repository successfully!\n` });

    // Handle checkout / creation of branch
    if (branch) {
      onData({ type: 'log', data: `[Git Bridge] Setting up branch: ${branch}\n` });
      
      // Check if branch exists on remote
      const checkRemoteBranch = await runCommand(`git ls-remote --heads origin "${branch}"`, workingDir);
      const branchExistsOnRemote = checkRemoteBranch.success && checkRemoteBranch.stdout.includes(`refs/heads/${branch}`);
      
      if (branchExistsOnRemote) {
        onData({ type: 'log', data: `[Git Bridge] Branch "${branch}" already exists on remote. Checking it out...\n` });
        const checkoutResult = await runCommand(`git fetch origin "${branch}" && git checkout "${branch}"`, workingDir);
        if (!checkoutResult.success) {
          return safeEnd({
            type: 'result',
            success: false,
            stdout: stdoutLogs + checkoutResult.stdout,
            stderr: `Failed to checkout existing branch "${branch}": ${checkoutResult.stderr}`,
            code: checkoutResult.code
          });
        }
        stdoutLogs += `[Git Bridge] Checked out existing branch "${branch}".\n`;
      } else {
        onData({ type: 'log', data: `[Git Bridge] Branch "${branch}" does not exist. Creating new local branch "${branch}"...\n` });
        const createResult = await runCommand(`git checkout -b "${branch}"`, workingDir);
        if (!createResult.success) {
          return safeEnd({
            type: 'result',
            success: false,
            stdout: stdoutLogs + createResult.stdout,
            stderr: `Failed to create new branch "${branch}": ${createResult.stderr}`,
            code: createResult.code
          });
        }
        stdoutLogs += `[Git Bridge] Created and checked out new branch "${branch}".\n`;
      }
    }
  }

  // ============================================================
  // INTELLIGENT ORCHESTRATED SWARM PIPELINE
  // Phase 1: Planner decides which agents are needed
  // Phase 2: Only needed agents run (parallel where possible)
  // Phase 3: Tester verifies output
  // Phase 4: Fix loop until Tester passes (max 3 iterations)
  // ============================================================
  onData({ type: 'log', data: `[Orchestrator] Initializing intelligent swarm pipeline...\n` });

  // Load API key
  let apiKey = '';
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      apiKey = (cfg.agents && cfg.agents.providers && cfg.agents.providers.find(p => p.name === 'openai') || {}).apiKey || '';
    }
  } catch(e) {}
  if (!apiKey) {
    return safeEnd({ type: 'result', success: false, stdout: stdoutLogs, stderr: '[Swarm Error] No OpenAI API key configured.', code: 1 });
  }

  // ── SMART FILE COLLECTION (only cloned repo, relevance-scored) ──
  onData({ type: 'log', data: `[Orchestrator] Scanning cloned repository files...\n` });

  const editableExts = new Set(['.html', '.js', '.css', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.py', '.vue', '.svelte', '.php', '.rb', '.go', '.java', '.c', '.cpp', '.h']);
  const ignoreDirs  = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'vendor', 'coverage', '.cache', 'tmp', 'temp']);

  // File type priority scores (higher = more important to include)
  const typePriority = { '.html':10, '.jsx':9, '.tsx':9, '.vue':9, '.svelte':9, '.js':8, '.ts':8, '.py':8, '.css':7, '.scss':7, '.json':5, '.md':3, '.txt':2 };

  function collectFiles(dir, depth = 0) {
    if (depth > 4) return [];
    let out = [];
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignoreDirs.has(e.name) || e.name.startsWith('.')) continue;
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) out = out.concat(collectFiles(fp, depth + 1));
        else if (editableExts.has(path.extname(e.name).toLowerCase())) out.push(fp);
      }
    } catch(e) {}
    return out;
  }

  // Score each file by relevance to the objective
  function scoreFile(fp, objectiveLower) {
    const relPath = path.relative(workingDir, fp).replace(/\\/g, '/').toLowerCase();
    const ext = path.extname(fp).toLowerCase();
    let score = typePriority[ext] || 1;

    // Keyword match: split objective into words, score each word hit in path
    const words = objectiveLower.split(/\W+/).filter(w => w.length > 2);
    for (const word of words) {
      if (relPath.includes(word)) score += 8;
    }

    // Boost common entry files
    const basename = path.basename(fp).toLowerCase();
    if (['index.html','index.js','index.ts','app.js','app.ts','main.js','main.ts','app.jsx','app.tsx'].includes(basename)) score += 6;
    if (basename.includes('config') || basename.includes('setting')) score += 3;
    if (relPath.includes('src/') || relPath.includes('app/') || relPath.includes('pages/')) score += 4;
    if (relPath.includes('test') || relPath.includes('spec')) score -= 2;

    return score;
  }

  const objectiveLower = objective.toLowerCase();
  const allFiles = collectFiles(workingDir);

  // Sort by relevance score descending, take top 20 files
  const scoredFiles = allFiles
    .map(fp => ({ fp, score: scoreFile(fp, objectiveLower) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(x => x.fp);

  onData({ type: 'log', data: `[Orchestrator] ${allFiles.length} files found → selected top ${scoredFiles.length} most relevant files for GPT context.\n` });

  // Build file context — cap total at ~60KB to stay well within token limits
  function buildFileContext(files) {
    let totalChars = 0;
    const MAX_TOTAL = 60000;
    const MAX_PER_FILE = 4000;
    const parts = [];
    for (const fp of files) {
      try {
        const content = fs.readFileSync(fp, 'utf8');
        const relPath = path.relative(workingDir, fp).replace(/\\/g, '/');
        const slice = content.length > MAX_PER_FILE ? content.substring(0, MAX_PER_FILE) + '\n... [truncated]' : content;
        const entry = `=== FILE: ${relPath} ===\n${slice}`;
        if (totalChars + entry.length > MAX_TOTAL) break;
        parts.push(entry);
        totalChars += entry.length;
      } catch(e) {}
    }
    return parts.join('\n\n');
  }

  // Core GPT caller
  async function gptCall(systemPrompt, userPrompt, maxTokens = 6000, temp = 0.2) {
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: temp,
        max_tokens: maxTokens
      })
    });
    if (!apiRes.ok) throw new Error(`API ${apiRes.status}: ${await apiRes.text()}`);
    const d = await apiRes.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }

  function parseJSON(raw) {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  }

  // Initial file context uses scored/filtered files
  const fileContext = buildFileContext(scoredFiles);

  // ── PHASE 1: PLANNER ────────────────────────────────────────
  onData({ type: 'log', data: `[Orchestrator] 🧠 Planner analysing task...\n` });

  const plannerSystem = `You are the ORCHESTRATOR of a multi-agent AI coding swarm.
Your job: Analyse the user's objective and decide which specialist agents are needed.

Available agents:
- "researcher": Needed when the task requires finding information, understanding APIs, or investigating existing code patterns
- "architect":  Needed when the task involves structural changes, new files/folders, config changes, or system design
- "coder":      ALWAYS needed — implements the actual code changes
- "reviewer":   Needed when the task touches security, performance, accessibility, or complex logic
- "tester":     ALWAYS needed — verifies the changes work correctly

Return ONLY valid JSON (no markdown):
{
  "agents_needed": ["researcher", "architect", "coder", "reviewer", "tester"],
  "reasoning": "brief explanation of why each agent is/isn't needed",
  "execution_order": [["researcher"], ["architect"], ["coder", "reviewer"], ["tester"]],
  "task_type": "ui_change|logic_change|config_change|refactor|new_feature|docs_only"
}
Notes on execution_order:
- Groups in the same array run IN PARALLEL
- Groups are sequential (next group waits for previous)
- "coder" must always be in agents_needed
- "tester" must always be last`;

  let plan;
  try {
    const planRaw = await gptCall(plannerSystem, `Objective: ${objective}\n\nProject structure:\n${fileContext.substring(0, 3000)}`, 1000, 0.1);
    plan = parseJSON(planRaw);
    onData({ type: 'log', data: `[Orchestrator] 📋 Plan: ${plan.task_type} task. Agents: ${plan.agents_needed.join(', ')}\n` });
    onData({ type: 'log', data: `[Orchestrator] 💡 Reasoning: ${plan.reasoning}\n` });
  } catch(err) {
    // Fallback plan if planner fails
    plan = {
      agents_needed: ['coder', 'tester'],
      execution_order: [['coder'], ['tester']],
      task_type: 'unknown',
      reasoning: 'Planner failed, using minimal fallback'
    };
    onData({ type: 'log', data: `[Orchestrator] ⚠️ Planner error (${err.message}), using fallback plan.\n` });
  }

  // ── AGENT DEFINITIONS ────────────────────────────────────────
  const jsonFormat = `
Return ONLY valid JSON (no markdown fences):
{
  "changes": [{ "path": "relative/file/path", "content": "COMPLETE new file content" }],
  "summary": "one-line summary",
  "issues_found": "any problems noticed for other agents (or empty string)"
}
Rules: COMPLETE content only. Exact path match. Only changed files.`;

  const agentPrompts = {
    researcher: `You are the RESEARCHER agent in an AI coding swarm.
Investigate the codebase to understand patterns, existing implementations, and relevant context for the objective.
If research leads to no file changes, return empty changes array but fill "issues_found" with your findings.${jsonFormat}`,

    architect: `You are the ARCHITECT agent in an AI coding swarm.
Design and implement structural changes: new files, folder structure, config updates, package.json changes.
Do NOT write feature implementation code — focus on structure only.${jsonFormat}`,

    coder: `You are the SENIOR CODER agent in an AI coding swarm.
Implement the objective precisely and completely. Write clean, production-ready code.
You are the primary implementer — make the exact changes the user requested.${jsonFormat}`,

    reviewer: `You are the CODE REVIEWER agent in an AI coding swarm.
Review the code relevant to the objective. Fix bugs, security holes, accessibility issues, and code quality problems.
Do NOT re-implement what Coder already does — focus on issues and improvements only.${jsonFormat}`,

    tester: `You are the QA TESTER agent in an AI coding swarm.
Your job: Verify the objective was achieved by inspecting the current files.
Create or update test files if applicable. Check for regressions.
Return in this exact JSON format (no markdown):
{
  "passed": true or false,
  "issues": ["list of specific problems found, empty if passed"],
  "changes": [{ "path": "path/to/test/file", "content": "COMPLETE test file content" }],
  "summary": "what was tested and result"
}`
  };

  // ── PHASE 2 & 3: EXECUTE AGENTS IN ORDER ─────────────────────
  const allChanges = new Map(); // path -> { content, agentName }
  let stdoutAgentLog = '';

  async function runAgent(agentName, currentFiles) {
    onData({ type: 'log', data: `[${agentName.toUpperCase()}] 🚀 Starting...\n` });
    try {
      const currentContext = buildFileContext(currentFiles);
      const raw = await gptCall(agentPrompts[agentName], `Objective: ${objective}\n\nCurrent project files:\n${currentContext}`, 8000, agentName === 'reviewer' ? 0.1 : 0.2);
      const result = parseJSON(raw);
      const changes = result.changes || [];
      onData({ type: 'log', data: `[${agentName.toUpperCase()}] ✅ Done. ${changes.length} file(s) changed.\n` });
      if (result.issues_found) {
        onData({ type: 'log', data: `[${agentName.toUpperCase()}] 📝 Notes: ${result.issues_found}\n` });
      }
      stdoutAgentLog += `[${agentName.toUpperCase()}] ${result.summary || 'completed'}\n`;
      return { changes, summary: result.summary || '', issues: result.issues_found || '' };
    } catch(err) {
      onData({ type: 'log', data: `[${agentName.toUpperCase()}] ⚠️ Error: ${err.message}\n` });
      return { changes: [], summary: '', issues: err.message };
    }
  }

  function applyChanges(changes, agentName) {
    for (const change of changes) {
      if (change.path && change.content) {
        allChanges.set(change.path, { content: change.content, agentName });
        // Also write to disk so subsequent agents see updated files
        const targetPath = path.join(workingDir, change.path);
        try {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, change.content, 'utf8');
        } catch(e) {}
      }
    }
  }

  // Execute each group in the execution order (groups within same array run in parallel)
  const executionGroups = plan.execution_order || [['coder'], ['tester']];
  const agentsToRun = new Set(plan.agents_needed || ['coder', 'tester']);

  for (const group of executionGroups) {
    const validGroup = group.filter(a => a !== 'tester' && agentsToRun.has(a)); // tester runs separately in phase 3
    if (validGroup.length === 0) continue;

    onData({ type: 'log', data: `[Orchestrator] ⚡ Running in parallel: [${validGroup.join(', ')}]\n` });
    // Re-scan + re-score to include any newly written files
    const currentFiles = collectFiles(workingDir)
      .map(fp => ({ fp, score: scoreFile(fp, objectiveLower) }))
      .sort((a, b) => b.score - a.score).slice(0, 20).map(x => x.fp);

    const groupResults = await Promise.all(validGroup.map(agentName => runAgent(agentName, currentFiles)));

    // Apply changes — later agents in priority order win conflicts
    // Reviewer > Coder > Architect > Researcher
    const groupPriority = ['researcher', 'architect', 'coder', 'reviewer'];
    for (const agentName of groupPriority) {
      const result = groupResults[validGroup.indexOf(agentName)];
      if (result) applyChanges(result.changes, agentName);
    }
  }

  // ── PHASE 3: TESTER + FIX LOOP ───────────────────────────────
  const MAX_LOOPS = 3;
  let loopCount = 0;
  let testPassed = false;

  while (loopCount < MAX_LOOPS && !testPassed) {
    loopCount++;
    onData({ type: 'log', data: `\n[TESTER] 🧪 Verification loop ${loopCount}/${MAX_LOOPS}...\n` });

    const currentFiles = collectFiles(workingDir)
      .map(fp => ({ fp, score: scoreFile(fp, objectiveLower) }))
      .sort((a, b) => b.score - a.score).slice(0, 20).map(x => x.fp);
    const currentContext = buildFileContext(currentFiles);

    let testResult;
    try {
      const raw = await gptCall(agentPrompts.tester, `Objective: ${objective}\n\nCurrent project files:\n${currentContext}`, 4000, 0.1);
      testResult = parseJSON(raw);
    } catch(err) {
      onData({ type: 'log', data: `[TESTER] ⚠️ Test parse error: ${err.message}. Assuming passed.\n` });
      testPassed = true;
      break;
    }

    // Write any test files the tester created
    if (testResult.changes && testResult.changes.length > 0) {
      applyChanges(testResult.changes, 'Tester');
    }

    onData({ type: 'log', data: `[TESTER] Result: ${testResult.passed ? '✅ PASSED' : '❌ FAILED'}\n` });
    if (testResult.summary) {
      onData({ type: 'log', data: `[TESTER] 📋 ${testResult.summary}\n` });
    }

    if (testResult.passed) {
      testPassed = true;
      stdoutAgentLog += `[TESTER] ✅ Verification passed on loop ${loopCount}\n`;
    } else {
      // Issues found — Coder fixes them
      const issues = (testResult.issues || []).join('; ');
      onData({ type: 'log', data: `[TESTER] Issues: ${issues}\n` });
      stdoutAgentLog += `[TESTER] ❌ Loop ${loopCount} failed: ${issues}\n`;

      if (loopCount < MAX_LOOPS) {
        onData({ type: 'log', data: `[CODER] 🔧 Fixing issues reported by Tester...\n` });
        const fixPrompt = agentPrompts.coder + `\n\nIMPORTANT: The Tester found these issues that must be fixed:\n${issues}`;
        const fixFiles = collectFiles(workingDir)
          .map(fp => ({ fp, score: scoreFile(fp, objectiveLower) }))
          .sort((a, b) => b.score - a.score).slice(0, 20).map(x => x.fp);
        const fixResult = await runAgent('coder', fixFiles);
        applyChanges(fixResult.changes, 'Coder (fix)');
      }
    }
  }

  if (!testPassed) {
    onData({ type: 'log', data: `[Orchestrator] ⚠️ Max loops reached. Proceeding with best effort result.\n` });
  }

  // ── FINAL: Write all changes and commit ───────────────────────
  if (allChanges.size === 0) {
    return safeEnd({ type: 'result', success: false, stdout: stdoutLogs, stderr: '[Swarm] No file changes were produced.', code: 1 });
  }

  onData({ type: 'log', data: `\n[Orchestrator] 📦 ${allChanges.size} file(s) modified total:\n` });
  for (const [filePath, { agentName }] of allChanges) {
    stdoutLogs += `  ✅ ${filePath} (by ${agentName})\n`;
    onData({ type: 'log', data: `  ✅ ${filePath} (by ${agentName})\n` });
  }
  stdoutLogs += `\n[Agent Log]\n${stdoutAgentLog}`;

  if (repoUrl) {
    onData({ type: 'log', data: `[Git Bridge] Committing and pushing to remote...\n` });
    const commitMsg = `swarm(${plan.task_type}): ${objective.substring(0, 65)}`.replace(/"/g, '');
    const pushBranch = branch || 'main';
    const pushResult = await runCommand(`git add . && git commit -m "${commitMsg}" && git push -u origin "${pushBranch}"`, workingDir);
    if (pushResult.success) {
      stdoutLogs += `[Git Bridge] ✅ Pushed to "${pushBranch}" successfully!\n`;
      onData({ type: 'log', data: `[Git Bridge] ✅ Pushed to GitHub branch "${pushBranch}"!\n` });
    } else {
      const errDetail = (pushResult.stderr || pushResult.stdout || 'Unknown Git Error').trim();
      stderrLogs += `[Git Bridge] ⚠️ Push failed: ${errDetail}\n`;
      onData({ type: 'log', data: `[Git Bridge] ⚠️ Push failed: ${errDetail}\n` });
    }
  }

  safeEnd({ type: 'result', success: true, stdout: stdoutLogs, stderr: stderrLogs, code: 0 });
});


// 4. Memory & Vector Operations
app.post('/api/memory/search', async (req, res) => {
  const { query, namespace } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required.' });

  let cmd = `npx -y ruflo@latest memory search -q "${query.replace(/"/g, '\\"')}"`;
  if (namespace) cmd += ` --namespace ${namespace}`;

  console.log(`Executing: ${cmd}`);
  const result = await runCommand(cmd);
  res.json(result);
});

app.post('/api/memory/store', async (req, res) => {
  const { key, value, namespace } = req.body;
  if (!key || !value) return res.status(400).json({ error: 'Key and Value are required.' });

  let cmd = `npx -y ruflo@latest memory store --key "${key.replace(/"/g, '\\"')}" --value "${value.replace(/"/g, '\\"')}"`;
  if (namespace) cmd += ` --namespace ${namespace}`;

  console.log(`Executing: ${cmd}`);
  const result = await runCommand(cmd);
  res.json(result);
});

// 5. Security & Threat Scans
app.post('/api/security/scan', async (req, res) => {
  console.log('Running security scan...');
  const result = await runCommand('npx -y ruflo@latest security scan');
  res.json(result);
});

app.post('/api/security/verify', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'File path is required.' });
  
  const result = await runCommand(`npx -y ruflo@latest security verify --file "${filePath.replace(/"/g, '\\"')}"`);
  res.json(result);
});

// 6. Performance & Benchmarking
app.post('/api/performance/benchmark', async (req, res) => {
  console.log('Running system benchmark...');
  const result = await runCommand('npx -y ruflo@latest performance benchmark');
  res.json(result);
});

// 7. Background Hooks Worker Dispatch
app.post('/api/hooks/dispatch', async (req, res) => {
  const { worker } = req.body;
  if (!worker) return res.status(400).json({ error: 'Worker trigger name is required.' });

  const result = await runCommand(`npx -y ruflo@latest hooks worker dispatch --trigger ${worker}`);
  res.json(result);
});

// 8. Autopilot Persistence
app.post('/api/autopilot/toggle', async (req, res) => {
  const { enable } = req.body;
  const action = enable ? 'enable' : 'disable';
  const result = await runCommand(`npx -y ruflo@latest autopilot ${action}`);
  res.json(result);
});

// 9. Tasks & Sessions Listings
app.get('/api/tasks', async (req, res) => {
  const result = await runCommand('npx -y ruflo@latest task list --format json');
  
  if (result.success) {
    try {
      const data = JSON.parse(result.stdout);
      res.json(data);
    } catch (e) {
      // Fallback if formatting is text table
      res.json({ textData: result.stdout });
    }
  } else {
    res.json({ textData: 'No active tasks found in Swarm.' });
  }
});

app.get('/api/sessions', async (req, res) => {
  const result = await runCommand('npx -y ruflo@latest session list --format json');
  if (result.success) {
    try {
      const data = JSON.parse(result.stdout);
      res.json(data);
    } catch (e) {
      res.json({ textData: result.stdout });
    }
  } else {
    res.json({ textData: 'No active sessions found.' });
  }
});

app.get('/api/history', (req, res) => {
  const historyFile = path.join(__dirname, 'data', 'mission_history.json');
  if (!fs.existsSync(historyFile)) {
    return res.json([]);
  }
  try {
    const content = fs.readFileSync(historyFile, 'utf8');
    const history = JSON.parse(content || '[]');
    res.json(history.reverse()); // Show newest first
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/history/clear', (req, res) => {
  const historyFile = path.join(__dirname, 'data', 'mission_history.json');
  try {
    fs.writeFileSync(historyFile, '[]');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 10. Swarm Controls
app.post('/api/swarm/init', async (req, res) => {
  console.log('[Swarm Manager] Starting RuFlo swarm coordinator daemon in background...');
  
  // Launch the background daemon process without waiting for it to exit
  const proc = exec('npx -y ruflo@latest start', { cwd: __dirname });
  
  let stdoutData = '';
  let stderrData = '';
  
  proc.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });
  
  proc.stderr.on('data', (data) => {
    stderrData += data.toString();
  });
  
  // Wait exactly 2.5 seconds for the daemon to boot and complete initial health checks
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  console.log('[Swarm Manager] Daemon initialized successfully.');
  res.json({
    success: true,
    stdout: stdoutData || 'RuFlo Coordination Swarm started successfully in background!',
    stderr: stderrData,
    code: 0
  });
});

app.post('/api/swarm/stop', async (req, res) => {
  console.log('[Swarm Manager] Stopping background swarm daemon...');
  const result = await runCommand('npx -y ruflo@latest stop');
  res.json(result);
});

app.post('/api/store/clear', async (req, res) => {
  const result = await runCommand('npx -y ruflo@latest cleanup');
  res.json(result);
});

const server = app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 RuFlo All-Capability Command Center running on http://localhost:${PORT}`);
  console.log(`===================================================`);
});
server.timeout = 900000; // 15 minutes socket timeout to support long running agent tasks
