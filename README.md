# ATHX Race — EastBox

Inscriptions et classement en direct pour la course simulation **ATHX** d'EastBox.

| Fichier | À qui | Contenu |
|---|---|---|
| `index.html` | **Adhérents** | Le WOD · Inscription (avec choix de la vague) · Classement |
| `admin.html` | **Organisateur** | Saisie des scores · Classement · Équipes & vagues · Le WOD · Données |
| `config.js` | — | L'URL de la base et le code d'accès organisateur |
| `athx.css` / `athx.js` | — | Le style et le code, partagés par les deux pages |

## La course

| Épreuve | Format | Score |
|---|---|---|
| **Part A — Strength** | 20 min · toutes catégories (1RM strict press / 3RM back squat / 5RM deadlift) | Charge totale de la paire (kg) |
| **Rest** | 10 minutes entre chaque bloc | — |
| **Part B — Endurance** | AMRAP 22 min · RUN / ROW en relais (LITE 500 m, ATHX 750 m, PRO 1000 m) | Distance totale de la paire (m) |
| **Rest** | 10 minutes entre chaque bloc | — |
| **Part C — Metcon X** | For time · time cap 25 min, mouvements propres à chaque catégorie | Temps de réalisation |

Catégories : **LITE**, **ATHX**, **PRO**.

## Sous-catégories de duo

Chaque équipe appartient aussi à une sous-catégorie, **déduite automatiquement du sexe
des deux athlètes** — rien de plus à saisir à l'inscription :

| Athlètes | Sous-catégorie |
|---|---|
| Homme + Homme | **Duo Hommes** |
| Femme + Femme | **Duo Femmes** |
| Homme + Femme | **Duo Mixte** |

Le formulaire affiche la sous-catégorie en direct dès que les deux sexes sont choisis.

Dans l'onglet Classement, deux affichages au choix :

- **Par catégorie** — un classement par LITE / ATHX / PRO, la sous-catégorie figurant sur chaque ligne.
- **Par catégorie et duo** — jusqu'à 9 classements (3 catégories × 3 duos). Les groupes vides
  ne sont pas affichés, et les points sont recalculés à l'intérieur de chaque groupe.

## Les vagues

5 vagues de **5 équipes maximum**, premier arrivé premier servi :

| Vague | Départ |
|---|---|
| 1 | 10h30 |
| 2 | 11h00 |
| 3 | 11h30 |
| 4 | 12h00 |
| 5 | 12h30 |

Une vague pleine apparaît « COMPLÈTE » et ne peut plus être choisie. Si deux personnes
s'inscrivent en même temps sur la dernière place, la seconde est refusée et invitée à
choisir une autre vague.

Pour changer les horaires ou le nombre d'équipes par vague : `athx.js`, constantes
`WAVES` et `WAVE_CAP` tout en haut du fichier.

## Classement

- Chaque épreuve est classée à l'intérieur de sa catégorie.
- 1<sup>re</sup> place = 1 point, 2<sup>e</sup> = 2 points… **le plus petit total gagne.**
- Égalité sur une épreuve : même rang pour les deux équipes.
- Départage au total : meilleur classement en Part C, puis Part B, puis Part A.
- Équipe sans score sur une épreuve : points de la dernière place de sa catégorie.

## Mise en route

### 1. Créer la base partagée (5 minutes, une seule fois)

Sans cette étape, les pages fonctionnent mais **chaque appareil reste isolé** :
les inscriptions faites sur un téléphone n'arrivent pas sur l'écran de la salle.

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) et connecte-toi.
2. **Ajouter un projet** → nom `athx-race` → tu peux refuser Google Analytics.
3. Menu de gauche → **Créer** → **Realtime Database** → **Créer une base de données**.
4. Emplacement : **Europe (europe-west1)**. Règles de sécurité : **Démarrer en mode test**.
5. En haut de la page s'affiche une URL du type
   `https://athx-race-default-rtdb.europe-west1.firebasedatabase.app` — copie-la.
6. Colle-la dans `config.js`, à la place des guillemets vides :

```js
window.ATHX_CONFIG = {
  dbUrl: "https://athx-race-default-rtdb.europe-west1.firebasedatabase.app",
  adminPin: "EASTBOX"
};
```

Le mode test laisse la base ouverte en lecture et en écriture pendant 30 jours.
C'est volontaire : les adhérents n'ont aucun compte à créer. Après la course,
supprime la base ou passe les règles en lecture seule.

### 2. Choisir le code organisateur

Dans `config.js`, remplace `adminPin` par un code à toi. Il est demandé à l'ouverture
de `admin.html`. Ce code décourage les curieux mais ne protège pas réellement la page :
ne diffuse que l'adresse de `index.html` aux adhérents.

### 3. Publier sur GitHub Pages

1. Crée un dépôt public sur GitHub, par exemple `athx-race`.
2. Pousse le contenu de ce dossier (`index.html` à la racine du dépôt).
3. **Settings** → **Pages** → Source : `Deploy from a branch`, branche `main`, dossier `/ (root)`.
4. Au bout d'une minute :
   - adhérents → `https://<ton-compte>.github.io/athx-race/`
   - organisateur → `https://<ton-compte>.github.io/athx-race/admin.html`

Partage le premier lien (QR code sur le mur de la salle, groupe WhatsApp…).

## Le jour de la course

- Les équipes s'inscrivent depuis leur téléphone et choisissent leur vague.
- Toi, sur `admin.html` : onglet **Saisie des scores**, filtre par vague, tu saisis heat par heat.
  Les totaux se calculent seuls, le classement se met à jour chez tout le monde en quelques secondes.
- Onglet **Classement** → **Mode écran TV** pour l'affichage de la salle (sortie par Échap).
- Onglet **Données** → **Exporter** régulièrement : c'est ta sauvegarde.

Le badge en haut à droite indique l'état de la liaison : *Classement en direct*,
*Hors ligne — cet appareil*, ou *Connexion perdue*.
