import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import dataSource from '../database/data-source';

/**
 * Définit le mot de passe de l'unique compte de l'application.
 *
 *     npm run auth:seed
 *
 * C'est le SEUL moyen de poser ou de changer le mot de passe : aucune route HTTP
 * ne le permet, volontairement. Le script hache la saisie en bcrypt et écrit le
 * hash directement en base.
 *
 * Le mot de passe est demandé de manière interactive et masqué à la frappe :
 * le passer en argument de ligne de commande le laisserait dans l'historique du
 * shell et dans la liste des processus.
 *
 * À lancer avec le même environnement que l'API (le `.env` du projet), pour
 * viser la bonne base.
 */

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;

/**
 * bcrypt ignore tout ce qui dépasse 72 octets : au-delà, la troncature serait
 * silencieuse et deux mots de passe distincts pourraient ouvrir le compte.
 */
const MAX_BYTES = 72;

/** Flux de sortie qu'on peut museler, pour ne pas réafficher la frappe. */
class MutableOutput extends Writable {
  muted = false;

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) {
      process.stdout.write(chunk);
    }
    callback();
  }
}

const askHidden = (question: string): Promise<string> => {
  const output = new MutableOutput();
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });

  process.stdout.write(question);
  output.muted = true;

  return new Promise((resolve) => {
    rl.question('', (answer) => {
      output.muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
};

const validate = (password: string): string | null => {
  if (password.length < MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`;
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return `Le mot de passe ne peut pas dépasser ${MAX_BYTES} octets (limite de bcrypt).`;
  }

  return null;
};

const fail = (message: string): void => {
  process.stdout.write(`\n  ${message}\n\n`);
  process.exitCode = 1;
};

const main = async (): Promise<void> => {
  if (!process.stdin.isTTY) {
    fail(
      'Ce script doit être lancé dans un terminal interactif : la saisie du ' +
        'mot de passe est masquée.',
    );
    return;
  }

  const password = await askHidden('  Nouveau mot de passe : ');
  const problem = validate(password);

  if (problem) {
    fail(problem);
    return;
  }

  const confirmation = await askHidden('  Confirmation          : ');

  if (password !== confirmation) {
    fail('Les deux saisies diffèrent, rien n\'a été modifié.');
    return;
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await dataSource.initialize();

  try {
    // La session en cours est révoquée en même temps : changer de mot de passe
    // doit fermer les accès ouverts avec l'ancien.
    const result: unknown = await dataSource.query(
      `UPDATE "auth_account"
          SET "password_hash" = $1,
              "refresh_token_hash" = NULL,
              "updated_at" = NOW()
        WHERE "id" = 1`,
      [hash],
    );

    // node-postgres place le nombre de lignes touchées en seconde position.
    const affected = Array.isArray(result) ? Number(result[1] ?? 0) : 0;

    if (affected === 0) {
      fail(
        "Aucune ligne mise à jour : la migration d'authentification n'a " +
          'peut-être pas été appliquée sur cette base (`npm run migration:run`).',
      );
      return;
    }

    process.stdout.write(
      [
        '',
        '  Mot de passe enregistré (haché en bcrypt) et sessions révoquées.',
        '',
        "  Il n'est stocké nulle part en clair et n'est pas récupérable :",
        '  relancez ce script pour en définir un autre.',
        '',
        '',
      ].join('\n'),
    );
  } finally {
    await dataSource.destroy();
  }
};

void main();
