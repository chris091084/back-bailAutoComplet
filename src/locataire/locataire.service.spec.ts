import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { ResultForm } from '../generation/result-form.entity';
import { Locataire } from './locataire.entity';
import { LocataireService } from './locataire.service';

const creerRepositoryMock = <T extends ObjectLiteral>() =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve(entity)),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<Repository<T>>;

describe('LocataireService', () => {
  let locataireRepository: jest.Mocked<Repository<Locataire>>;
  let appartementRepository: jest.Mocked<Repository<Appartement>>;
  let resultFormRepository: jest.Mocked<Repository<ResultForm>>;
  let service: LocataireService;

  beforeEach(() => {
    locataireRepository = creerRepositoryMock<Locataire>();
    appartementRepository = creerRepositoryMock<Appartement>();
    resultFormRepository = creerRepositoryMock<ResultForm>();
    appartementRepository.findOneBy.mockResolvedValue({
      id: 1,
      name: 'Filature',
    } as Appartement);
    resultFormRepository.findOneBy.mockResolvedValue({ id: 7 } as ResultForm);

    service = new LocataireService(
      locataireRepository,
      appartementRepository,
      resultFormRepository,
    );
  });

  describe('createLocataire', () => {
    it('refuse une création sans bail d’origine', async () => {
      await expect(
        service.createLocataire({
          nom: 'Dupont',
          prenom: 'Jean',
          appartementId: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });

    it('accepte une création issue d’un bail généré', async () => {
      await service.createLocataire({
        nom: 'Dupont',
        prenom: 'Jean',
        appartementId: 1,
        resultFormId: 7,
      });

      expect(locataireRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ resultForm: { id: 7 } }),
      );
    });

    it('reprend la date d’entrée sur la prise d’effet du bail', async () => {
      resultFormRepository.findOneBy.mockResolvedValue({
        id: 7,
        from: '2026-01-15',
      } as ResultForm);

      await service.createLocataire({
        nom: 'Dupont',
        prenom: 'Jean',
        appartementId: 1,
        resultFormId: 7,
      });

      expect(locataireRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ entree: '2026-01-15' }),
      );
    });

    it('refuse une date de naissance hors bornes', async () => {
      await expect(
        service.createLocataire({
          nom: 'Dupont',
          prenom: 'Jean',
          appartementId: 1,
          resultFormId: 7,
          dateNaissance: '1899-12-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateLocataire', () => {
    it('corrige la date d’entrée sans toucher au bail', async () => {
      locataireRepository.findOne.mockResolvedValue({
        id: 3,
        entree: '2026-01-15',
      } as Locataire);

      const locataire = await service.updateLocataire(3, {
        entree: '2026-02-01',
        dateNaissance: '1998-03-12',
      });

      expect(locataire.entree).toBe('2026-02-01');
      expect(locataire.dateNaissance).toBe('1998-03-12');
    });

    it('refuse une date d’entrée mal formée', async () => {
      locataireRepository.findOne.mockResolvedValue({ id: 3 } as Locataire);

      await expect(
        service.updateLocataire(3, { entree: '01/02/2026' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('marquerResiliationEnvoyee', () => {
    it('horodate l’envoi de la lettre de congé', async () => {
      locataireRepository.findOne.mockResolvedValue({
        id: 3,
        resiliationEnvoyeeLe: null,
      } as Locataire);

      const locataire = await service.marquerResiliationEnvoyee(3);

      expect(locataire.resiliationEnvoyeeLe).toBeInstanceOf(Date);
      expect(locataireRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3 }),
      );
    });

    it('refuse un locataire inconnu', async () => {
      locataireRepository.findOne.mockResolvedValue(null);

      await expect(service.marquerResiliationEnvoyee(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('marquerSortie', () => {
    beforeEach(() => {
      locataireRepository.findOne.mockResolvedValue({
        id: 3,
        sortie: null,
      } as Locataire);
    });

    it('date la sortie du logement', async () => {
      const locataire = await service.marquerSortie(3, '2026-03-31');

      expect(locataire.sortie).toBe('2026-03-31');
      expect(locataireRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3, sortie: '2026-03-31' }),
      );
    });

    it('refuse une date absente ou mal formée', async () => {
      await expect(service.marquerSortie(3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.marquerSortie(3, '31/03/2026')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });

    it('refuse un jour qui n’existe pas', async () => {
      await expect(service.marquerSortie(3, '2026-02-31')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(locataireRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('reintegrerLocataire', () => {
    it('efface la date de sortie', async () => {
      locataireRepository.findOne.mockResolvedValue({
        id: 3,
        sortie: '2026-03-31',
      } as Locataire);

      const locataire = await service.reintegrerLocataire(3);

      expect(locataire.sortie).toBeNull();
      expect(locataireRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 3, sortie: null }),
      );
    });
  });
});
