import * as child_process from 'child_process';
import { fail } from 'assert';

export function execClangFormat(
  args: string[],
  code?: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = child_process.execFile(
      'clang-format',
      args,
      {
        encoding: 'buffer',
        cwd: process.cwd(),
        env: {},
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      }
    );

    if (code && child.stdin) {
      child.stdin.write(code);
      child.stdin.end();
    } else if (code) {
      fail();
    }
  });
}
