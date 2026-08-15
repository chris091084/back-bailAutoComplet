import { ValueTransformer } from 'typeorm';

/**
 * Le driver pg renvoie les `bigint` et `numeric` sous forme de chaînes pour ne
 * pas perdre de précision. L'API Spring Boot sérialisait ces colonnes en
 * nombres JSON (Long et BigDecimal côté Jackson) : on reconvertit donc en
 * `number` pour garder exactement le même contrat côté front.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
