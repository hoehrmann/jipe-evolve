import * as fs from 'fs';
import * as child_process from 'child_process';
import { fail } from 'assert';
import { Solution } from './jipe-evolve-protocol';

export async function execUncrustify(
  solution: Solution,
  code: string
): Promise<string> {
  const config = Object.keys(solution)
    .map((x) => {
      return `${x} = ${solution[x]}`;
    })
    .join('\n');

  // FIXME: bad
  fs.writeFileSync('delme.tmp', config);

  const child = child_process.spawn(
    'timeout',
    ['1s', 'uncrustify', '-c', `delme.tmp`],
    {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    }
  );

  if (child.stdin) {
    child.stdin.write(code, () => {
      if (child.stdin) {
        child.stdin.end();
      }
    });
  }

  let data: string = '';

  if (child.stdout) {
    child.stdout.on('data', (d) => (data = data + d.toString()));
    child.stdout.on('error', () => {});
  }

  await new Promise((resolve, reject) => {
    child.once('close', resolve);
  });

  return data;
}
