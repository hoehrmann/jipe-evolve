import * as EvolveProtocol from './jipe-evolve-protocol';
import json_stable = require('json-stable-stringify');
import * as sq from 'sqlite';
import * as schema from './sqlschema';
import { EventEmitter } from 'events';
import { mapSeries } from 'bluebird';

export type SolutionId = number;

export class EvolveDB extends EventEmitter {
  public db: sq.Database;

  public async open(path: string) {
    this.db = await sq.open(path);

    await this.db.run('PRAGMA foreign_keys = ON');
    await this.db.run('PRAGMA journal_mode = WAL');
    await this.db.run('PRAGMA locking_mode = EXCLUSIVE');
  }

  public async deploySchema() {
    return mapSeries(schema.SQLiteSchema, (sql) => this.db.run(sql));
  }

  public async addDerivation(
    oldSolutions: SolutionId[],
    newSolutions: SolutionId[]
  ) {
    for (const derivedId of newSolutions) {
      await this.db.run(
        `
        INSERT OR IGNORE INTO derivation(
          old_solution_id,
          new_solution_id
        )
        SELECT
          ?,
          each.value
        FROM
          json_each(?) each
        `,
        derivedId,
        JSON.stringify(oldSolutions)
      );
    }
  }

  public async findSolution(stable_solution: string) {
    const solutionRow = await this.db.get(
      `SELECT solution_id FROM solution WHERE solution = ?`,
      stable_solution
    );

    if (!solutionRow) {
      return;
    }

    return solutionRow.solution_id;
  }

  public async findOrCreateSolution(
    solution: EvolveProtocol.Solution,
    origin?: any
  ): Promise<SolutionId> {
    const stable_solution = json_stable(solution);
    const existingSolution = await this.findSolution(stable_solution);

    if (existingSolution) {
      return existingSolution;
    }

    await this.db.run(
      `
      INSERT OR IGNORE INTO solution(solution, origin) VALUES (?, ?)
      `,
      stable_solution,
      json_stable(origin)
    );

    const solution_id = await this.findSolution(stable_solution);

    this.emit('new-solution', solution);

    return solution_id;
  }

  public async addMetrics(
    solution: EvolveProtocol.Solution,
    metrics: EvolveProtocol.Metrics
  ): Promise<number> {
    // FIXME: only find

    const solution_id = await this.findOrCreateSolution(
      solution,
      null
    );

    await this.db.run(
      `
      INSERT OR IGNORE INTO metric(solution_id, json_path, value)
      SELECT
        ?,
        fullkey,
        value
      FROM
        json_tree(?)
      WHERE
        type IN ('real', 'integer')
      `,
      solution_id,
      json_stable(metrics)
    );

    return solution_id;
  }

  public async addSolutions(
    solutions: EvolveProtocol.Solution[]
  ): Promise<any> {
    const solution_ids = Promise.all(
      solutions.map((solution) => this.addSolution(solution))
    );

    return await solution_ids;
  }

  public async addSolution(
    solution: EvolveProtocol.Solution
  ): Promise<number> {
    const origin = {
      // TODO: also record
      //   request.request
      //   request.request_dt
      response_dt: new Date().toISOString(),
    };

    const solution_id = await this.findOrCreateSolution(
      solution,
      origin
    );

    return solution_id;
  }

  public async getBestCandidate() {
    const row = await this.db.get(
      `
        WITH
        ranked_by_metric AS (
          SELECT
            s.solution_id AS solution_id,
            m.json_path AS json_path,
            percent_rank() OVER (
              PARTITION BY m.json_path
              ORDER BY m.value
            ) AS p
          FROM
            solution s
              INNER JOIN metric m 
                ON (s.solution_id = m.solution_id)
          GROUP BY
            s.solution_id,
            m.json_path
        ),
        average_percent_rank AS (
          SELECT
            solution_id,
            AVG(p) AS average_percent_rank
          FROM
            ranked_by_metric
          GROUP BY
            solution_id
          ORDER BY
            2 DESC
        )
        SELECT
          *
        FROM
          average_percent_rank
        ORDER BY
          average_percent_rank DESC
        LIMIT 1
      `
    );

    if (!row) {
      return;
    }

    return row.solution_id;
  }

  public async getCandidate() {
    const random = Math.pow(Math.random(), 2);

    const row = await this.db.get(
      `
      WITH
      ranked_by_metric AS (
        SELECT
          s.solution_id AS solution_id,
          m.json_path AS json_path,
          MAX(value) AS max_value,
          dense_rank() OVER (
            PARTITION BY m.json_path
            ORDER BY m.value DESC
          ) AS p
        FROM
          solution s
            INNER JOIN metric m 
              ON (s.solution_id = m.solution_id)
        GROUP BY
          s.solution_id,
          m.json_path
      )

      SELECT solution_id
      FROM ranked_by_metric
      WHERE p < 10
      ORDER BY RANDOM()
      LIMIT 1
      `
    );

    if (!row) {
      return;
    }

    return row.solution_id;
  }

  public async getSolutionFromId(id) {
    const row = await this.db.get(
      'SELECT solution FROM solution WHERE solution_id = ?',
      id
    );

    return JSON.parse(row.solution);
  }

  public async allAsColumnsAndRows(sql: string, ...params) {
    const result = await this.db.all(sql, ...params);

    const columns = {};

    result.forEach((row) => {
      Object.keys(row).forEach((key) => {
        columns[String(key)] = 1;
      });
    });

    const rows = result.map((row) => {
      return Object.keys(columns).map((key) => row[key]);
    });

    return {
      columns: Object.keys(columns),
      rows: rows,
    };
  }
}
