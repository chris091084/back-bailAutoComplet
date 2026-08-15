export const RENT_REF = 'rentRef';
export const RENT_REF_MAJ = 'rentRefMaj';

export class RentRefDto {
  idAppartement!: number;
  fieldName!: string;
  value!: number | null;
}
