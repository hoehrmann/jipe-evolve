import traverse = require('traverse');

// FIXME: in dire need of cleanup

function choose(from: any[]): any {
  return from[Math.floor(Math.random() * from.length)];
}

function withoutNulls(solution: any) {
  return JSON.parse(
    JSON.stringify(solution, (key, value) => {
      if (value === null) {
        return undefined;
      }
      {
        return value;
      }
    })
  );
}

export function generateRandom(template: any) {
  return JSON.parse(
    JSON.stringify(template, (key, value) => {
      if (value instanceof Array) {
        const chosen = choose(value);
        return null === chosen ? undefined : chosen;
      }
      {
        return value;
      }
    })
  );
}

export function combineSolutions(template: any, solutions: any[]) {
  // fixme
  const combined = generateRandom(template);
  const ctx = traverse(combined);
  const contexts = solutions.map(traverse);

  ctx.forEach(function(value) {
    const chosen = choose(contexts).get(this.path);
    this.update(chosen);
  });

  return withoutNulls(combined);
}

export function withoutMany(template: any, solution: any) {
  const optionsCtx = traverse(template);
  const ctx = traverse(solution);
  const paths = optionsCtx.paths().filter((path) => {
    const value = optionsCtx.get(path);
    return Array.isArray(value);
  });

  paths.forEach((path) => {
    if (Math.random() < 0.1) {
      const canNull =
        optionsCtx.get(path).filter((x) => x === null).length > 0;

      if (canNull) {
        ctx.set(path, null);
      }
    }
  });
}

export function templateVariate(template: any, solution: any) {
  const optionsCtx = traverse(template);

  const paths = optionsCtx.paths().filter((path) => {
    const value = optionsCtx.get(path);
    return Array.isArray(value);
  });

  if (true && Math.random() < 0.1) {
    withoutMany(template, solution);
  } else {
    const chosen = choose(paths);
    const ctx = traverse(solution);
    const oldValue = ctx.get(chosen);

    const newValue = choose(
      optionsCtx.get(chosen).filter((x) => x !== oldValue)
    );

    ctx.set(chosen, newValue);
  }

  return withoutNulls(solution);
}
