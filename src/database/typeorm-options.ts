import { types } from 'pg';
import { DataSourceOptions } from 'typeorm';

/**
 * `TIMESTAMP WITHOUT TIME ZONE` (oid 1114). Par défaut node-postgres interprète
 * ces valeurs dans le fuseau du process, alors qu'Hibernate les écrivait en UTC.
 * On force donc une lecture UTC pour que `generation.date` reste identique à ce
 * que renvoyait l'API Spring Boot.
 */
types.setTypeParser(1114, (value: string) => new Date(`${value}Z`));

const toBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean =>
  value === undefined ? defaultValue : value.toLowerCase() === 'true';

/**
 * DATABASE_URL est décomposée à la main plutôt que passée telle quelle à
 * TypeORM : le déploiement Koyeb existant utilise la forme JDBC, où les
 * identifiants voyagent en paramètres de requête
 * (`jdbc:postgresql://hote:5432/base?user=…&password=…`) et non dans la partie
 * userinfo. On accepte donc les deux écritures, ainsi que la forme
 * `postgres://user:password@hote/base` fournie par Render.
 */
const parseDatabaseUrl = (rawUrl: string): Partial<DataSourceOptions> => {
  const url = new URL(
    rawUrl.startsWith('jdbc:') ? rawUrl.slice('jdbc:'.length) : rawUrl,
  );

  const username =
    decodeURIComponent(url.username) ||
    url.searchParams.get('user') ||
    process.env.DB_USERNAME;
  const password =
    decodeURIComponent(url.password) ||
    url.searchParams.get('password') ||
    process.env.DB_PASSWORD;

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username,
    password,
    database: url.pathname.replace(/^\//, ''),
  };
};

const buildConnection = (): Partial<DataSourceOptions> => {
  const rawUrl = process.env.DATABASE_URL;

  if (rawUrl) {
    return parseDatabaseUrl(rawUrl);
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME ?? 'bailAutoComplete',
  };
};

/** `sslmode=require` dans l'URL vaut activation, comme pour le driver JDBC. */
const sslRequis = (): boolean => {
  if (process.env.DB_SSL !== undefined) {
    return process.env.DB_SSL.toLowerCase() === 'true';
  }

  return /sslmode=require/i.test(process.env.DATABASE_URL ?? '');
};

export const buildTypeOrmOptions = (): DataSourceOptions =>
  ({
    type: 'postgres',
    ...buildConnection(),
    ssl: sslRequis() ? { rejectUnauthorized: false } : false,
    // Le schéma est piloté par les migrations, jamais par l'ORM.
    synchronize: false,
    migrationsRun: toBoolean(process.env.DB_MIGRATIONS_RUN, true),
    logging: toBoolean(process.env.DB_LOGGING, false),
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  }) as DataSourceOptions;
