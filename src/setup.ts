import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return undefined;
}

function findClaudeConfigPath(): string {
  const platform = os.platform();
  const home = os.homedir();
  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      path.join(home, 'Library', 'Application Support', 'Claude Desktop', 'claude_desktop_config.json'),
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(
      path.join(appData, 'Claude', 'claude_desktop_config.json'),
      path.join(appData, 'Claude Desktop', 'claude_desktop_config.json'),
    );
  } else {
    candidates.push(
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      path.join(home, '.config', 'Claude Desktop', 'claude_desktop_config.json'),
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function buildMcpServerEntry(email: string, apiKey: string): Record<string, unknown> {
  const env: Record<string, string> = {};
  if (email) env.OPENALEX_EMAIL = email;
  if (apiKey) env.OPENALEX_API_KEY = apiKey;

  const entry: Record<string, unknown> = {
    command: 'npx',
    args: ['-y', 'openalex-research-mcp'],
  };
  if (Object.keys(env).length > 0) entry.env = env;
  return entry;
}

function readConfig(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function writeConfig(configPath: string, serverEntry: Record<string, unknown>): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let config = readConfig(configPath);
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }
  (config.mcpServers as Record<string, unknown>).openalex = serverEntry;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // Non-TTY (e.g. piped input): fall back to plain readline
    return ask(prompt);
  }
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf-8');

    const chars: string[] = [];
    function handler(char: string) {
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        resolve(chars.join(''));
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.exit(0);
      } else if (char === '\x7f') {
        // Backspace
        if (chars.length > 0) chars.pop();
      } else {
        chars.push(char);
      }
    }
    process.stdin.on('data', handler);
  });
}

function obfuscate(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '***' + key.slice(-4);
}

async function checkConnectivity(email: string, apiKey: string): Promise<void> {
  process.stdout.write('\nChecking connectivity with OpenAlex API...');
  try {
    const params: Record<string, string> = { per_page: '1' };
    if (apiKey) params.api_key = apiKey;
    else if (email) params.mailto = email;

    const response = await axios.get('https://api.openalex.org/works', {
      params,
      timeout: 10000,
    });
    if (response.status === 200) {
      console.log(' ✅ Connected successfully!');
    } else {
      console.log(` ⚠️  Unexpected response (status ${response.status})`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(` ❌ Connection failed: ${msg}`);
    console.log('  (Config was saved — check your network or credentials.)');
  }
}

export async function runSetup(argv: string[]): Promise<void> {
  const printOnly = argv.includes('--print');
  const configPathOnly = argv.includes('--config-path');
  const emailFlag = getFlag(argv, '--email');
  const apiKeyFlag = getFlag(argv, '--api-key');

  const configPath = findClaudeConfigPath();

  if (configPathOnly) {
    console.log(configPath);
    return;
  }

  if (!printOnly) {
    console.log('=== OpenAlex MCP Server Setup ===\n');
    console.log('This will add the openalex-research-mcp server to your Claude Desktop config.\n');
  }

  let email = emailFlag ?? '';
  let apiKey = apiKeyFlag ?? '';

  if (!emailFlag) {
    email = await ask('Email address (for OpenAlex polite pool, recommended): ');
  }

  if (!apiKeyFlag) {
    apiKey = await askHidden('OpenAlex API key (press Enter to skip): ');
    apiKey = apiKey.trim();
  }

  const serverEntry = buildMcpServerEntry(email, apiKey);

  if (printOnly) {
    const snippet = { mcpServers: { openalex: serverEntry } };
    console.log('\nPaste this into your claude_desktop_config.json:\n');
    console.log(JSON.stringify(snippet, null, 2));
    console.log(`\nDetected config path: ${configPath}`);
    return;
  }

  if (email) console.log(`\nEmail:   ${email}`);
  if (apiKey) console.log(`API Key: ${obfuscate(apiKey)}`);

  // Attempt to write config, offer recovery on invalid JSON
  let writeSuccess = false;
  try {
    writeConfig(configPath, serverEntry);
    writeSuccess = true;
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      console.error(`\n⚠️  Existing config at ${configPath} contains invalid JSON.`);
      const choice = await ask('Create a new config file? This will overwrite the existing one. [y/N]: ');
      if (choice.toLowerCase() === 'y') {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fresh: Record<string, unknown> = { mcpServers: { openalex: serverEntry } };
        fs.writeFileSync(configPath, JSON.stringify(fresh, null, 2) + '\n', 'utf-8');
        writeSuccess = true;
      } else {
        console.log('\nAborted. No changes written.');
        return;
      }
    } else {
      throw err;
    }
  }

  if (writeSuccess) {
    console.log(`\n✅ Config written to: ${configPath}`);
  }

  await checkConnectivity(email, apiKey);

  console.log('\nRestart Claude Desktop (or your MCP client) to apply changes.');
  console.log('Then try: "Find recent papers on large language models"\n');
}
