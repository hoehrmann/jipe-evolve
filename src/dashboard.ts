import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import express = require('express');
import { AddressInfo } from 'net';
import { EvolveDB, SolutionId } from './evolveDB';

const app = express();
const DEFAULT_PORT = 37071;

const ASSETS_DIR = `${__dirname}/../assets/`;

export class Dashboard {
  protected db: EvolveDB;

  constructor(db: EvolveDB) {
    this.db = db;

    this.setup();
  }

  protected setup() {
    app.use(express.json());

    // This endpoint deliberately arbitrary SQL injections
    app.post('/sql', async (request, response) => {
      response.json(
        await this.db.allAsColumnsAndRows(request.body.query)
      );
    });

    app.get('/', async (request, response) => {
      response.sendFile('index.html', {
        root: ASSETS_DIR,
      });
    });
  }

  public start() {
    // start the Express server
    const server = app.listen(DEFAULT_PORT, () => {
      console.error(
        `server started at http://localhost:${
          (server.address() as any).port
        }`
      );
    });
  }
}
