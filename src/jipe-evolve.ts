import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as child_process from 'child_process';
import express = require('express');
import { AddressInfo } from 'net';
import commandLineArgs = require('command-line-args');
import { Channel, api } from 'node-jipe';
import { dirname } from 'path';
import { Solution, Metrics } from './jipe-evolve-protocol';
import { EvolveDB, SolutionId } from './evolveDB';
import { evolve as ev } from './jipe-evolve-protocol';
import { Dashboard } from './dashboard';
import { table } from 'table';

class Features {
  populate = ev.populate;
}

class Evolve extends api.Jipe<Features>
  implements api.Interface<Features> {
  public db: EvolveDB;

  async initDB(dbPath: string) {
    this.db = new EvolveDB();
    await this.db.open(dbPath);
    await this.db.deploySchema();
  }

  async register() {
    this.db.on('new-solution', (solution) => {
      this.channel
        .requestResult(ev.measure, {
          solution: solution,
        })
        .catch(() => {});
      // ^ swallow exceptions
    });

    this.channel.onResult(ev.measure, (result, request) => {
      this.handleMeasure(request.params, result);
    });

    this.channel.onResult(ev.generate, (result, request) => {
      this.handleGenerate(request.params, result);
    });

    this.channel.onResult(ev.variate, (result, request) => {
      this.handleVariate(request.params, result);
    });

    this.channel.onResult(ev.combine, (result, request) => {
      this.handleCombine(request.params, result);
    });
  }

  async addSolutions(solutions: Solution[]): Promise<SolutionId[]> {
    return Promise.all(solutions.map((s) => this.db.addSolution(s)));
  }

  async addDerivedSolutions(from: Solution[], derived: Solution[]) {
    const idFrom = await this.addSolutions(from);
    const idDerived = await this.addSolutions(derived);

    this.db.addDerivation(idFrom, idDerived);
  }

  async addMetrics(solution: Solution, metrics: Metrics) {
    this.db.addMetrics(solution, metrics);
  }

  async populate(
    params: api.Params<ev.populate>
  ): api.Promised<ev.populate> {
    this.addDerivedSolutions([], params.solutions);
  }

  async handleGenerate(
    params: api.Params<ev.generate>,
    result: api.Result<ev.generate>
  ) {
    this.addDerivedSolutions([], [result.solution]);
  }

  async handleVariate(
    params: api.Params<ev.variate>,
    result: api.Result<ev.variate>
  ) {
    this.addDerivedSolutions([params.solution], [result.solution]);
  }

  async handleCombine(
    params: api.Params<ev.combine>,
    result: api.Result<ev.combine>
  ) {
    this.addDerivedSolutions(params.solutions, [result.solution]);
  }

  async handleMeasure(
    params: api.Params<ev.measure>,
    result: api.Result<ev.measure>
  ) {
    this.addMetrics(params.solution, result.metrics);
  }

  async evolve() {
    await simpleEvolver(this.db, this.channel);
  }
}

async function simpleEvolver(db: EvolveDB, channel: Channel) {
  for (const counter of Array(10)) {
    await channel.requestResult(ev.generate, {});
  }

  for (let leader; true /**/; ) {
    const c1id = await db.getCandidate();
    const c2id = await db.getCandidate();

    if (!c1id || !c2id) {
      continue;
    }

    const c1 = await db.getSolutionFromId(c1id);
    const c2 = await db.getSolutionFromId(c2id);

    const m1 = await channel.requestResult(ev.variate, {
      solution: c1,
    });

    const m2 = await channel.requestResult(ev.variate, {
      solution: c2,
    });

    const bestId = await db.getBestCandidate();

    if (bestId !== leader) {
      const colsRows = await db.allAsColumnsAndRows(
        `SELECT json_path, value FROM metric WHERE solution_id = ?`,
        bestId
      );

      // TODO: move to db
      const colsRows2 = await db.allAsColumnsAndRows(
        `
        WITH lhs as (
          select * from json_tree(
            (select solution from solution where solution_id = ?)
          ) where type not in ('array', 'object')
        ),
        rhs as (
          select * from json_tree(
            (select solution from solution where solution_id = ?)
          ) where type not in ('array', 'object')
        ),
        diff AS (
        SELECT
          lhs.fullkey as fullkey,
          lhs.value as lhs,
          rhs.value as rhs
        FROM
          lhs left join rhs on (lhs.fullkey = rhs.fullkey)
        union
        SELECT
          rhs.fullkey,
          lhs.value,
          rhs.value
        FROM
          rhs left join lhs on (lhs.fullkey = rhs.fullkey)
        )

        SELECT
          fullkey,
          COALESCE(lhs, ' '),
          COALESCE(rhs, ' ')
        FROM
          diff
        where
        (lhs is null and rhs is not null)
        or (rhs is null and lhs is not null)
        or
        (lhs <> rhs)
         `,
        leader,
        bestId
      );

      console.error(
        `${new Date().toISOString()} new leader: ${bestId}\n` +
          table(colsRows.rows)
      );

      if (colsRows2.rows.length) {
        console.error(table(colsRows2.rows));
      }

      leader = bestId;
    }

    const bestSol = await db.getSolutionFromId(bestId);

    await channel.requestResult(ev.variate, {
      solution: bestSol,
    });

    let combined = await channel.requestResult(ev.combine, {
      solutions: [m1.solution, m2.solution, bestSol],
    });
  }
}

async function main() {
  const options = commandLineArgs(
    [
      {
        name: 'dummy',
        type: String,
      },
    ],
    {
      stopAtFirstUnknown: true,
    }
  );

  const us = new Evolve();
  await us.initDB(`/run/user/${process.getuid()}/data.sqlite`);

  const dashboard = new Dashboard(us.db);
  dashboard.start();

  await us.start(new Features(), process.stdin, process.stdout);
  await us.register();

  us.evolve();
}

try {
  main();
} catch (e) {
  console.error(process.argv, e);
}

process.on('unhandledRejection', (...args) => {
  console.error(process.argv, args);
});
