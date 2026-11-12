import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');
const ignored = spawnSync('git', ['check-ignore', '-q', '.env'], { cwd: root });
if (ignored.status !== 0) {
  console.error('Refusing to write credentials: .env is not ignored by Git.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt, hidden = false) => new Promise((resolve) => {
  if (!hidden) return rl.question(prompt, resolve);
  process.stdout.write(prompt);
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  stdin.setRawMode?.(true);
  let value = '';
  const onData = (chunk) => {
    const text = chunk.toString();
    if (text === '\u0003') { stdin.setRawMode?.(wasRaw ?? false); stdin.off('data', onData); rl.close(); process.exit(130); }
    if (text === '\r' || text === '\n') { stdin.setRawMode?.(wasRaw ?? false); stdin.off('data', onData); process.stdout.write('\n'); resolve(value); return; }
    if (text === '\u007f') { value = value.slice(0, -1); return; }
    value += text;
  };
  stdin.on('data', onData);
});

const values = {
  R2_ACCOUNT_ID: await ask('R2_ACCOUNT_ID: '),
  R2_BUCKET_NAME: 'ewsplat-media',
  R2_ACCESS_KEY_ID: await ask('R2_ACCESS_KEY_ID: '),
  R2_SECRET_ACCESS_KEY: await ask('R2_SECRET_ACCESS_KEY: ', true),
  R2_PUBLIC_MEDIA_BASE_URL: await ask('R2_PUBLIC_MEDIA_BASE_URL: '),
};
rl.close();

if (Object.entries(values).some(([key, value]) => key !== 'R2_BUCKET_NAME' && !value.trim())) {
  console.error('Credential entry cancelled: required values were not provided.');
  process.exit(1);
}

const quote = (value) => JSON.stringify(value);
fs.writeFileSync(envPath, Object.entries(values).map(([key, value]) => `${key}=${quote(value.trim())}`).join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
console.log('R2 credentials saved locally');
