#!/usr/bin/env node
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as prettier from 'prettier';
import traverse = require('traverse');
import { evolve as ev, Solution } from './jipe-evolve-protocol';
import { api } from 'node-jipe';
import { Writable } from 'stream';
import split2 = require('split2');

import {
  UncrustifyTemplate,
  UncrustifyDefaults,
} from './jipe-evolve-uncrustify-data';
import commandLineArgs = require('command-line-args');
import { execUncrustify } from './exec-uncrustify';

class Features {
  template = ev.template;
  measure = ev.measure;
}

class EvolveUncrustify extends api.Jipe<Features>
  implements api.Interface<Features> {
  protected files: string[];
  constructor(options: { files: string[] }) {
    super();
    this.files = options.files;
  }

  async template(
    params: api.Params<ev.template>
  ): api.Promised<ev.template> {
    return {
      template: UncrustifyTemplate,
    };
  }

  private async uncrustify(
    solution: Solution,
    code: string
  ): Promise<string> {
    return execUncrustify(solution, code);
  }

  async measure(
    params: api.Params<ev.measure>
  ): api.Promised<ev.measure> {
    const path = this.files[0];

    const lhs = fs
      .readFileSync(path)
      .toString()
      .replace(/ +$/gms, '');

    const rhs = await this.uncrustify(params.solution, lhs);

    if (rhs.length > 4 * lhs.length) {
      throw 'bad';
    }

    const [mlhs, mrhs] = [lhs, rhs].map((x) =>
      x.replace(/(\w+|\s+|.)/gs, '$1\n')
    );

    const changes = await this.channel.requestResult(ev.textchanges, {
      lhs: mlhs,
      rhs: mrhs,
    });

    const changes2 = await this.channel.requestResult(
      ev.textchanges,
      {
        lhs: lhs,
        rhs: rhs,
      }
    );

    const changeCount = changes.textchanges;

    const metrics = {
      metrics: {},
    };

    const ctx = traverse(params.solution);
    const ctx2 = traverse(UncrustifyDefaults);
    let counter = 0;
    ctx.forEach(function(v) {
      if (v !== ctx2.get(this.path)) {
        counter++;
      } else {
      }
    });

    metrics.metrics[path] = {
      changeCount: -changeCount,
      changes2: -changes2.textchanges,
      plusOptions: -(
        changeCount * changeCount +
        changes2.textchanges * changes2.textchanges +
        counter * counter +
        ctx.paths().length
      ),
    };

    return metrics;
  }

  async requestPopulate() {
    try {
      await this.channel.requestResult(ev.populate, {
        solutions: [UncrustifyDefaults],
      });
    } catch (e) {}
  }
}

async function main() {
  const options = commandLineArgs(
    [
      {
        name: 'files',
        // TODO: only one file allowed at the moment
        multiple: true,
        type: String,
      },
    ],
    {
      stopAtFirstUnknown: true,
    }
  );

  if (!options.files || !options.files.length) {
    process.exit(1);
  }

  const us = new EvolveUncrustify({ files: options.files });
  await us.start(new Features(), process.stdin, process.stdout, {
    concurrency: 4,
  });
  await us.requestPopulate();
}

main();
