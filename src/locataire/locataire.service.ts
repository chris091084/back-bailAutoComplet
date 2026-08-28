import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { ResultForm } from '../generation/result-form.entity';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { EtatLocataire } from './locataire-etat.enum';
import { Locataire } from './locataire.entity';

/** Une date d'entrée ou de sortie est un jour de calendrier : « AAAA-MM-JJ ». */
const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Borne basse de la date de naissance : au-delà d'un siècle et demi, c'est une
 * faute de frappe, pas un locataire.
 */
const DATE_NAISSANCE_MIN = '1900-01-01';

@Injectable()
export class LocataireService {
  constructor(
    @InjectRepository(Locataire)
    private readonly locataireRepository: Repository<Locataire>,
    @InjectRepository(Appartement)
    private readonly appartementRepository: Repository<Appartement>,
    @InjectRepository(ResultForm)
    private readonly resultFormRepository: Repository<ResultForm>,
  ) {}

  /**
   * Les trois listes de l'écran locataires, une par état. Chacune se lit à
   * l'endroit où on l'a laissée : les sortis du départ le plus récent au plus
   * ancien, c'est celui qu'on vient de saisir qu'on relit ; les locataires en
   * place suivent la même logique sur l'entrée, ceux sans date renseignée en
   * fin de liste ; les candidats par id décroissant, le dernier bail généré en
   * tête, aucune date ne les distinguant encore.
   */
  getAllLocataires(etat = EtatLocataire.LOCATAIRE): Promise<Locataire[]> {
    const tris: Record<EtatLocataire, FindOptionsOrder<Locataire>> = {
      [EtatLocataire.CANDIDAT]: { id: 'DESC' },
      [EtatLocataire.LOCATAIRE]: {
        entree: { direction: 'DESC', nulls: 'LAST' },
        id: 'DESC',
      },
      [EtatLocataire.SORTI]: { sortie: 'DESC', id: 'ASC' },
    };

    return this.locataireRepository.find({
      where: { etat },
      relations: { appartement: { chambres: true }, resultForm: true },
      order: tris[etat],
    });
  }

  async getLocataireById(id: number): Promise<Locataire> {
    const locataire = await this.locataireRepository.findOne({
      where: { id },
      relations: { appartement: { chambres: true }, resultForm: true },
    });

    if (!locataire) {
      throw new NotFoundException(`Locataire not found with id: ${id}`);
    }

    return locataire;
  }

