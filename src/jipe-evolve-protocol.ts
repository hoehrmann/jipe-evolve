import { Channel, api } from 'node-jipe';
import { Writable, Readable } from 'stream';
import { create } from 'domain';

export type Solution = any;
export type Metrics = any;

export namespace evolve {
  export type Solution = any;
  export type Metrics = any;

  /**
   * The [[evolve.variate]] request...
   */
  export class variate implements api.Definition {
    method = 'evolve.variate';
    params: {
      /** Solution to be changed slightly */
      solution: Solution;
    };
    result: {
      /** Solution slightly different than input */
      solution: Solution;
    };
  }

  /**
   * The `evolve.generate` request...
   */
  export class generate implements api.Definition {
    method = 'evolve.generate';
    params: {};
    result: {
      /** Solution slightly different than input */
      solution: Solution;
    };
  }

  /**
   * The `evolve.populate` request...
   */
  export class populate implements api.Definition {
    method = 'evolve.populate';
    params: {
      solutions: Solution[];
    };
    result: void;
  }

  /**
   * The `evolve.measure` request...
   */
  export class measure implements api.Definition {
    method = 'evolve.measure';
    params: {
      solution: Solution;
    };
    result: {
      metrics: Metrics;
    };
  }

  /**
   * The [[evolve.combine]] request...
   */
  export class combine implements api.Definition {
    method = 'evolve.combine';
    params: {
      /** Solutions to be combined */
      solutions: Solution[];
    };
    result: {
      solution: Solution;
    };
  }

  /**
   * The `evolve.template` request...
   */
  export class template implements api.Definition {
    method = 'evolve.template';
    params: {};
    result: {
      /** ... */
      template: any;
    };
  }

  export class textchanges implements api.Definition {
    method = 'evolve.textchanges';
    params: {
      lhs: string;
      rhs: string;
    };
    result: {
      textchanges: number;
    };
  }
}
