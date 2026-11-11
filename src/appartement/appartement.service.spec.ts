import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EncadrementLoyersService } from '../encadrement-loyers/encadrement-loyers.service';
import { IrlService } from '../irl/irl.service';
import { Appartement } from './appartement.entity';
import { AppartementService } from './appartement.service';

const unAppartement = (surcharges: Partial<Appartement> = {}): Appartement =>
  ({
    id: 1,
    name: 'Filature 4D',
    adress: '56 rue de la Filature',
    prefixeAnnexe: 'Filature',
    aLoggia: true,
    aGaragePoubelle: true,
    chambres: [],
    caracteristiques: [],
    irlManual: false,
    rentRefManual: false,
    constructionPeriod: '1968',
    valIrl: null,
    tIrl: null,
    rentRef: null,
    rentRefMaj: null,
    ...surcharges,
  }) as unknown as Appartement;

type RepositoryMock = jest.Mocked<
  Pick<
    Repository<Appartement>,
    'find' | 'findOne' | 'findOneBy' | 'save' | 'update' | 'existsBy'
  >
> & {
  createQueryBuilder: jest.Mock;
  executeUpdate: jest.Mock;
};

const creerRepositoryMock = (): RepositoryMock => {
  const executeUpdate = jest.fn().mockResolvedValue({ affected: 5 });
  const set = jest.fn().mockReturnValue({ execute: executeUpdate });
  const update = jest.fn().mockReturnValue({ set });

  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn((entity) => Promise.resolve(entity)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    existsBy: jest.fn().mockResolvedValue(true),
    createQueryBuilder: jest.fn().mockReturnValue({ update }),
    executeUpdate,
  } as unknown as RepositoryMock;
};

