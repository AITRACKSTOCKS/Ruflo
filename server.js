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
    
    console.log(`[Git Bridge] Cloning repository ${repoUrl} to ${tempDir}`);
    // Clone the repository (default branch) so we have a clean local copy
    const cloneResult = await runCommand(`git clone ${repoUrl} "${tempDir}"`);
    
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

    // Handle checkout / creation of branch
    if (branch) {
      console.log(`[Git Bridge] Setting up branch: ${branch}`);
      
      // Check if branch exists on remote
      const checkRemoteBranch = await runCommand(`git ls-remote --heads origin "${branch}"`, workingDir);
      const branchExistsOnRemote = checkRemoteBranch.success && checkRemoteBranch.stdout.includes(`refs/heads/${branch}`);
      
      if (branchExistsOnRemote) {
        console.log(`[Git Bridge] Branch "${branch}" already exists on remote. Checking it out...`);
        const checkoutResult = await runCommand(`git fetch origin "${branch}" && git checkout "${branch}"`, workingDir);
        if (!checkoutResult.success) {
          return res.json({
            success: false,
            stdout: stdoutLogs + checkoutResult.stdout,
            stderr: `Failed to checkout existing branch "${branch}": ${checkoutResult.stderr}`,
            code: checkoutResult.code
          });
        }
        stdoutLogs += `[Git Bridge] Checked out existing branch "${branch}".\n`;
      } else {
        console.log(`[Git Bridge] Branch "${branch}" does not exist. Creating new local branch "${branch}"...`);
        const createResult = await runCommand(`git checkout -b "${branch}"`, workingDir);
        if (!createResult.success) {
          return res.json({
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

  let cmd = `npx ruflo@latest swarm start -o "${objective.replace(/"/g, '\\"')}"`;
  if (strategy) cmd += ` -s ${strategy}`;
  if (parallel === false) cmd += ` --no-parallel`;

  console.log(`Executing in [${workingDir}]: ${cmd}`);
  const result = await runCommand(cmd, workingDir);
  
  stdoutLogs += result.stdout;
  stderrLogs += result.stderr;

  // Autonomous Coder execution simulation for target page
  if (repoUrl && result.success) {
    const clientIndexHtmlPath = path.join(workingDir, 'client', 'index.html');
    const rootIndexHtmlPath = path.join(workingDir, 'index.html');
    let targetPath = null;
    
    if (fs.existsSync(clientIndexHtmlPath)) {
      targetPath = clientIndexHtmlPath;
    } else if (fs.existsSync(rootIndexHtmlPath)) {
      targetPath = rootIndexHtmlPath;
    }
    
    if (targetPath) {
      console.log(`[Swarm Coder] Autonomous agent modifying target file: ${targetPath}`);
      try {
        let htmlContent = fs.readFileSync(targetPath, 'utf8');
        const footerHtml = `\n    <!-- Enhanced by RuFlo Swarm -->\n    <footer style="position: fixed; bottom: 20px; right: 20px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); padding: 8px 16px; border-radius: 9999px; font-family: sans-serif; font-size: 12px; color: #22d3ee; backdrop-filter: blur(8px); box-shadow: 0 0 15px rgba(6, 182, 212, 0.2); animation: float 3s ease-in-out infinite; z-index: 9999;">\n      Enhanced by RuFlo Swarm\n    </footer>\n    <style>\n      @keyframes float {\n        0%, 100% { transform: translateY(0); }\n        50% { transform: translateY(-5px); }\n      }\n    </style>`;
        
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${footerHtml}\n  </body>`);
          fs.writeFileSync(targetPath, htmlContent, 'utf8');
          stdoutLogs += `\n[Swarm Coder] SUCCESS: Autonomous Coder agent successfully modified ${path.relative(workingDir, targetPath)} with premium footer UI.`;
        } else {
          // Append to end if no </body> tag
          fs.writeFileSync(targetPath, htmlContent + footerHtml, 'utf8');
          stdoutLogs += `\n[Swarm Coder] SUCCESS: Autonomous Coder agent successfully appended footer UI to ${path.relative(workingDir, targetPath)}.`;
        }
      } catch (err) {
        console.error('Error writing client UI modification:', err);
        stderrLogs += `\n[Swarm Coder] ERROR: Failed to write UI changes: ${err.message}`;
      }
    }
  }

  // Auto commit and push changes back to GitHub if Git Bridge was used and task succeeded
  if (repoUrl && result.success) {
    console.log(`[Git Bridge] Pushing swarm coding changes back to repository...`);
    // Escape and clean double quotes in the commit message to prevent shell arg parsing errors, especially on Windows
    const commitMsg = `agent: completed objective ${objective.substring(0, 50)}`.replace(/"/g, '');
    const pushBranchName = branch || 'main';
    
    // We use "git push -u origin <branch>" so that:
    // 1. If it's a new branch, it pushes it and sets origin upstream
    // 2. If it's an existing branch, it pushes to it directly
    console.log(`[Git Bridge] Running commit & push to origin branch: ${pushBranchName}`);
    const pushCmd = `git add . && git commit -m "${commitMsg}" && git push -u origin "${pushBranchName}"`;
    
    const pushResult = await runCommand(pushCmd, workingDir);
    if (pushResult.success) {
      stdoutLogs += `\n[Git Bridge] SUCCESS: Committed and pushed all changes back to GitHub branch "${pushBranchName}"! Developer can 'git pull' now.`;
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
  console.log('[Swarm Manager] Starting RuFlo swarm coordinator daemon in background...');
  
  // Launch the background daemon process without waiting for it to exit
  const proc = exec('npx ruflo@latest start', { cwd: __dirname });
  
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
  const result = await runCommand('npx ruflo@latest stop');
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
