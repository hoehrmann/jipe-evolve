#!/usr/bin/env node
import * as child_process from 'child_process';
import traverse = require('traverse');
import * as json_templates from './jsonTemplates';
import { evolve as ev } from './jipe-evolve-protocol';
import { api } from 'node-jipe';
import split2 = require('split2');
import { Writable } from 'stream';

class Features {
  textchanges = ev.textchanges;
}

class EvolveTextchanges extends api.Jipe<Features>
  implements api.Interface<Features> {
  async textchanges(
    params: api.Params<ev.textchanges>
  ): api.Promised<ev.textchanges> {
    const child = child_process.spawn(
      'bash',
      [
        '-c',
        `diff -day --suppress-common-lines <(tee <&3) - | wc -l`,
      ],
      {
        shell: false,
        stdio: ['pipe', 'pipe', 'inherit', 'pipe'],
      }
    );

    const result = new Promise<string>((resolve, reject) => {
      let acc = '';
      if (child.stdout) {
        child.stdout.on('data', (data) => (acc = acc + data));
        child.stdout.on('close', () => resolve(acc));
      }
    });

    if (child.stdio[3]) {
      const w = child.stdio[3] as Writable;
      w.write(params.lhs);
      w.end();
    }

    if (child.stdin) {
      const w = child.stdin;
      w.write(params.rhs);
      w.end();
    }

    const resultx = { textchanges: parseInt(await result, 10) };
    return resultx;
  }
}

async function main() {
  const us = new EvolveTextchanges();
  await us.start(new Features(), process.stdin, process.stdout);
}

main();
