# Identification des appareils

## Catégorie et rôle sont distincts

Une passerelle est un rôle réseau, pas une preuve de matériel : le rôle ne déclenche aucune classification. L’ordinateur qui exécute Netarium est reconnu localement. Les autres types sont des hypothèses à partir d’indices déclaratifs, jamais une authentification du matériel.

`shared/identification.ts` possède toutes les règles de classification. Les noms explicites (iPhone, MacBook, iPad, NAS…) et certains modèles annoncés donnent une confiance modérée. Les services d’impression ou Google Cast donnent un indice faible. AirPlay, SMB, HTTP, une marque, une MAC ou une plage IP seuls ne permettent pas de déterminer le matériel. Les noms de services personnalisables ne sont pas utilisés comme modèles. Des indices contradictoires produisent « À identifier ».

La confiance est qualitative : aucune probabilité chiffrée n’est inventée. « Élevée » est réservé à l’ordinateur local. Un nom usurpé peut induire une suggestion erronée ; la fiche affiche les indices et permet de corriger.

## Collecte bornée

Une découverte active enrichit les appareils déjà trouvés avec Bonjour/mDNS. Le mode cache reste sans requête mDNS. Le transport utilise `multicast-dns` et le navigateur DNS-SD public de `bonjour-service` ; il ne publie aucun service.

- Interface IPv4 sélectionnée ; réception UDP 5353 et requêtes multicast sur cette interface.
- Neuf types de services interrogés, sans recherche récursive de types arbitraires.
- Fenêtre de 3,5 secondes, maximum 128 annonces, 16 adresses examinées par annonce et 16 services retenus par appareil.
- Émetteur et adresses annoncées doivent appartenir au périmètre privé sélectionné ; hôtes limités à `.local`.
- Conservation du nom, de l’hôte, du type et du modèle annoncé ; seuls les champs TXT `model`, `am` et `md` sont lus, aucun lien annoncé n’est ouvert.
- Annulation, délai et erreurs ferment les navigateurs et le socket. Une indisponibilité mDNS dégrade l’identification sans perdre les observations ICMP ou de cache.

Une annonce ne crée pas de nouvel appareil et ne transforme pas une entrée du cache en présence confirmée. Des annonces manquées, des réponses fragmentées non assemblées par la bibliothèque, des appareils silencieux ou des restrictions multicast peuvent laisser un type inconnu. Aucun scan de ports, fingerprinting OS, recherche de fabricant en ligne ou interrogation DNS externe n’est ajouté.

## Données et compatibilité

La catégorie `Device.category` conserve son sens : annotation manuelle. `unknown` signifie « Automatique » dans l’éditeur ; les autres catégories sont prioritaires sur l’inférence. Le type effectivement affiché est calculé uniquement par `effectiveCategory`, partagé entre vues, icônes, carte, recherche et export CSV.

`Device.identification` contient la version du moteur, la catégorie suggérée, la confiance, la raison et les indices. `Observation.services` garde les annonces normalisées. Ces champs optionnels s’intègrent aux colonnes JSON existantes sans changement de schéma SQLite. Les nouvelles collectes recalculent les indices à partir du relevé courant, sans réutiliser ceux d’une ancienne IP. Les instantanés figent leur identification et leurs annotations.

Les inventaires antérieurs reçoivent une suggestion calculée depuis leurs données existantes à la lecture. Les anciens instantanés ne sont jamais réécrits : leur fiche indique l’absence d’identification historique. L’export JSON conserve les données détaillées ; le CSV ajoute `effectiveCategory` et `identificationConfidence` à la catégorie manuelle existante.

## Sources techniques

- [RFC 6763 — DNS-Based Service Discovery](https://datatracker.ietf.org/doc/html/rfc6763) : annonces PTR/SRV/TXT et domaine local.
- [bonjour-service](https://github.com/onlxltd/bonjour-service) : navigateur DNS-SD.
- [multicast-dns](https://github.com/mafintosh/multicast-dns) : interface réseau, événements et fermeture du transport.
