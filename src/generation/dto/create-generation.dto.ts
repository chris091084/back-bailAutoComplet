/** Référence vers une entité déjà persistée (seul l'id est exploité). */
export interface ReferenceDto {
  id: number;
}

export class CreateResultFormDto {
  adress?: string | null;
  appartement?: ReferenceDto | null;
  chargePrice?: number | null;
  email?: string | null;
  firstname?: string | null;
  from?: string | null;
  to?: string | null;
  motif?: string | null;
  name?: string | null;
  priceNoCharge?: number | null;
  room?: string | null;
  telephone?: string | null;
  bailleur?: ReferenceDto | null;
  bailType?: string | null;
  tIrl?: string | null;
  valIrl?: string | null;
  lastPriceWithoutCharge?: number | null;
  chargeList?: boolean | null;
  clauseLess6Month?: boolean | null;
  typeResidence?: string | null;
  rentRef?: number | null;
  rentRefMaj?: number | null;
}

export class CreateGenerationDto {
  id?: string;
  date!: string;
  appartementName!: string;
  locataireName!: string;
  resultForm?: CreateResultFormDto | null;
}
