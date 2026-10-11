// Veröffentlicht dist/ auf dem Branch gh-pages (GitHub Pages, ohne Actions).
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();
const dir = mkdtempSync(join(tmpdir(), 'leute-pages-'));
cpSync('dist', dir, { recursive: true });
writeFileSync(join(dir, '.nojekyll'), '');
run('git init -q -b gh-pages', dir);
run('git add -A', dir);
run('git -c user.name="Tobias Kosiek" -c user.email="334156478+ToKoDev1@users.noreply.github.com" commit -q -m "Deploy"', dir);
run(`git push -q -f ${remote} gh-pages`, dir);
rmSync(dir, { recursive: true, force: true });
console.log('Veröffentlicht: https://tokodev1.github.io/Friend_CRM/');
