import { DonneesPdf, echapper, genererHtml } from './edl-pdf.template';

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

const donnees = (surcharge: Partial<DonneesPdf> = {}): DonneesPdf => ({
  titre: 'État des lieux d’entrée',
  brouillon: false,
  dateSignature: '15 octobre 2026',
  bailleur: {
    nom: 'M. Bailleur',
    adresse: '1 rue B',
    email: 'b@test.fr',
    telephone: '0102030405',
  },
  locataire: {
    nomComplet: 'Léa Testeur',
    email: 'lea@test.fr',
    telephone: null,
  },
  logement: {
    adresse: '56 rue de la Filature',
    chauffage: 'Gaz (collectif)',
    clesRemises: '2 clés',
  },
  pieces: [
    {
      nom: 'Chambre 4',
      elements: [
        {
          nom: 'Murs',
          etatBailleur: 'Bon état',
          commentaireBailleur: 'Peinture récente',
          etatLocataire: 'État moyen',
          commentaireLocataire: 'Tache',
          dateSaisie: '15/10/2026 10:02',
          valideTelQuel: false,
          photos: [{ src: PIXEL }],
        },
        {
          nom: 'Sols',
          etatBailleur: 'Bon état',
          commentaireBailleur: null,
          etatLocataire: '',
          commentaireLocataire: null,
          dateSaisie: null,
          valideTelQuel: true,
          photos: [],
        },
      ],
    },
  ],
  signatureBailleur: null,
  signatureLocataire: PIXEL,
  empreinte: 'a'.repeat(64),
  ...surcharge,
});

describe('genererHtml', () => {
  it('reprend la structure du formulaire : parties, logement, tableau par pièce', () => {
    const html = genererHtml(donnees());

    expect(html).toContain('État des lieux d’entrée');
    expect(html).toContain('M. Bailleur');
    expect(html).toContain('Léa Testeur');
    expect(html).toContain('56 rue de la Filature');
    expect(html).toContain('Gaz (collectif)');
    expect(html).toContain('<h2>Chambre 4</h2>');
    expect(html).toContain('État (bailleur / référence)');
    expect(html).toContain('État (locataire)');
  });

  it('montre les deux appréciations, le commentaire des deux et la saisie datée', () => {
    const html = genererHtml(donnees());

    expect(html).toContain('Bon état');
    expect(html).toContain('État moyen');
    expect(html).toContain('15/10/2026 10:02');
    expect(html).toContain('<b>Bailleur :</b> Peinture récente');
    expect(html).toContain('<b>Locataire :</b> Tache');
  });

  it('distingue « validé tel quel » d’une saisie du locataire', () => {
    expect(genererHtml(donnees())).toContain('Validé tel quel');
  });

  it('intègre les photos et les signatures', () => {
    const html = genererHtml(donnees());

    expect(html).toContain(
      `<img class="miniature" alt="Photo de Murs" src="${PIXEL}">`,
    );
    expect(html).toContain(`<img alt="Signature" src="${PIXEL}">`);
    expect(html).toContain('Non signé');
  });

  it('signale une photo qui n’a pas pu être récupérée plutôt que de l’omettre', () => {
    const base = donnees();
    base.pieces[0].elements[0].photos = [{ src: null }];

    expect(genererHtml(base)).toContain('Photo non récupérable');
  });

  it('imprime l’empreinte et la date de signature', () => {
    const html = genererHtml(donnees());

    expect(html).toContain('a'.repeat(64));
    expect(html).toContain(
      'Document signé électroniquement le 15 octobre 2026',
    );
  });

  it('marque un brouillon non signé', () => {
    expect(genererHtml(donnees({ brouillon: true }))).toContain('BROUILLON');
    expect(genererHtml(donnees())).not.toContain('BROUILLON');
  });

  describe('sécurité : le contenu des utilisateurs ne s’exécute jamais', () => {
    it('échappe le HTML d’un commentaire', () => {
      const base = donnees();
      base.pieces[0].elements[0].commentaireLocataire =
        '<script>alert(1)</script><img src=x onerror=alert(2)>';

      const html = genererHtml(base);

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('échappe les noms (pièce, élément, locataire, adresse)', () => {
      const base = donnees({
        locataire: {
          nomComplet: '"><svg onload=1>',
          email: null,
          telephone: null,
        },
      });
      base.pieces[0].nom = '<b>x</b>';

      const html = genererHtml(base);

      expect(html).not.toContain('<svg onload=1>');
      expect(html).not.toContain('<h2><b>x</b></h2>');
    });

    it('refuse un « src » d’image qui n’est pas une de nos URL de données', () => {
      const base = donnees();
      base.pieces[0].elements[0].photos = [
        { src: 'http://exemple.fr/espion.png' },
        { src: 'javascript:alert(1)' },
        { src: 'data:image/svg+xml;base64,PHN2Zz4=' },
        { src: `${PIXEL}" onerror="alert(1)` },
      ];

      const html = genererHtml(base);

      expect(html).not.toContain('espion.png');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('svg+xml');
      expect(html).not.toContain('onerror="alert(1)"');
      expect(html.match(/Photo non récupérable/g)).toHaveLength(4);
    });
  });

  it('echapper gère null et les cinq caractères sensibles', () => {
    expect(echapper(null)).toBe('');
    expect(echapper(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
