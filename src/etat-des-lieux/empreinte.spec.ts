import { EdlElement } from './edl-element.entity';
import { EdlPiece } from './edl-piece.entity';
import { calculerEmpreinte } from './empreinte';
import { EtatDesLieux } from './etat-des-lieux.entity';

const document = (surcharge: Partial<EtatDesLieux> = {}): EtatDesLieux =>
  ({
    id: 'edl-1',
    type: 'entree',
    locataireId: 5,
    appartementId: 2,
    adresse: '1 rue A',
    chauffage: 'Gaz',
    clesRemises: '2 clés',
    dateSignature: new Date('2026-10-15T10:00:00.000Z'),
    signatureBailleur: null,
    signatureLocataire: 'SIGNATURE',
    pieces: [
      {
        nom: 'Chambre',
        ordre: 0,
        elements: [
          {
            nom: 'Murs',
            ordre: 0,
            etatBailleur: 'BON',
            commentaireBailleur: null,
            etatLocataire: 'MOYEN',
            commentaireLocataire: 'Tache',
            dateModifLocataire: new Date('2026-10-15T09:00:00.000Z'),
            statutValidation: 'valide',
            photos: [{ id: 'p2' }, { id: 'p1' }],
          } as unknown as EdlElement,
        ],
      } as unknown as EdlPiece,
    ],
    ...surcharge,
  }) as unknown as EtatDesLieux;

describe('calculerEmpreinte', () => {
  it('est stable : même contenu, même empreinte (SHA-256 en hexadécimal)', () => {
    expect(calculerEmpreinte(document())).toMatch(/^[0-9a-f]{64}$/);
    expect(calculerEmpreinte(document())).toBe(calculerEmpreinte(document()));
  });

  it('change dès qu’un mot du constat change', () => {
    const base = calculerEmpreinte(document());
    const autrePiece = document();
    (
      autrePiece.pieces[0].elements[0] as { commentaireLocataire: string }
    ).commentaireLocataire = 'Tache.';

    expect(calculerEmpreinte(autrePiece)).not.toBe(base);
    expect(calculerEmpreinte(document({ adresse: '2 rue A' }))).not.toBe(base);
    expect(
      calculerEmpreinte(document({ signatureLocataire: 'AUTRE' })),
    ).not.toBe(base);
  });

  it('ne dépend pas de l’ordre dans lequel la base renvoie les lignes', () => {
    const melange = document();
    melange.pieces[0].elements[0].photos = [
      { id: 'p1' },
      { id: 'p2' },
    ] as never;

    expect(calculerEmpreinte(melange)).toBe(calculerEmpreinte(document()));
  });

  it('ne laisse pas la signature en clair dans ce qui est haché de façon lisible', () => {
    // L'empreinte est un hash : on ne retrouve pas la signature à partir d'elle.
    expect(calculerEmpreinte(document())).not.toContain('SIGNATURE');
  });
});
