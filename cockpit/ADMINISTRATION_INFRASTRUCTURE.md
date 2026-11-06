# Administration et sobriété des transferts

Le menu Administration est réservé au profil administrateur de Valentin, identifié par son UID. Annie ne monte ni le panneau ni son abonnement. Les règles déjà déployées protègent `privateContentVersions` en lecture administrateur; les écritures du navigateur restent interdites. Aucun rôle, règle ou service payant n'est ajouté.

## Sources et périodes

- Les compteurs de session proviennent du SDK et ne représentent ni tous les clients ni une facture. Les tailles d'instantanés livrés ne sont jamais assimilées à des lectures facturées.
- Cloud Monitoring fournit des périodes complètes de 24 heures UTC, sur 14 jours. Le choix de 7 jours filtre ce relevé. Les jauges montrent le maximum journalier; les compteurs sont additionnés sur la période. Une série absente reste absente, sans zéro inventé.
- Les montants proviennent d'un relevé de facturation explicitement daté et libellé en devise; ils ne constituent pas une preuve de prélèvement bancaire. Un budget est un seuil d'alerte, pas une limite de dépenses.
- Le suivi des sauvegardes reprend un manifeste effectivement finalisé. Les copies et la restauration nécessitent le PC; les originaux de travail restent sur SharePoint.

## Lecture et confidentialité

`privateContentVersions/admin-infrastructure-current` est un petit pointeur en temps réel. Le relevé immuable référencé est récupéré avec le jeton Firebase de l'utilisateur, en REST, `credentials: omit` et `cache: no-store`. Les mêmes règles de lecture s'appliquent. Les détails administratifs ne sont pas versés dans IndexedDB ou localStorage; seule une copie en mémoire est conservée jusqu'à la déconnexion. Le navigateur ne reçoit aucun accès Google Cloud administratif.

Les alertes sont visibles dans le menu et dans la session, avec déduplication. Les notifications natives demandent un clic explicite d'autorisation. Elles ne constituent pas une surveillance hors session; Google gère séparément ses alertes de budget. Une collecte de plus de 48 heures est signalée. « Relire le relevé » relit la dernière collecte publiée et ne prétend pas recalculer une facture Google.

## Collecte — lecture seule

Prérequis : Node 22 ou ultérieur, connexion humaine Firebase CLI 15.23.0 existante, droits de lecture Cloud Monitoring/configuration. Aucun identifiant ne doit être passé en argument ou exporté. Les API non accessibles sont signalées; l'outil n'en active aucune.

```powershell
node collect_infrastructure.mjs --cli-home="CHEMIN_FIREBASE_TOOLS" --output="DOSSIER_PRIVE"
```

Options facultatives : `--billing-source=JSON_VERIFIE`, `--backup-source=MANIFESTE_RESUME_VERIFIE`, `--optimization-source=COMPARAISON_VERIFIEE`. Ces données doivent garder leur propre date, méthode et provenance. Ne pas remplacer un relevé financier ancien par une extrapolation présentée comme observée. Les sorties restent privées.

## Mise à jour du panneau — modification privée explicite

```powershell
node publish_infrastructure.mjs --cli-home="CHEMIN_FIREBASE_TOOLS" --snapshot="DOSSIER_PRIVE/INFRASTRUCTURE_SNAPSHOT.json" --proof-dir="DOSSIER_PRIVE/PREUVES"
# Après contrôle du résultat simulé et dans le périmètre autorisé :
node publish_infrastructure.mjs --cli-home="CHEMIN_FIREBASE_TOOLS" --snapshot="DOSSIER_PRIVE/INFRASTRUCTURE_SNAPSHOT.json" --proof-dir="DOSSIER_PRIVE/PREUVES" --apply
```

Sans `--apply` : aucune écriture. Avec `--apply` : une version privée et le pointeur sont écrits atomiquement, avec précondition sur la version précédente. Un contenu inchangé ne crée rien. Un relevé plus ancien est rejeté. L'outil ne touche ni aux contenus éditoriaux, ni aux validations, ni aux autorisations. Les preuves avant/après restent dans le dossier privé. Actualiser lors d'un contrôle technique important; éviter les collectes répétées sans changement utile. Aucune tâche Scheduled n'est créée.

## Catalogue médias

La projection REST ne transfère pas `previewDataUrl`. Un seul document sert de marqueur de changement. Le catalogue léger est isolé par projet/utilisateur; son cache respecte la préférence mémoire et « Oublier cet appareil ». Les actualisations utilisent un curseur inclusif sur `updatedAt`, préservant les égalités de timestamp et la fenêtre de 160 entrées. Les aperçus sont récupérés lorsqu'ils deviennent visibles, dédupliqués et repris du cache Firestore lorsqu'ils correspondent à la version attendue. La galerie ouverte conserve son abonnement ciblé et ses avis séparés.

Tout producteur de médias doit mettre `updatedAt` à l'heure serveur, y compris pour un archivage ou une correction. Une nouvelle propriété visible de média doit être ajoutée à `MEDIA_CATALOG_FIELDS`. Ne pas y réintroduire des octets d'image. Les suppressions directes et les modifications rétrodatées sortent de ce contrat; elles ne font pas partie du flux normal. Pour une intervention exceptionnelle, invalider le cache de catalogue et recharger une fenêtre complète.

## Vérifications et retour arrière

Exécuter `test:media-catalog`, `test:infrastructure`, `test:resilience`, `test:workspace-v2`, `test:media-rules`, puis l'audit complet. Les nouveaux fichiers sont explicitement copiés dans le workflow Pages. Les règles restent inchangées. Le retour arrière du code rétablit le chargement antérieur sans migration de données. Les relevés privés peuvent rester archivés sans affecter les publications; conserver le manifeste de sauvegarde et le commit de départ.
