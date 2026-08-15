import { ConflictException, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { Generation } from './generation.entity';
import { ResultForm } from './result-form.entity';
import { ResultFormService } from './result-form.service';

const creerRepositoryMock = <T extends ObjectLiteral>() =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn().mockResolvedValue(0),
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve({ id: 7, ...entity })),
    delete: jest.fn(),
  }) as unknown as jest.Mocked<Repository<T>>;

describe('ResultFormService', () => {
  let resultFormRepository: jest.Mocked<Repository<ResultForm>>;
  let generationRepository: jest.Mocked<Repository<Generation>>;
  let service: ResultFormService;

  beforeEach(() => {
    resultFormRepository = creerRepositoryMock<ResultForm>();
    generationRepository = creerRepositoryMock<Generation>();
    resultFormRepository.findOne.mockResolvedValue({ id: 7 } as ResultForm);

    service = new ResultFormService(resultFormRepository, generationRepository);
  });

  describe('creerBrouillon', () => {
    it('écrit la saisie sans passer par une génération', async () => {
      await service.creerBrouillon({
        name: 'Dupont',
        firstname: 'Jean',
        appartement: { id: 1 },
      });

      expect(resultFormRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dupont',
          firstname: 'Jean',
          appartement: { id: 1 },
        }),
      );
    });

    it('accepte une saisie incomplète : c’est tout l’intérêt du brouillon', async () => {
      await service.creerBrouillon({ name: 'Dupont' });

      expect(resultFormRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dupont', room: null }),
      );
    });
  });

  describe('majBrouillon', () => {
    it('réécrit la même ligne plutôt que d’en empiler une seconde', async () => {
      await service.majBrouillon(7, { name: 'Durand' });

      expect(resultFormRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, name: 'Durand' }),
      );
    });

    it('refuse de modifier un bail déjà généré', async () => {
      generationRepository.countBy.mockResolvedValue(1);

      await expect(service.majBrouillon(7, { name: 'Durand' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(resultFormRepository.save).not.toHaveBeenCalled();
    });

    it('signale une saisie inconnue', async () => {
      resultFormRepository.findOne.mockResolvedValue(null);

      await expect(service.majBrouillon(7, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('supprimerBrouillon', () => {
    it('supprime la saisie mise de côté', async () => {
      await service.supprimerBrouillon(7);

      expect(resultFormRepository.delete).toHaveBeenCalledWith(7);
    });

    it('refuse de supprimer un bail déjà généré', async () => {
      generationRepository.countBy.mockResolvedValue(1);

      await expect(service.supprimerBrouillon(7)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(resultFormRepository.delete).not.toHaveBeenCalled();
    });
  });
});
