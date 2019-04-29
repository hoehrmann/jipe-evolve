#!/usr/bin/env node
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as prettier from 'prettier';
import traverse = require('traverse');
import { evolve as ev } from './jipe-evolve-protocol';
import { api } from 'node-jipe';
import { Writable } from 'stream';
import split2 = require('split2');

class Features {
  template = ev.template;
  measure = ev.measure;
}

const PrettierTemplate = {
  semi: [null, true, false],
  singleQuote: [null, true, false],
  jsxSingleQuote: [null, true, false],
  trailingComma: [null, 'none', 'es5', 'all'],
  bracketSpacing: [null, true, false],
  jsxBracketSameLine: [null, true, false],
  proseWrap: [null, 'always', 'never', 'preserve'],
  arrowParens: [null, 'avoid', 'always'],
  htmlWhitespaceSensitivity: [null, 'css', 'strict', 'ignore'],
  endOfLine: [null, 'auto', 'lf', 'crlf', 'cr'],
  printWidth: [null, 70, 72, 74, 76, 78, 80, 84, 88, 89, 90, 98],
  tabWidth: [null, 1, 2, 3, 4, 5, 6, 7, 8],
  useTabs: [null, true, false],
};

class EvolvePrettier extends api.Jipe<Features>
  implements api.Interface<Features> {
  constructor() {
    super();
  }

  async template(
    params: api.Params<ev.template>
  ): api.Promised<ev.template> {
    return {
      template: PrettierTemplate,
    };
  }

  async measure(
    params: api.Params<ev.measure>
  ): api.Promised<ev.measure> {
    const path = '/home/bjoern/dev/node-jipe/src/channel.ts';

    const lhs = fs.readFileSync(path).toString();

    const rhs = prettier.format(lhs, {
      ...params.solution,
      parser: 'typescript',
    });

    const [mlhs, mrhs] = [lhs, rhs].map((x) =>
      x.replace(/(\w+|\s+|.)/gs, '$1\n')
    );

    const change = await this.channel.requestResult(ev.textchanges, {
      lhs: mlhs,
      rhs: mrhs,
    });

    const changeCount = change.textchanges;

    const metrics = {
      metrics: {},
    };

    const ctx = traverse(params.solution);

    metrics.metrics[path] = {
      changeCount: -changeCount,
      plusOptions: -(changeCount + ctx.paths().length),
    };

    return metrics;
  }
}

async function main() {
  const us = new EvolvePrettier();
  await us.start(new Features(), process.stdin, process.stdout);
}

main();
