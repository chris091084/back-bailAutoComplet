/**
 * Gabarit HTML du PDF, calqué sur le formulaire Word : en-tête des parties, infos
 * du logement, un tableau par pièce (élément / état bailleur / état locataire /
 * commentaires), photos en miniatures, signatures et date.
 *
 * Fonction PURE (données → texte) : aucun accès à la base ni au réseau, donc
 * testable sans navigateur. Tout texte venu des utilisateurs (commentaires,
 * noms…) passe par `echapper` : un commentaire contenant `<script>` ne doit jamais
 * s'exécuter dans le navigateur qui fabrique le PDF.
 */

export interface PhotoPdf {
  /** `data:image/...;base64,...`, ou `null` si la photo n'a pas pu être récupérée. */
  src: string | null;
}

export interface ElementPdf {
  nom: string;
  etatBailleur: string;
  commentaireBailleur: string | null;
  etatLocataire: string;
  commentaireLocataire: string | null;
  /** « 15/10/2026 10:02 » : quand le locataire a saisi, si c'est le cas. */
  dateSaisie: string | null;
  /** Validé tel quel, sans saisie propre du locataire. */
  valideTelQuel: boolean;
  photos: PhotoPdf[];
}

export interface DonneesPdf {
  titre: string;
  /** Document non signé : un bandeau le dit, pour qu'on ne le prenne pas pour définitif. */
  brouillon: boolean;
  dateSignature: string | null;
  bailleur: {
    nom: string;
    adresse: string;
    email: string;
    telephone: string;
  } | null;
  locataire: {
    nomComplet: string;
    email: string | null;
    telephone: string | null;
  };
  logement: {
    adresse: string;
    chauffage: string | null;
    clesRemises: string | null;
  };
  pieces: { nom: string; elements: ElementPdf[] }[];
  signatureBailleur: string | null;
  signatureLocataire: string | null;
  empreinte: string | null;
}

const ECHAPPEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const echapper = (texte: string | null | undefined): string =>
  (texte ?? '').replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c]);

/** N'accepte comme `src` que nos propres URL de données d'images : rien d'autre ne sort. */
const SRC_IMAGE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const srcSur = (src: string | null): string | null =>
  src !== null && SRC_IMAGE.test(src) ? src : null;

const ligneInfo = (
  libelle: string,
  valeur: string | null | undefined,
): string =>
  valeur
    ? `<tr><th>${echapper(libelle)}</th><td>${echapper(valeur)}</td></tr>`
    : '';

function elementHtml(element: ElementPdf): string {
  const bailleur = element.etatBailleur
    ? echapper(element.etatBailleur)
    : '<span class="muet">—</span>';

  const locataire = element.etatLocataire
    ? `${echapper(element.etatLocataire)}${element.dateSaisie ? `<div class="date">${echapper(element.dateSaisie)}</div>` : ''}`
    : element.valideTelQuel
      ? '<span class="muet">Validé tel quel</span>'
      : '<span class="muet">—</span>';

  const commentaires = [
    element.commentaireBailleur
      ? `<div><b>Bailleur :</b> ${echapper(element.commentaireBailleur)}</div>`
      : '',
    element.commentaireLocataire
      ? `<div><b>Locataire :</b> ${echapper(element.commentaireLocataire)}</div>`
      : '',
  ].join('');

  const photos = element.photos.length
    ? `<tr class="photos"><td colspan="4">${element.photos
        .map((photo) => {
          const src = srcSur(photo.src);
          return src
            ? `<img class="miniature" alt="Photo de ${echapper(element.nom)}" src="${src}">`
            : '<span class="photo-absente">Photo non récupérable</span>';
        })
        .join('')}</td></tr>`
    : '';

  return `<tr class="element"><td class="nom">${echapper(element.nom)}</td><td>${bailleur}</td><td>${locataire}</td><td>${commentaires || '<span class="muet">—</span>'}</td></tr>${photos}`;
}

function signatureHtml(
  titre: string,
  nom: string,
  image: string | null,
  date: string | null,
): string {
  const src = srcSur(image);
  return `<div class="signature">
    <div class="signature__titre">${echapper(titre)}</div>
    <div class="signature__nom">${echapper(nom)}</div>
    <div class="signature__cadre">${src ? `<img alt="Signature" src="${src}">` : '<span class="muet">Non signé</span>'}</div>
    ${src && date ? `<div class="signature__date">Le ${echapper(date)}</div>` : ''}
  </div>`;
}

