#!/usr/bin/env node

import * as fs from 'fs';
import * as child_process from 'child_process';
import { basename } from 'path';

import split2 = require('split2');
import traverse = require('traverse');
import * as tmp from 'tmp';
import * as yaml from 'yaml';

import { execClangFormat } from './exec-clang-format';
import { Readable, Writable } from 'stream';

import * as json_templates from './jsonTemplates';
import { Channel } from 'node-jipe';

import { evolve as ev } from './jipe-evolve-protocol';
import { api } from 'node-jipe';

import { ClangFormatTemplate } from './jipe-evolve-clang-format-data';
import commandLineArgs = require('command-line-args');

function choose(from: any[]): any {
  return from[Math.floor(Math.random() * from.length)];
}

interface ClangFormatSolverOptions {
  files: string[];
}

class Features {
  measure = ev.measure;
  template = ev.template;
}

class ClangFormatSolver extends api.Jipe<Features>
  implements api.Interface<Features> {
  private tempdir;
  protected files: string[];

  public constructor(options: ClangFormatSolverOptions) {
    super();

    this.files = options.files;

    tmp.setGracefulCleanup();

    this.tempdir = this.createTempDir();
  }

  private createTempDir() {
    try {
      return tmp.dirSync({
        dir: `/run/user/${process.getuid()}/`,
        prefix: `${basename(__filename)}-`,
        unsafeCleanup: true,
      });
    } catch (e) {}

    return tmp.dirSync({
      unsafeCleanup: true,
    });
  }

  private async getMetrics(solution: any): Promise<any> {
    if (!solution) {
      return null;
    }

    const metrics: any = {
      totalLineChanges: 0,
      totalWordChanges: 0,
    };

    await Promise.all(
      this.files.map(async (file) => {
        const lhsBuffer = fs.readFileSync(file);

        const rhs = await execClangFormat(
          [`-style=${JSON.stringify(solution)}`, `-`],
          lhsBuffer
        );

        const [mlhs, mrhs] = [
          lhsBuffer.toString(),
          rhs.toString(),
        ].map((x) => x.replace(/(\w+|\s+|.)/gs, '$1\n'));

        const changes = await this.channel.requestResult(
          ev.textchanges,
          {
            lhs: mlhs,
            rhs: mrhs,
          }
        );

        const textChanges = changes.textchanges;

        metrics[file] = {
          lineChanges: -textChanges,
        };

        metrics.totalLineChanges -= textChanges;
      })
    );

    const ctx = traverse(solution);
    metrics.omitted = -ctx.paths().length;

    return metrics;
  }

  ///////////////////////////////////////////////////////////////////
  // Helper functions.
  ///////////////////////////////////////////////////////////////////

  private async generatePreset(preset: string) {
    return {
      BasedOnStyle: preset,
    };
  }

  private async generatePresetExpanded(preset: string) {
    const dumped = await execClangFormat([
      `-style={"BasedOnStyle":"${preset}"}`,
      `-dump-config`,
    ]);

    const [wrapped] = yaml.parseAllDocuments(dumped.toString());
    const parsed = wrapped.toJSON();

    // FIXME: path
    const template = ClangFormatTemplate;

    const templateCtx = traverse(template);

    const ctx = traverse(parsed);
    ctx.forEach(function(elem) {
      if (!templateCtx.has(this.path)) {
        this.delete();
      }
    });

    return parsed;
  }

  ///////////////////////////////////////////////////////////////////
  // Protocol requests.
  ///////////////////////////////////////////////////////////////////

  async requestPopulate(): api.Promised<ev.populate> {
    const options = [
      () => this.generatePresetExpanded('GNU'),
      () => this.generatePresetExpanded('LLVM'),
      () => this.generatePresetExpanded('Google'),
      () => this.generatePresetExpanded('Chromium'),
      () => this.generatePresetExpanded('Mozilla'),
      () => this.generatePresetExpanded('WebKit'),
    ];

    const solutions = options.map((x) => x());

    return this.channel.sendNotification(ev.populate, {
      solutions: await Promise.all(solutions),
    });
  }

  public template(
    params: api.Params<ev.template>
  ): api.Result<ev.template> {
    const template = ClangFormatTemplate;

    return {
      template: template,
    };
  }

  public async measure(
    params: api.Params<ev.measure>
  ): api.Promised<ev.measure> {
    const metrics = await this.getMetrics(params.solution);

    return {
      metrics: metrics,
    };
  }
}

async function main() {
  const options = commandLineArgs(
    [
      {
        name: 'files',
        multiple: true,
        type: String,
      },
    ],
    {
      stopAtFirstUnknown: true,
    }
  );

  const us = new ClangFormatSolver({
    files: options.files,
  });

  const f = new Features();

  us.start(f, process.stdin, process.stdout);
  await us.requestPopulate();
}

main();
