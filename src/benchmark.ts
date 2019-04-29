export type Runnable = () => any;

export interface Runnables {
  [name: string]: Runnable;
}

export { timethese };

function time() {
  return Date.now();
}

async function timethese(
  output: (stats: { [name: string]: number }) => void | undefined,
  count: number,
  these: Runnables
): Promise<void> {
  const cheap = Array(count);

  const run = async (f: Runnable) => {
    const before = time();
    for (const round of cheap) {
      await f();
    }
    const after = time();

    return {
      timesExecuted: count,
      iterationsPerSecond: 1000 * (count / (after - before)),
    };
  };

  const result = {};

  for (const name of Object.keys(these)) {
    result[name] = await run(these[name]);
  }

  output(result);
}
