import { getMetadataArgsStorage } from 'typeorm';
import '../generation/generation.entity';
import '../generation/result-form.entity';
import '../locataire/locataire.entity';
import { COLONNES_CHIFFREES } from './colonnes-chiffrees';
import { encryptedTransformer } from './encrypted.transformer';

const nomSql = (table: string, colonne: string) => `${table}.${colonne}`;

describe('COLONNES_CHIFFREES', () => {
  const stockage = getMetadataArgsStorage();

  const declarees = stockage.columns
    .filter((colonne) => colonne.options.transformer === encryptedTransformer)
    .map((colonne) => {
      const table = stockage.tables.find((t) => t.target === colonne.target);
      return nomSql(
        String(table?.name),
        colonne.options.name ?? colonne.propertyName,
      );
    })
    .sort();

  const listees = COLONNES_CHIFFREES.flatMap(({ table, colonnes }) =>
    colonnes.map((colonne) => nomSql(table, colonne)),
  ).sort();

  it('correspond exactement aux colonnes déclarées chiffrées dans les entités', () => {
    // Si ce test échoue : une colonne est chiffrée par l'entité mais absente du
    // script de reprise (ses anciennes valeurs resteraient en clair), ou l'inverse.
    expect(listees).toEqual(declarees);
  });

  it('ne contient aucune colonne que le code trie, filtre ou purge', () => {
    for (const interdite of [
      'locataire.etat',
      'locataire.entree',
      'locataire.sortie',
      'locataire.conservation_prolongee',
    ]) {
      expect(listees).not.toContain(interdite);
    }
  });

  it('ne touche pas aux données du bailleur', () => {
    expect(listees.filter((c) => c.startsWith('bailleur.'))).toEqual([]);
  });
});
