import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options';

/** Utilisé par la CLI TypeORM (`npm run migration:*`). */
export default new DataSource(buildTypeOrmOptions());
