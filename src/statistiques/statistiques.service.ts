import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EtatLocataire } from '../locataire/locataire-etat.enum';
import { Locataire } from '../locataire/locataire.entity';
import {
  calculerStatistiques,
  StatistiquesLocataires,
} from './statistiques.calcul';

@Injectable()
export class StatistiquesService {
  constructor(
    @InjectRepository(Locataire)
    private readonly locataireRepository: Repository<Locataire>,
  ) {}

  /**
   * Charge seulement les colonnes dont le calcul a besoin : ni nom, ni adresse,
   * ni téléphone n'est lu (donc déchiffré) pour produire des chiffres. Les
   * colonnes chiffrées ne se regroupent pas en SQL, le calcul se fait en mémoire.
   */
  async locataires(appartementId?: number): Promise<StatistiquesLocataires> {
    const fiches = await this.locataireRepository.find({
      select: {
        id: true,
        etat: true,
        dateNaissance: true,
        profession: true,
        entree: true,
        sortie: true,
      },
      where: {
        etat: In([EtatLocataire.LOCATAIRE, EtatLocataire.SORTI]),
        ...(appartementId === undefined
          ? {}
          : { appartement: { id: appartementId } }),
      },
    });

    return calculerStatistiques(fiches);
  }
}