export function genererHtml(donnees: DonneesPdf): string {
  const pieces = donnees.pieces
    .map(
      (piece) => `<section class="piece">
  <h2>${echapper(piece.nom)}</h2>
  <table class="tableau">
    <thead><tr><th class="c-nom">Élément</th><th class="c-etat">État (bailleur / référence)</th><th class="c-etat">État (locataire)</th><th>Commentaires</th></tr></thead>
    <tbody>${piece.elements.map(elementHtml).join('')}</tbody>
  </table>
</section>`,
    )
    .join('\n');

  const bailleur = donnees.bailleur;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(donnees.titre)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Carlito, Calibri, 'Liberation Sans', Arial, sans-serif; font-size: 10pt; color: #111; }
  h1 { margin: 0 0 4mm; font-size: 18pt; }
  h2 { margin: 7mm 0 2mm; font-size: 12pt; border-bottom: 1.5px solid #333; padding-bottom: 1mm; }
  .brouillon { margin-bottom: 4mm; padding: 2mm 3mm; border: 1.5px solid #b00020; color: #b00020; font-weight: 700; text-align: center; }
  .parties { display: flex; gap: 6mm; margin-bottom: 4mm; }
  .parties > div { flex: 1; }
  .parties h3 { margin: 0 0 1mm; font-size: 10pt; text-transform: uppercase; color: #444; }
  table.infos { border-collapse: collapse; width: 100%; }
  table.infos th { width: 28%; text-align: left; padding: 1mm 2mm 1mm 0; font-weight: 600; color: #444; vertical-align: top; }
  table.infos td { padding: 1mm 0; }
  .tableau { width: 100%; border-collapse: collapse; }
  .tableau th, .tableau td { border: 1px solid #666; padding: 1.6mm 2mm; vertical-align: top; text-align: left; }
  .tableau thead th { background: #e9ecef; font-size: 9pt; }
  .tableau thead { display: table-header-group; }
  .c-nom { width: 22%; } .c-etat { width: 19%; }
  .element, .photos { break-inside: avoid; }
  .nom { font-weight: 700; }
  .muet { color: #777; }
  .date { margin-top: 1mm; font-size: 8pt; color: #555; }
  .photos td { background: #fafafa; }
  .miniature { height: 28mm; width: auto; max-width: 42mm; margin: 0 2mm 2mm 0; border: 1px solid #aaa; object-fit: cover; }
  .photo-absente { display: inline-block; margin: 0 2mm 2mm 0; padding: 2mm; border: 1px dashed #b00020; color: #b00020; font-size: 8pt; }
  .signatures { display: flex; gap: 8mm; margin-top: 10mm; break-inside: avoid; }
  .signature { flex: 1; }
  .signature__titre { font-weight: 700; text-transform: uppercase; font-size: 9pt; color: #444; }
  .signature__nom { margin-bottom: 1mm; }
  .signature__cadre { height: 28mm; border: 1px solid #666; display: grid; place-items: center; }
  .signature__cadre img { max-height: 26mm; max-width: 100%; }
  .signature__date { margin-top: 1mm; font-size: 9pt; }
  .pied { margin-top: 6mm; font-size: 8pt; color: #555; word-break: break-all; }
</style>
</head>
<body>
  <h1>${echapper(donnees.titre)}</h1>
  ${donnees.brouillon ? '<div class="brouillon">DOCUMENT NON SIGNÉ — BROUILLON</div>' : ''}

  <div class="parties">
    <div>
      <h3>Bailleur</h3>
      ${bailleur ? `<table class="infos">${ligneInfo('Nom', bailleur.nom)}${ligneInfo('Adresse', bailleur.adresse)}${ligneInfo('E-mail', bailleur.email)}${ligneInfo('Téléphone', bailleur.telephone)}</table>` : '<span class="muet">—</span>'}
    </div>
    <div>
      <h3>Locataire</h3>
      <table class="infos">${ligneInfo('Nom', donnees.locataire.nomComplet)}${ligneInfo('E-mail', donnees.locataire.email)}${ligneInfo('Téléphone', donnees.locataire.telephone)}</table>
    </div>
  </div>

  <h3 style="margin:0 0 1mm;font-size:10pt;text-transform:uppercase;color:#444">Logement</h3>
  <table class="infos">${ligneInfo('Adresse', donnees.logement.adresse)}${ligneInfo('Chauffage', donnees.logement.chauffage)}${ligneInfo('Clés remises', donnees.logement.clesRemises)}</table>

  ${pieces}

  <div class="signatures">
    ${signatureHtml('Le bailleur', bailleur?.nom ?? '', donnees.signatureBailleur, donnees.dateSignature)}
    ${signatureHtml('Le locataire', donnees.locataire.nomComplet, donnees.signatureLocataire, donnees.dateSignature)}
  </div>

  <p class="pied">
    ${donnees.dateSignature ? `Document signé électroniquement le ${echapper(donnees.dateSignature)}.` : ''}
    ${donnees.empreinte ? `<br>Empreinte SHA-256 du contenu : ${echapper(donnees.empreinte)}` : ''}
  </p>
</body>
</html>`;
}
