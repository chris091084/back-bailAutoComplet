import 'reflect-metadata';
import 'dotenv/config';
import { COLONNES_CHIFFREES } from '../common/colonnes-chiffrees';
import {
  chiffrer,
  dechiffrer,
  etatValeur,
  verifierConfigurationChiffrement,
} from '../common/encryption';
import dataSource from './data-source';

/**
 * Chiffre les données personnelles déjà en base, et rechiffre celles écrites avec
 * l'ancienne clé (`ENCRYPTION_KEY_PREVIOUS`) pendant un changement de clé.
 *
 *     npm run chiffrer:donnees               # essai à blanc : compte, n'écrit rien
 *     npm run chiffrer:donnees -- --execute  # écrit, en une seule transaction
 *
 * Rejouable sans risque : une valeur déjà chiffrée avec la clé courante n'est pas
 * touchée. Avant d'écrire, chaque valeur est relue et comparée à l'original : au
 * moindre écart rien n'est validé.
 *
 * ⚠ Lancer avec la MÊME ENCRYPTION_KEY que l'API : comparer l'empreinte affichée
 * ici à la ligne « empreinte de la clé » du journal de démarrage de l'API.
 * La connexion applique les migrations en attente (les colonnes doivent d'abord
 * être passées en texte).
 */
async function main(): Promise<void> {
  const executer = process.argv.includes('--execute');
  const empreinte = verifierConfigurationChiffrement();

  console.log(`\n  Empreinte de la clé courante : ${empreinte}`);
  console.log(
    '  À comparer avec la ligne « empreinte de la clé » du journal de l’API.\n',
  );

  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  let aEcrire = 0;

  try {
    for (const { table, colonnes } of COLONNES_CHIFFREES) {
      for (const colonne of colonnes) {
        // Les noms viennent de la liste ci-dessus, jamais d'une saisie.
        const lignes: { id: string; valeur: string }[] = await runner.query(
          `SELECT "id", "${colonne}" AS valeur FROM "${table}" WHERE "${colonne}" IS NOT NULL`,
        );
        const compte = { clair: 0, precedente: 0, courante: 0 };

        for (const { id, valeur } of lignes) {
          const etat = etatValeur(valeur);
          compte[etat] += 1;

          if (etat === 'courante') {
            continue;
          }

          const original = dechiffrer(valeur);
          const nouveau = chiffrer(original);

          if (dechiffrer(nouveau) !== original) {
            throw new Error(
              `Relecture incorrecte sur ${table}.${colonne} (id ${id}) : rien n'est validé.`,
            );
          }

          await runner.query(
            `UPDATE "${table}" SET "${colonne}" = $1 WHERE "id" = $2`,
            [nouveau, id],
          );
          aEcrire += 1;
        }

        console.log(
          `  ${`${table}.${colonne}`.padEnd(28)} ${String(lignes.length).padStart(3)} valeur(s) : ` +
            `${compte.clair} en clair, ${compte.precedente} à rechiffrer, ${compte.courante} déjà à jour`,
        );
      }
    }

    if (executer) {
      await runner.commitTransaction();
      console.log(`\n  ${aEcrire} valeur(s) chiffrée(s) et enregistrée(s).\n`);
    } else {
      await runner.rollbackTransaction();
      console.log(
        `\n  Essai à blanc : ${aEcrire} valeur(s) seraient écrites. Rien n'a été modifié.`,
      );
      if (aEcrire > 0) {
        console.log('  Relancer avec --execute pour appliquer.\n');
      }
    }
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
    }
    throw error;
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
