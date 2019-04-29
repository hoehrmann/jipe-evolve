
export const SQLiteSchema = [

  `
  CREATE TABLE IF NOT EXISTS solution(
    solution_id INTEGER PRIMARY KEY,
    solution JSON NOT NULL UNIQUE,
    origin JSON NOT NULL
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS derivation(
    derivation_id INTEGER PRIMARY KEY,
    old_solution_id REFERENCES solution(solution_id),
    new_solution_id REFERENCES solution(solution_id)
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS metric(
    metric_id INTEGER PRIMARY KEY,
    solution_id REFERENCES solution(solution_id),
    json_path TEXT,
    value REAL,
    UNIQUE(solution_id, json_path)
  )
  `,

  `
  CREATE INDEX IF NOT EXISTS
    idx_metric_solution_json_path
  ON
    metric(solution_id, json_path)
  `,

  `
  CREATE INDEX IF NOT EXISTS
    idx_derivation_old_solution_id
  ON
    derivation(old_solution_id)
  `,

  `
  CREATE INDEX IF NOT EXISTS
    idx_derivation_new_solution_id
  ON
    derivation(new_solution_id)
  `,

];

