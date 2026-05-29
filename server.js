const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
    exec(cmd, { cwd: customCwd }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? error.code : 0
      });
    });
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

// 2. Spawn a New Specialist Agent
app.post('/api/agent/spawn', async (req, res) => {
  const { type, provider, model, task } = req.body;
  if (!type || !task) {
    return res.status(400).json({ error: 'Agent type and task are required.' });
  }

  let cmd = `npx ruflo@latest agent spawn -t ${type}`;
  if (provider) cmd += ` -p ${provider}`;
  if (model) cmd += ` -m ${model}`;
  cmd += ` --task "${task.replace(/"/g, '\\"')}"`;

  console.log(`Executing: ${cmd}`);
  const result = await runCommand(cmd);
  res.json(result);
});

// 3. Start Swarm Execution (Supports Git Bridge & Local workspaces)
app.post('/api/swarm/start', async (req, res) => {
  const { objective, strategy, parallel, repoUrl, branch } = req.body;
  if (!objective) {
    return res.status(400).json({ error: 'Objective is required.' });
  }

  let workingDir = __dirname;
  let stdoutLogs = '';
  let stderrLogs = '';

  // Git Bridge Target Workspace Orchestration
  if (repoUrl) {
    const jobId = Date.now();
    const tempDir = path.join(__dirname, 'temp', 'jobs', `job-${jobId}`);
    
    fs.mkdirSync(path.join(__dirname, 'temp', 'jobs'), { recursive: true });
    
    console.log(`[Git Bridge] Cloning ${repoUrl} (branch: ${branch || 'main'}) to ${tempDir}`);
    const cloneBranch = branch ? `-b ${branch}` : '';
    const cloneResult = await runCommand(`git clone ${cloneBranch} ${repoUrl} "${tempDir}"`);
    
    if (!cloneResult.success) {
      return res.json({
        success: false,
        stdout: cloneResult.stdout,
        stderr: `Failed to clone repository: ${cloneResult.stderr}`,
        code: cloneResult.code
      });
    }
    
    workingDir = tempDir;
    stdoutLogs += `[Git Bridge] Cloned repository successfully!\n`;
  }

  let cmd = `npx ruflo@latest swarm start -o "${objective.replace(/"/g, '\\"')}"`;
  if (strategy) cmd += ` -s ${strategy}`;
  if (parallel === false) cmd += ` --no-parallel`;

  console.log(`Executing in [${workingDir}]: ${cmd}`);
  const result = await runCommand(cmd, workingDir);
  
  stdoutLogs += result.stdout;
  stderrLogs += result.stderr;

  // Auto commit and push changes back to GitHub if Git Bridge was used and task succeeded
  if (repoUrl && result.success) {
    console.log(`[Git Bridge] Pushing swarm coding changes back to repository...`);
    const commitMsg = `agent: completed objective "${objective.substring(0, 50)}"`;
    
    const pushResult = await runCommand(`git add . && git commit -m "${commitMsg}" && git push`, workingDir);
    if (pushResult.success) {
      stdoutLogs += `\n[Git Bridge] SUCCESS: Committed and pushed all changes back to GitHub branch! Developer can 'git pull' now.`;
    } else {
      stderrLogs += `\n[Git Bridge] PUSH WARNING: Code modified successfully, but failed to auto-push: ${pushResult.stderr}`;
    }
  }

  res.json({
    success: result.success,
    stdout: stdoutLogs,
    stderr: stderrLogs,
    code: result.code
  });
});

// 4. Memory & Vector Operations
app.post('/api/memory/search', async (req, res) => {
  const { query, namespace } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required.' });

  let cmd = `npx ruflo@latest memory search -q "${query.replace(/"/g, '\\"')}"`;
  if (namespace) cmd += ` --namespace ${namespace}`;

  console.log(`Executing: ${cmd}`);
  const result = await runCommand(cmd);
  res.json(result);
});

app.post('/api/memory/store', async (req, res) => {
  const { key, value, namespace } = req.body;
  if (!key || !value) return res.status(400).json({ error: 'Key and Value are required.' });

  let cmd = `npx ruflo@latest memory store --key "${key.replace(/"/g, '\\"')}" --value "${value.replace(/"/g, '\\"')}"`;
  if (namespace) cmd += ` --namespace ${namespace}`;

  console.log(`Executing: ${cmd}`);
  const result = await runCommand(cmd);
  res.json(result);
});

// 5. Security & Threat Scans
app.post('/api/security/scan', async (req, res) => {
  console.log('Running security scan...');
  const result = await runCommand('npx ruflo@latest security scan');
  res.json(result);
});

app.post('/api/security/verify', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'File path is required.' });
  
  const result = await runCommand(`npx ruflo@latest security verify --file "${filePath.replace(/"/g, '\\"')}"`);
  res.json(result);
});

// 6. Performance & Benchmarking
app.post('/api/performance/benchmark', async (req, res) => {
  console.log('Running system benchmark...');
  const result = await runCommand('npx ruflo@latest performance benchmark');
  res.json(result);
});

// 7. Background Hooks Worker Dispatch
app.post('/api/hooks/dispatch', async (req, res) => {
  const { worker } = req.body;
  if (!worker) return res.status(400).json({ error: 'Worker trigger name is required.' });

  const result = await runCommand(`npx ruflo@latest hooks worker dispatch --trigger ${worker}`);
  res.json(result);
});

// 8. Autopilot Persistence
app.post('/api/autopilot/toggle', async (req, res) => {
  const { enable } = req.body;
  const action = enable ? 'enable' : 'disable';
  const result = await runCommand(`npx ruflo@latest autopilot ${action}`);
  res.json(result);
});

// 9. Tasks & Sessions Listings
app.get('/api/tasks', async (req, res) => {
  const result = await runCommand('npx ruflo@latest task list --format json');
  
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
  const result = await runCommand('npx ruflo@latest session list --format json');
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

// 10. Swarm Controls
app.post('/api/swarm/init', async (req, res) => {
  const result = await runCommand('npx ruflo@latest start');
  res.json(result);
});

app.post('/api/swarm/stop', async (req, res) => {
  const result = await runCommand('npx ruflo@latest start stop');
  res.json(result);
});

app.post('/api/store/clear', async (req, res) => {
  const result = await runCommand('npx ruflo@latest cleanup');
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 RuFlo All-Capability Command Center running on http://localhost:${PORT}`);
  console.log(`===================================================`);
});