  findByAppartementId(appartementId: number): Promise<Locataire[]> {
    return this.locataireRepository.find({
      where: { appartement: { id: appartementId } },
      relations: { appartement: { chambres: true }, resultForm: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Un locataire n'existe que par le bail dont il est issu : `resultFormId` est
   * donc obligatoire à la création, ce qui ferme la saisie manuelle depuis la
   * liste des locataires. La modification, elle, reste libre.
   *
   * La fiche naît `candidat` : générer un bail ne fait pas encore un occupant,
   * c'est la signature qui la fait passer locataire.
   */
  async createLocataire(details: UpsertLocataireDto): Promise<Locataire> {
    if (!details.nom || !details.prenom) {
      throw new BadRequestException('nom et prenom sont obligatoires');
    }

    if (details.resultFormId == null) {
      throw new BadRequestException(
        "resultFormId est obligatoire : un locataire ne peut être créé qu'à partir d'un bail généré",
      );
    }

    const resultForm = await this.getResultForm(details.resultFormId);

    const locataire = this.locataireRepository.create({
      nom: details.nom,
      prenom: details.prenom,
      telephone: details.telephone ?? null,
      email: details.email ?? null,
      dateNaissance: this.validerDateNaissance(details.dateNaissance),
      profession: details.profession || null,
      // Rien ne demande la date d'entrée au moment de générer le bail : elle
      // est reprise de sa date de prise d'effet, à défaut d'être fournie.
      entree:
        details.entree !== undefined
          ? this.validerDate(details.entree, 'entree')
          : (resultForm?.from ?? null),
      appartement: await this.getAppartement(details.appartementId),
      resultForm,
      etat: EtatLocataire.CANDIDAT,
    });

    return this.locataireRepository.save(locataire);
  }

  async updateLocataire(
    id: number,
    details: UpsertLocataireDto,
  ): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);

    if (details.nom != null) {
      locataire.nom = details.nom;
    }
    if (details.prenom != null) {
      locataire.prenom = details.prenom;
    }
    if (details.telephone !== undefined) {
      locataire.telephone = details.telephone;
    }
    if (details.email !== undefined) {
      locataire.email = details.email;
    }
    // `!== undefined` : un `null` explicite efface la date de naissance ou
    // celle d'entrée, toutes deux facultatives sur la fiche.
    if (details.dateNaissance !== undefined) {
      locataire.dateNaissance = this.validerDateNaissance(
        details.dateNaissance,
      );
    }
    if (details.entree !== undefined) {
      locataire.entree = this.validerDate(details.entree, 'entree');
    }
    if (details.profession !== undefined) {
      locataire.profession = details.profession;
    }
    if (details.appartementId != null) {
      locataire.appartement = await this.getAppartement(details.appartementId);
    }
    // `!== undefined` et non `!= null` : un `null` explicite détache le
    // result_form, contrairement à `appartementId` qui reste obligatoire.
    if (details.resultFormId !== undefined) {
      locataire.resultForm = await this.getResultForm(details.resultFormId);
    }

    return this.locataireRepository.save(locataire);
  }

  /**
   * Le bail est signé : le candidat devient locataire, et sa fiche gagne les
   * actions qui n'avaient pas de sens avant — quittance, congé, sortie.
   *
   * Hors d'`updateLocataire` comme la résiliation et la sortie : c'est un fait
   * constaté, pas un champ que la modale d'édition doit pouvoir écraser.
   *
   * La transition ne part que de `candidat`. Signer deux fois, ou signer une
   * fiche déjà sortie, n'est pas un raccourci mais une méprise : autant la
   * refuser que rendre un état incohérent avec la liste d'où vient le clic.
   */
  async signerBail(id: number): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);

    if (locataire.etat !== EtatLocataire.CANDIDAT) {
      throw new BadRequestException(
        `Seul un candidat peut être passé en locataire : cette fiche est déjà « ${locataire.etat} »`,
      );
    }

    locataire.etat = EtatLocataire.LOCATAIRE;

    return this.locataireRepository.save(locataire);
  }

