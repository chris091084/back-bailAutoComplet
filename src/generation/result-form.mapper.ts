import { Appartement } from '../appartement/appartement.entity';
import { Bailleur } from '../bailleur/bailleur.entity';
import { CreateResultFormDto, ReferenceDto } from './dto/create-generation.dto';
import { ResultForm } from './result-form.entity';

/**
 * Recopie le formulaire reçu sur l'entité. Partagé par la génération d'un bail
 * et par l'enregistrement d'une saisie mise de côté : c'est le même formulaire,
 * seul le moment où il est écrit change.
 *
 * La recopie est intégrale, champ absent valant `null` : le front envoie
 * toujours le formulaire entier, une mise à jour partielle laisserait traîner
 * la valeur d'une saisie précédente.
 *
 * `appartement` et `bailleur` sont réduits à leur identifiant : côté Java ces
 * relations n'avaient pas de cascade, un POST ne pouvait donc pas modifier
 * l'appartement ni le bailleur référencés.
 */
export function appliquerResultFormDto(
  resultForm: ResultForm,
  dto: CreateResultFormDto,
): ResultForm {
  resultForm.adress = dto.adress ?? null;
  resultForm.appartement = toReference<Appartement>(dto.appartement);
  resultForm.chargePrice = dto.chargePrice ?? null;
  resultForm.email = dto.email ?? null;
  resultForm.firstname = dto.firstname ?? null;
  resultForm.from = dto.from ?? null;
  resultForm.to = dto.to ?? null;
  resultForm.motif = dto.motif ?? null;
  resultForm.name = dto.name ?? null;
  resultForm.priceNoCharge = dto.priceNoCharge ?? null;
  resultForm.room = dto.room ?? null;
  resultForm.telephone = dto.telephone ?? null;
  resultForm.bailleur = toReference<Bailleur>(dto.bailleur);
  resultForm.bailType = dto.bailType ?? null;
  resultForm.tIrl = dto.tIrl ?? null;
  resultForm.valIrl = dto.valIrl ?? null;
  resultForm.lastPriceWithoutCharge = dto.lastPriceWithoutCharge ?? null;
  resultForm.chargeList = dto.chargeList ?? null;
  resultForm.clauseLess6Month = dto.clauseLess6Month ?? null;
  resultForm.typeResidence = dto.typeResidence ?? null;
  resultForm.rentRef = dto.rentRef ?? null;
  resultForm.rentRefMaj = dto.rentRefMaj ?? null;

  return resultForm;
}

function toReference<T>(reference: ReferenceDto | null | undefined): T | null {
  return reference?.id != null ? ({ id: reference.id } as T) : null;
}
