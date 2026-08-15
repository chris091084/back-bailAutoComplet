import { Appartement } from '../appartement.entity';
import { AppartementDto } from './appartement.dto';

const appartement = {
  id: 1,
  name: 'Filature 4D',
  adress: '56 rue de la Filature',
  prefixeAnnexe: 'Filature',
  aLoggia: true,
  aGaragePoubelle: true,
  bailleur: { id: 1, name: 'M. BODIN Sylvain' },
  chambres: [
    { id: 3, piece: 'Chambre 3', caracteristiqueExceptionelle: 'lit double' },
    { id: 1, piece: 'Chambre 1', caracteristiqueExceptionelle: null },
  ],
  caracteristiques: [
    { id: 2, description: 'Le salon' },
    { id: 1, description: "L'entrée" },
  ],
  energieHeating: 'chaudière à gaz',
  energieWater: 'chaudière à gaz',
  chauffageCollectif: true,
  surface: 81.18,
  valIrl: '146.6',
  tIrl: 'T1 2026',
  irlManual: false,
} as unknown as Appartement;

describe('AppartementDto', () => {
  it('trie les chambres et les caractéristiques par id', () => {
    const dto = new AppartementDto(appartement);

    expect(dto.chambres.map((chambre) => chambre.id)).toEqual([1, 3]);
    expect(dto.caracteristiques.map((c) => c.id)).toEqual([1, 2]);
  });

  it("n'expose des chambres que l'id et la pièce", () => {
    const [chambre] = new AppartementDto(appartement).chambres;

    expect(Object.keys(chambre)).toEqual(['id', 'piece']);
  });

  it("reprend l'id du parent pour appartementId des caractéristiques", () => {
    const dto = new AppartementDto(appartement);

    expect(dto.caracteristiques.every((c) => c.appartementId === 1)).toBe(true);
  });

  it('tolère un appartement sans collections chargées (cas du POST)', () => {
    const dto = new AppartementDto({
      ...appartement,
      chambres: undefined,
      caracteristiques: undefined,
    } as unknown as Appartement);

    expect(dto.chambres).toEqual([]);
    expect(dto.caracteristiques).toEqual([]);
  });
});
