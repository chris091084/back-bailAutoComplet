import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source';

/**
 * Supprime tous les passkeys enregistrés.
 *
 *     npm run auth:reset-passkeys
 *
 * Recours ultime en cas de perte de tous les appareils ET de la boîte mail (le
 * lien par email est le recours normal) : sans passkey en base, `/auth/login`
 * redevient une connexion par mot de passe, et un nouveau passkey peut être
 * enregistré depuis la session ouverte. Comme `auth:seed`, ce script ne se lance
 * que depuis un terminal ayant accès à la base : aucune route HTTP ne permet de
 * contourner le passkey.
 */
async function main(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.query(`DELETE FROM "passkey_credential"`);
    await dataSource.query(
      `UPDATE "auth_account" SET "refresh_token_hash" = NULL WHERE "id" = 1`,
    );
    console.log('\n  Passkeys supprimés et sessions révoquées.\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
