# Actualités directes sans abonnement ni clé API

## État de cette branche

Base : `origin/main` au commit `be4cb5a7a3197932a7b5119fab78036ee29bae14`. Branche : `feat/direct-official-metadata-20261021`.

Le module `direct-news-collector.mjs` prépare une collecte directe des seules métadonnées titre, date de publication et URL. **Aucune nouvelle source n’est activée** : `direct-news-sources.json` contient une liste `sources` vide. Le module n’est volontairement pas branché au pipeline existant. Aucun appel réseau ni cache n’est créé à son import ou à une collecte avec liste vide. Aucun service Gemini, moteur de recherche ou clé API n’est nécessaire pour ce module.

Cela ne résout donc pas encore la couverture quotidienne de toutes les équipes. Un site accessible ou un flux public n’accorde pas, à lui seul, les droits de réutilisation. Le fait de réduire la sortie aux métadonnées ne permet pas non plus de présumer une autorisation générale de collecte automatisée commerciale. Il ne s’agit pas d’une conclusion selon laquelle toute date ou URL serait protégée : l’autorisation demandée pour cette intégration précise n’a simplement pas été établie.

Les anciennes sources et les liens existants de main ne sont ni supprimés ni déclarés nouvellement autorisés par cet audit. Les changements de la précédente branche RSS ne sont pas repris par fusion.

## Ce qui bloque concrètement

Les détails par source, y compris les limites de vérification, sont dans `direct-news-sources.json` (13 clubs réexaminés).

- **Levante** : les [mentions légales, section 3](https://www.levanteud.com/aviso-legal) réservent l’exploitation à une autorisation expresse écrite, avec usage privé/personnel seulement. Aucune exception explicite pour les métadonnées commerciales n’a été trouvée.
- **FC Cincinnati / D.C. United** : les [conditions MLS, section 5.2(vi)](https://www.mlssoccer.com/legal/terms-of-service) interdisent la collecte automatisée pour un usage commercial lorsqu’elles s’appliquent. Elles visent les sites de clubs sur lesquels elles sont publiées : cette publication exacte n’a pas été revérifiée pour chacun des deux clubs. Leur applicabilité ne doit donc pas être affirmée sans réserve; aucune permission commerciale propre à ces clubs n’a été vérifiée.
- **Bolton** : l’[index public](https://www.bwfc.co.uk/news) est lisible, mais pas de permission générale vérifiée; la page de conditions testée n’a pas livré de texte exploitable. Pas de JSON-LD, `time` ou `article:*` constaté dans le HTML brut de cet index.
- **Middlesbrough / Nottingham Forest** : les pages de [politiques](https://www.mfc.co.uk/club/policies-and-terms) et [conditions](https://www.nottinghamforest.co.uk/terms-of-use) extraites exposent le consentement, pas les clauses nécessaires. Les robots contiennent des groupes nommés, pas une licence de réutilisation.
- **Ipswich** : [robots](https://www.itfc.co.uk/robots.txt) permet l’exploration, mais la [page de politiques](https://www.itfc.co.uk/club/policies) consultée n’a pas fourni de licence commerciale.
- **KV Kortrijk / Go Ahead Eagles / Telstar** : les [disclaimers Kortrijk](https://www.kvk.be/disclaimer/), [Eagles](https://www.ga-eagles.nl/disclaimer/) et [Telstar](https://sctelstar.nl/disclaimer) ne fournissent pas l’autorisation recherchée. Les index peuvent exposer des cartes, titres ou dates; cela ne suffit pas pour les activer.
- **Torino / KV Mechelen / Monza** : respectivement restriction robots visant des agents IA, robots HTTP 503, et index candidat HTTP 404 avec page de confidentialité exclue. Aucun droit commercial vérifié; audit technique partiel, pas de contournement.

Pour débloquer une source, obtenir une permission écrite couvrant explicitement collecte automatisée et affichage commercial des titres/dates/liens, ou une licence publique équivalente. Ne pas remplacer cela par un quota gratuit ou changer d’agent utilisateur pour contourner une restriction.

## Garde-fous prêts pour une source autorisée

Chaque entrée doit être explicitement approuvée, rattachée à des équipes vérifiées, limitée à une origine HTTPS et un préfixe d’articles, avec texte d’autorisation, empreinte SHA-256 des conditions et revue expirant en 30 jours au maximum. Les conditions/preuves du module sont exigées sur la même origine; une autorisation privée hors site exigerait une adaptation revue, pas un faux hash.

Avant lecture d’un index : contrôle de robots et des conditions. Blocage en cas de refus, fichier robots inexploitable, changement des conditions ou revue expirée. Une absence de groupe applicable est refusée par prudence : ce choix est plus strict que l’usage habituel de robots.txt et n’est pas présenté comme une interdiction juridique.

Une seule page d’index est lue par source et collecte, après temporisation d’au moins une seconde ou délai robots supérieur (au plus 30 secondes). Pas de navigation vers les articles, de redirection, de cookies, de proxy, de répétition automatique ou d’endpoint privé. Réponses limitées à 1 Mo et 10 secondes. JSON-LD et sélecteurs HTML préconfigurés seulement; jamais `dateModified` comme date de publication. Trois éléments maximum par équipe, âgés de 30 jours au plus; aucun corps, résumé ou média conservé dans les sorties.

Cache facultatif explicite, plafonné à six heures, résultats vides compris. Les règles et conditions sont revérifiées même sur un cache; la date de collecte originale est préservée. Une future connexion au rendu devra valider l’autorisation à la lecture et afficher source, date et lien de licence; elle n’est pas activée ici faute de source recevable.

## Une photo de stade ajoutée

**Ipswich Town, Portman Road** : [fiche individuelle Commons](https://commons.wikimedia.org/wiki/File:Portman_Road_aerial.jpg). Titre original : *Portman Road - Ipswich Town football club ground - Suffolk aerial*. Auteur : **John Fielding**, prise de vue le **19 juillet 2015**. Licence : [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), permettant l’usage commercial avec attribution. La fiche Commons rapporte la vérification de la licence Flickr le 1er octobre 2015.

Fichier local : `public/team-media/8b6c976b4f2a49214b21.jpg`, 960 × 636 px. Transformation : réduction proportionnelle et réencodage JPEG, sans recadrage ni retouche. Vue générale du stade, sans joueur reconnaissable ni logo utilisé comme élément graphique. Il s’agit d’une illustration historique, pas d’une photo récente. Crédit, date, source et licence sont conservés dans le JSON et affichés par le composant existant; aucune modification de mise en page.

Les candidats Audi Field et façade Riverside ont été écartés après inspection visuelle en raison de logos/écussons visibles. Le candidat Bolton utilise une variante territoriale de licence non prise en charge par le validateur actuel; ce dernier n’a pas été élargi pour le faire accepter. Aucune photo d’éditeur ni de joueur n’a été ajoutée.

## Vérification locale

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Le workflow FTP, le SEO, les titres et routes, les liens déjà présents, l’identité visuelle, les prédictions et résultats historiques ne sont pas modifiés. Aucun merge ni déploiement n’est prévu par cette branche.
