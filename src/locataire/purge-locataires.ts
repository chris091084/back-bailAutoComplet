import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source';
import {
  DELAI_CONSERVATION_ANNEES,
  purgerLocatairesSortis,
} from './locataire-purge';

/**
 * Supprime les locataires sortis depuis plus de 3 ans (RGPD, durée de
 * conservation).
 *
 *     npm run purge:locataires              # essai à blanc : compte, ne supprime rien
 *     npm run purge:locataires -- --execute # supprime pour de bon
 *
 * Sans `--execute` rien n'est écrit : c'est le mode à lancer d'abord, surtout
 * sur la base de production. La suppression est définitive.
 */
async function main(): Promise<void> {
  const executer = process.argv.includes('--execute');

  await dataSource.initialize();

  try {
    const bilan = await purgerLocatairesSortis(dataSource, { executer });
    const verbe = executer ? 'supprimé' : 'à supprimer (essai à blanc)';

    console.log(
      `\n  Sortis depuis plus de ${DELAI_CONSERVATION_ANNEES} ans, ${verbe} :\n` +
        `    locataires  : ${bilan.locataires}\n` +
        `    baux        : ${bilan.baux}\n` +
        `    générations : ${bilan.generations}\n`,
    );

    if (!executer && bilan.locataires > 0) {
      console.log('  Relancer avec --execute pour appliquer.\n');
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
