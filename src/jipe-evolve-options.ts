#!/usr/bin/env node
import traverse = require('traverse');
import * as json_templates from './jsonTemplates';
import { evolve as ev } from './jipe-evolve-protocol';
import { api } from 'node-jipe';

class Features {
  generate = ev.generate;
  variate = ev.variate;
  combine = ev.combine;
}

class EvolveOptions extends api.Jipe<Features>
  implements api.Interface<Features> {
  private initialised;
  protected template;

  constructor() {
    super();

    this.template = new Promise((resolve) => {
      this.initialised = resolve;
    });
  }

  async requestTemplate(): api.Promised<ev.template> {
    const result = await this.channel.requestResult(ev.template, {});
    this.template = result.template;
    this.initialised(this.template);
    return result;
  }

  async generate(
    params: api.Params<ev.generate>
  ): api.Promised<ev.generate> {
    const solution = json_templates.generateRandom(
      await this.template
    );

    return {
      solution: solution,
    };
  }

  async variate(
    params: api.Params<ev.variate>
  ): api.Promised<ev.variate> {
    let solution = json_templates.templateVariate(
      await this.template,
      params.solution
    );

    return { solution: solution };
  }

  async combine(
    params: api.Params<ev.combine>
  ): api.Promised<ev.combine> {
    const solution = json_templates.combineSolutions(
      await this.template,
      params.solutions
    );

    return { solution: solution };
  }
}

async function main() {
  const us = new EvolveOptions();
  await us.start(new Features(), process.stdin, process.stdout);
  await us.requestTemplate();
}

main();