  /**
   * Horodate l'envoi de la lettre de congé. Volontairement hors d'
   * `updateLocataire` : c'est un fait constaté après l'envoi du mail, pas un
   * champ que la modale d'édition doit pouvoir écraser.
   *
   * Un nouvel envoi écrase la date précédente : c'est le dernier courrier parti
   * qui intéresse, pas l'historique.
   */
  async marquerResiliationEnvoyee(id: number): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);
    locataire.resiliationEnvoyeeLe = new Date();

    return this.locataireRepository.save(locataire);
  }

  /**
   * Sortie du logement. Elle remplace la suppression : le locataire quitte la
   * liste principale sans emporter son bail, ses quittances ni la trace de sa
   * lettre de congé.
   *
   * La date vient du front et non de l'horloge : un départ se déclare souvent
   * après coup, parfois à l'avance. Une sortie déjà posée est simplement
   * corrigée par une nouvelle.
   *
   * L'état part avec la date : c'est lui qui range désormais la fiche, la date
   * ne fait plus que dire quel jour.
   */
  async marquerSortie(id: number, sortie?: string): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);

    if (!sortie) {
      throw new BadRequestException(
        'sortie est obligatoire et doit être au format AAAA-MM-JJ',
      );
    }

    // On ne quitte pas un logement où l'on n'est jamais entré : un candidat
    // n'a pas de bail signé, donc rien dont sortir.
    if (locataire.etat === EtatLocataire.CANDIDAT) {
      throw new BadRequestException(
        "Un candidat ne peut pas sortir du logement : son bail n'est pas signé",
      );
    }

    locataire.sortie = this.validerDate(sortie, 'sortie');
    locataire.etat = EtatLocataire.SORTI;

    return this.locataireRepository.save(locataire);
  }

  /**
   * Réintègre un locataire sorti : la date de sortie tombe, la fiche revient
   * dans la liste principale telle qu'elle l'avait quittée. C'est la sortie de
   * secours d'une date saisie par erreur.
   *
   * Elle revient `locataire` et jamais `candidat` : son bail est signé, c'est
   * le départ qu'on annule, pas la signature.
   */
  async reintegrerLocataire(id: number): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);
    locataire.sortie = null;
    locataire.etat = EtatLocataire.LOCATAIRE;

    return this.locataireRepository.save(locataire);
  }

  /**
   * `new Date` seul accepte n'importe quelle chaîne interprétable : le format
   * est donc vérifié avant, puis la date elle-même, un 2026-02-31 passant le
   * gabarit sans exister.
   *
   * `null` traverse : entrée comme sortie sont des champs facultatifs, c'est à
   * l'appelant d'exiger une valeur quand elle l'est.
   */
  private validerDate(valeur: string | null, champ: string): string | null {
    if (valeur == null) {
      return null;
    }

    if (!FORMAT_DATE.test(valeur)) {
      throw new BadRequestException(
        `${champ} doit être au format AAAA-MM-JJ : ${valeur}`,
      );
    }

    const date = new Date(`${valeur}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(valeur)) {
      throw new BadRequestException(`Date invalide pour ${champ} : ${valeur}`);
    }

    return valeur;
  }

  /**
   * Une date de calendrier, dans les bornes du vraisemblable : c'est l'âge
   * affiché dans la liste qui en dépend, une saisie à côté (un millésime tapé
   * de travers, une date à venir) doit être refusée plutôt qu'affichée.
   *
   * La comparaison se fait sur les chaînes « AAAA-MM-JJ », que leur format à
   * champs fixes range dans l'ordre chronologique.
   */
  private validerDateNaissance(date?: string | null): string | null {
    const valeur = this.validerDate(date ?? null, 'dateNaissance');
    if (valeur == null) {
      return null;
    }

    const aujourdhui = new Date().toISOString().slice(0, 10);
    if (valeur < DATE_NAISSANCE_MIN || valeur > aujourdhui) {
      throw new BadRequestException(
        `dateNaissance doit être comprise entre ${DATE_NAISSANCE_MIN} et ${aujourdhui} : ${valeur}`,
      );
    }

    return valeur;
  }

  /**
   * L'appartement est chargé plutôt que référencé par `{ id }` : la colonne
   * `appartement_id` étant NOT NULL, un id absent ou inconnu doit répondre 400
   * ou 404 au lieu de laisser remonter une violation de contrainte en 500.
   * L'entité complète permet en prime de renseigner `appartementNom` dans la
   * réponse d'une création, sans relecture.
   */
  private async getAppartement(appartementId?: number): Promise<Appartement> {
    if (appartementId == null) {
      throw new BadRequestException('appartementId est obligatoire');
    }

    const appartement = await this.appartementRepository.findOneBy({
      id: appartementId,
    });

    if (!appartement) {
      throw new NotFoundException(
        `Appartement not found with id: ${appartementId}`,
      );
    }

    return appartement;
  }

  /**
   * Chargé plutôt que référencé par `{ id }`, comme l'appartement : un id
   * inconnu doit répondre 404 au lieu d'une violation de clé étrangère en 500.
   * La liaison reste facultative, d'où le `null` accepté en entrée.
   */
  private async getResultForm(
    resultFormId?: number | null,
  ): Promise<ResultForm | null> {
    if (resultFormId == null) {
      return null;
    }

    const resultForm = await this.resultFormRepository.findOneBy({
      id: resultFormId,
    });

    if (!resultForm) {
      throw new NotFoundException(
        `ResultForm not found with id: ${resultFormId}`,
      );
    }

    return resultForm;
  }
}