describe('AppartementService', () => {
  let repository: RepositoryMock;
  let irlService: jest.Mocked<Pick<IrlService, 'getLatestIrl'>>;
  let encadrementLoyers: jest.Mocked<
    Pick<EncadrementLoyersService, 'getLoyersReference'>
  >;
  let service: AppartementService;

  beforeEach(() => {
    repository = creerRepositoryMock();
    irlService = { getLatestIrl: jest.fn().mockResolvedValue(null) };
    encadrementLoyers = {
      getLoyersReference: jest.fn().mockResolvedValue(null),
    };
    service = new AppartementService(
      repository as unknown as Repository<Appartement>,
      irlService as unknown as IrlService,
      encadrementLoyers as unknown as EncadrementLoyersService,
    );
  });

  describe('getAllAppartement', () => {
    it('renvoie 404 quand aucun appartement n’existe', async () => {
      repository.find.mockResolvedValue([]);

      await expect(service.getAllAppartement()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("n'interroge l'IRL qu'une fois pour toute la liste", async () => {
      repository.find.mockResolvedValue([
        unAppartement({ id: 1 }),
        unAppartement({ id: 2 }),
        unAppartement({ id: 3 }),
      ]);
      irlService.getLatestIrl.mockResolvedValue({
        valIrl: '146.6',
        tIrl: 'T1 2026',
      });

      const resultat = await service.getAllAppartement();

      expect(irlService.getLatestIrl).toHaveBeenCalledTimes(1);
      expect(resultat.map((dto) => dto.valIrl)).toEqual([
        '146.6',
        '146.6',
        '146.6',
      ]);
    });
  });

  describe("remplissage automatique de l'IRL", () => {
    it("laisse intact un appartement dont l'IRL a été saisi à la main", async () => {
      repository.find.mockResolvedValue([
        unAppartement({ irlManual: true, valIrl: '140.0', tIrl: 'T1 2024' }),
      ]);
      irlService.getLatestIrl.mockResolvedValue({
        valIrl: '146.6',
        tIrl: 'T1 2026',
      });

      const [dto] = await service.getAllAppartement();

      expect(dto.valIrl).toBe('140.0');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("n'écrit pas en base quand la valeur INSEE est déjà celle stockée", async () => {
      repository.find.mockResolvedValue([
        unAppartement({ valIrl: '146.6', tIrl: 'T1 2026' }),
      ]);
      irlService.getLatestIrl.mockResolvedValue({
        valIrl: '146.6',
        tIrl: 'T1 2026',
      });

      await service.getAllAppartement();

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('persiste la nouvelle valeur publiée par l’INSEE', async () => {
      repository.find.mockResolvedValue([
        unAppartement({ valIrl: '145.9', tIrl: 'T4 2025' }),
      ]);
      irlService.getLatestIrl.mockResolvedValue({
        valIrl: '146.6',
        tIrl: 'T1 2026',
      });

      await service.getAllAppartement();

      expect(repository.update).toHaveBeenCalledWith(1, {
        valIrl: '146.6',
        tIrl: 'T1 2026',
      });
    });
  });

  describe('setRentRefAndRentRefMaj', () => {
    beforeEach(() => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 2 }));
    });

    it('alimente rentRef quand le champ visé est rentRef', async () => {
      await service.setRentRefAndRentRefMaj({
        idAppartement: 2,
        fieldName: 'rentRef',
        value: 11.3,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 11.3,
        rentRefManual: true,
      });
    });

    it('alimente rentRefMaj quand le champ visé est rentRefMaj', async () => {
      await service.setRentRefAndRentRefMaj({
        idAppartement: 2,
        fieldName: 'rentRefMaj',
        value: 13.6,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRefMaj: 13.6,
        rentRefManual: true,
      });
    });

    it('bascule sur rentRefMaj lorsqu’un rentRef est envoyé à null (comportement Java)', async () => {
      await service.setRentRefAndRentRefMaj({
        idAppartement: 2,
        fieldName: 'rentRef',
        value: null,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRefMaj: null,
        rentRefManual: false,
      });
    });

    it('ne passe jamais par save(), qui casserait les relations chargées', async () => {
      await service.setRentRefAndRentRefMaj({
        idAppartement: 2,
        fieldName: 'rentRef',
        value: 11.3,
      });

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('renvoie 404 sur un appartement inconnu', async () => {
      repository.existsBy.mockResolvedValue(false);

      await expect(
        service.setRentRefAndRentRefMaj({
          idAppartement: 99,
          fieldName: 'rentRef',
          value: 10,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('synchronisation du groupe Filature (appartements 1 et 4)', () => {
    it("répercute la valeur de l'appartement 1 sur l'appartement 4", async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 1 }));
      repository.findOneBy.mockResolvedValue(
        unAppartement({ id: 4, rentRef: 9 }),
      );

      await service.setRentRefAndRentRefMaj({
        idAppartement: 1,
        fieldName: 'rentRef',
        value: 10.7,
      });

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 4 });
      expect(repository.update).toHaveBeenCalledWith(4, { rentRef: 10.7 });
    });

    it("répercute la valeur de l'appartement 4 sur l'appartement 1", async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 4 }));
      repository.findOneBy.mockResolvedValue(unAppartement({ id: 1 }));

      await service.setRentRefAndRentRefMaj({
        idAppartement: 4,
        fieldName: 'rentRef',
        value: 10.7,
      });

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(repository.update).toHaveBeenCalledWith(1, { rentRef: 10.7 });
    });

    it('ne synchronise rien pour un appartement hors du groupe', async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 2 }));

      await service.setRentRefAndRentRefMaj({
        idAppartement: 2,
        fieldName: 'rentRef',
        value: 11.3,
      });

      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledTimes(1);
    });

    it("n'écrit pas quand l'autre appartement porte déjà la valeur", async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 1 }));
      repository.findOneBy.mockResolvedValue(
        unAppartement({ id: 4, rentRef: 10.7 }),
      );

      await service.setRentRefAndRentRefMaj({
        idAppartement: 1,
        fieldName: 'rentRef',
        value: 10.7,
      });

      // La valeur n'est pas réécrite sur l'appartement 4 : seul son mode
      // manuel est aligné.
      expect(repository.update).not.toHaveBeenCalledWith(4, { rentRef: 10.7 });
      expect(repository.update).toHaveBeenCalledWith(4, {
        rentRefManual: true,
      });
    });
  });

  describe('updateAppartement', () => {
    it('n’écrit que les loyers, nom, adresse et surface étant figés', async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 2 }));

      await service.updateAppartement(2, {
        id: 2,
        name: 'Filature 4D',
        adress: '56 rue de la Filature',
        surface: 81.18,
        rentRef: '10,7' as unknown as number,
        rentRefMaj: 12.8,
        chambres: [],
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 10.7,
        rentRefMaj: 12.8,
        rentRefManual: true,
      });
    });

    it('ne fige pas les loyers quand la modale renvoie les valeurs inchangées', async () => {
      repository.findOne.mockResolvedValue(
        unAppartement({ id: 2, rentRef: 11.3, rentRefMaj: 13.6 }),
      );

      await service.updateAppartement(2, { rentRef: 11.3, rentRefMaj: 13.6 });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 11.3,
        rentRefMaj: 13.6,
      });
    });

    it('rebascule en automatique et remplit tout de suite quand un loyer est vidé', async () => {
      repository.findOne.mockResolvedValue(
        unAppartement({
          id: 2,
          rentRef: 9,
          rentRefMaj: 10,
          rentRefManual: true,
        }),
      );
      encadrementLoyers.getLoyersReference.mockResolvedValue({
        rentRef: 11.3,
        rentRefMaj: 13.6,
      });

      await service.updateAppartement(2, {
        rentRef: '' as unknown as number,
        rentRefMaj: 10,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: null,
        rentRefMaj: 10,
        rentRefManual: false,
      });
    });

    it('passe en manuel quand le front le demande, même sans valeur modifiée', async () => {
      repository.findOne.mockResolvedValue(
        unAppartement({ id: 2, rentRef: 11.3, rentRefMaj: 13.6 }),
      );

      await service.updateAppartement(2, {
        rentRef: 11.3,
        rentRefMaj: 13.6,
        rentRefManual: true,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 11.3,
        rentRefMaj: 13.6,
        rentRefManual: true,
      });
    });

    it('repasse en automatique sans écrire les valeurs reçues, puis remplit', async () => {
      // Avant l'écriture le logement est manuel, après elle il ne l'est plus.
      repository.findOne
        .mockResolvedValueOnce(
          unAppartement({
            id: 2,
            rentRef: 9,
            rentRefMaj: 10,
            rentRefManual: true,
          }),
        )
        .mockResolvedValueOnce(
          unAppartement({
            id: 2,
            rentRef: 9,
            rentRefMaj: 10,
            rentRefManual: false,
          }),
        );
      encadrementLoyers.getLoyersReference.mockResolvedValue({
        rentRef: 11.3,
        rentRefMaj: 13.6,
      });

      const dto = await service.updateAppartement(2, {
        rentRef: 9,
        rentRefMaj: 10,
        rentRefManual: false,
      });

      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRefManual: false,
      });
      expect(dto.rentRef).toBe(11.3);
      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 11.3,
        rentRefMaj: 13.6,
      });
    });

    it('rejette une valeur numérique invalide', async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 2 }));

      await expect(
        service.updateAppartement(2, { rentRef: 'abc' as unknown as number }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remplissage automatique des loyers de référence', () => {
    const loyers = { rentRef: 11.3, rentRefMaj: 13.6 };

    it('remplit les loyers avec ceux de l’encadrement et persiste', async () => {
      repository.find.mockResolvedValue([unAppartement({ id: 2 })]);
      encadrementLoyers.getLoyersReference.mockResolvedValue(loyers);

      const [dto] = await service.getAllAppartement();

      expect(encadrementLoyers.getLoyersReference).toHaveBeenCalledWith(
        '56 rue de la Filature',
        '1968',
      );
      expect(dto.rentRef).toBe(11.3);
      expect(dto.rentRefMaj).toBe(13.6);
      expect(repository.update).toHaveBeenCalledWith(2, {
        rentRef: 11.3,
        rentRefMaj: 13.6,
      });
    });

    it('ne touche pas aux loyers saisis à la main', async () => {
      repository.find.mockResolvedValue([
        unAppartement({
          rentRefManual: true,
          rentRef: 9,
          rentRefMaj: 10,
        }),
      ]);
      encadrementLoyers.getLoyersReference.mockResolvedValue(loyers);

      const [dto] = await service.getAllAppartement();

      expect(encadrementLoyers.getLoyersReference).not.toHaveBeenCalled();
      expect(dto.rentRef).toBe(9);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('conserve la valeur en base quand l’API ne répond pas', async () => {
      repository.find.mockResolvedValue([
        unAppartement({ rentRef: 10.7, rentRefMaj: 12.8 }),
      ]);

      const [dto] = await service.getAllAppartement();

      expect(dto.rentRef).toBe(10.7);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('n’écrit pas quand les valeurs sont déjà à jour', async () => {
      repository.find.mockResolvedValue([
        unAppartement({ rentRef: 11.3, rentRefMaj: 13.6 }),
      ]);
      encadrementLoyers.getLoyersReference.mockResolvedValue(loyers);

      await service.getAllAppartement();

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('s’applique aussi à la lecture d’un seul appartement', async () => {
      repository.findOne.mockResolvedValue(unAppartement({ id: 2 }));
      encadrementLoyers.getLoyersReference.mockResolvedValue(loyers);

      const dto = await service.getAppartementById(2);

      expect(dto.rentRefMaj).toBe(13.6);
    });
  });

  describe('setValIrlTirl', () => {
    it('passe tous les appartements en IRL manuel sur une saisie non vide', async () => {
      await service.setValIrlTirl({ fieldName: 'valIrl', value: '146.6' });

      const set = repository.createQueryBuilder.mock.results[0].value.update()
        .set as jest.Mock;
      expect(set).toHaveBeenCalledWith({ valIrl: '146.6', irlManual: true });
    });

    it('rebascule en automatique sur une valeur vide', async () => {
      await service.setValIrlTirl({ fieldName: 'tIrl', value: '  ' });

      const set = repository.createQueryBuilder.mock.results[0].value.update()
        .set as jest.Mock;
      expect(set).toHaveBeenCalledWith({ tIrl: '  ', irlManual: false });
    });
  });
});
