# Actualités officielles : liste blanche fermée par défaut

## Résultat concret

**Aucune source officielle n’est activée.** L’audit du 21 octobre 2026 n’a établi aucune autorisation explicite de collecte et de republication commerciale des titres, dates et liens pour BTTSPredict. Le moteur existe, mais il ne fournit donc actuellement **aucun nouveau titre officiel**. Ce n’est ni une couverture générale des clubs ni une garantie juridique.

Le fichier `official-news-sources.json` sépare `sources` (autorisations effectivement approuvées, actuellement vide) et `audit` (preuves, exclusions et limites). Parmi les 24 clubs des pronostics courants :

- 12 ont fait l’objet d’un examen des accès robots et des pages légales accessibles, ou d’un arrêt sur restriction d’accès. St. Pauli n’a été examiné qu’au niveau robots. Certains accès légaux/robots sont incomplets : voir chaque entrée.
- 6 supplémentaires ont une vérification partielle : Bolton, Nottingham Forest, Telstar, Málaga, Alavés et Ipswich.
- 6 n’ont pas de vérification exploitable : Middlesbrough (URL trouvée seulement), Go Ahead Eagles (expiration HTTP), Kortrijk, Mechelen, Monza et Torino (non testés).

**Ne pas présenter ces 24 candidats comme 24 audits complets.** Aucun article individuel n’a été aspiré pour cet audit. Certaines extractions des rubriques publiques ont fourni un aperçu; ces aperçus ne sont pas conservés ni republiés.

## Principales preuves

Les liens et résultats techniques détaillés de chaque club sont dans le registre JSON. Exemples déterminants :

- [Levante — avis légal](https://www.levanteud.com/aviso-legal) : pas de licence commerciale établie; exploitation/réutilisation soumise à autorisation. Un endpoint RSS existe mais n’est pas activé.
- [Darmstadt — Impressum](https://www.sv98.de/impressum/) : reproduction/diffusion sans permission expresse interdite. Le [RSS](https://www.sv98.de/feed/) techniquement disponible ne suffit pas à autoriser la réutilisation commerciale.
- [Wolfsburg — Imprint](https://www.vfl-wolfsburg.de/en/general/imprint) : copie même partielle soumise à autorisation expresse. La rubrique vérifiée concernait les féminines, pas une couverture complète de l’équipe masculine.
- [MLS — conditions](https://www.mlssoccer.com/legal/terms-of-service) : restrictions de contenu commercial; leur publication/applicabilité exacte sur chaque rubrique des deux clubs MLS n’a pas été complètement établie. Aucune permission explicite n’a été trouvée : exclusion prudente, pas affirmation d’une interdiction juridique universelle des hyperliens.
- [Austria — Impressum](https://fk-austria.at/impressum) sans licence générale trouvée; les [conditions du centre presse](https://presse.fk-austria.at/TermsAndConditions.aspx?l=deutsch) ne sont pas une licence générale du site principal et restreignent l’usage commercial/publicitaire.
- [Athletic — avis légal](https://www.athletic-club.eus/en/legal-notice/) : exception journalistique conditionnelle, pas d’autorisation établie pour cette agrégation affiliée; robots renvoie 403.
- [St. Pauli — robots](https://www.fcstpauli.com/robots.txt) : accès refusé à des agents IA nommés; pas de changement d’identité pour contourner la restriction.

Une absence de permission trouvée n’est pas une conclusion juridique sur toutes les exceptions légales possibles. La règle produit choisie ici est plus conservatrice : **pas de reprise sans permission établie**. Un robots accessible ou permissif n’est jamais une licence.

## Chemin réellement exécuté

`update-team-context.mjs` appelle `collectOfficialNews` une seule fois pour les clubs des matchs actuels. Le collecteur :

1. Ignore toute source non approuvée, expirée ou sans les trois permissions explicites : collecte automatisée, titres commerciaux, dates/liens.
2. Lit robots.txt, exige une réponse exploitable et un accès autorisé aux URL de collecte et de conditions; respecte le délai robots (minimum une seconde; arrêt si supérieur à 30 secondes).
3. Vérifie le SHA-256 exact des conditions et la présence de la citation autorisante. Toute modification impose une nouvelle revue humaine.
4. Lit uniquement le flux RSS/Atom ou les métadonnées JSON-LD d’une page publique explicitement autorisée. Pas de navigation vers chaque article, d’accès privé, de proxy ou de contournement.
5. Émet au plus trois titres datés par source/club, avec lien et attribution. Aucune reprise de corps, résumé ou image. Les dates impossibles, futures, sans fuseau quand une heure est fournie, ou de plus de 30 jours sont rejetées. `updated`/`dateModified` ne deviennent jamais `publishedAt`.

Les requêtes ont un timeout de dix secondes et une limite de deux mégaoctets. Les redirections, challenges, réponses 403/429, robots absent/inexploitable et conditions modifiées échouent fermé, sans réessai agressif. Les URL doivent rester sur l’origine HTTPS approuvée et dans le préfixe de chemin autorisé. Le registre est une configuration mainteneur revue, jamais une entrée URL fournie par un visiteur; ce n’est pas un proxy public ni un outil d’accès à des domaines arbitraires.

L’ancien chemin actif GDELT à liens génériques et la liste manuelle « Official publication » sont retirés du pipeline. Les utilitaires GDELT historiques ne sont pas utilisés pour alimenter ces pages. Les nouveaux contrôles de cache refusent ces entrées. Les actualités Wikinews sous licence restent le repli existant, sans garantie de couverture récente. Aucun statut de récupération live de Wikinews n’est inventé par ce changement.

Le rendu revalide la source et l’autorisation avant d’afficher le **vrai titre**, la date et le lien. Les anciens liens officiels sans preuve sont retirés des actualités publiques. Sans entrée admissible, la carte l’indique explicitement; les liens généraux vers les sites officiels et Wikidata restent disponibles lorsqu’ils étaient déjà présents. Les anciennes dates de contrôle ne sont pas avancées pendant ce nettoyage.

Les images Commons et leurs licences individuelles/attributions ne sont pas modifiées. Aucun visuel de club/éditeur n’est ajouté par le collecteur d’actualités.

## Pour activer une source plus tard

Obtenir d’abord une permission qui couvre BTTSPredict et son contexte commercial/affilié. Si l’accord est privé ou si ses conditions ne peuvent pas être vérifiées par le mécanisme public actuel, adapter la preuve et les tests dans une revue de code; ne pas inventer une URL de conditions ni forcer les booléens à `true`.

Un enregistrement approuvé doit fournir : `id`, `status: approved`, `publisher`, `url`, `articlePathPrefix`, `format` (`rss`, `atom`, `jsonld`), `teamNames` exacts du flux de matchs, `termsUrl`, `termsSha256`, `permissionQuote`, `reviewedAt`, `reviewExpiresAt` (au maximum 30 jours après revue), `license`, `licenseUrl` identique à `termsUrl`, et `permissions.automatedCollection`, `.commercialHeadlines`, `.datesAndLinks` à `true`. Les conditions publiques doivent être sur la même origine HTTPS que la source. Les fixtures fictives des tests ne constituent jamais des sources approuvées.

Ajouter un test de parsing fondé sur la structure autorisée, vérifier la pertinence exacte du club et la stabilité des dates, puis tester robots et conditions réels avant activation. Aucune tâche planifiée ni commande FTP n’est modifiée par cette branche : le collecteur utilise uniquement l’étape existante du pipeline, après fusion/déploiement éventuels par une décision séparée.
