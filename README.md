# 🎮 Site de Recrutement — Guide de déploiement

## 📁 Structure
```
index.html   ← page principale
style.css    ← styles
app.js       ← logique complète
README.md    ← ce fichier
```

---

## 🚀 Déploiement sur Railway via GitHub

1. **Push sur GitHub** : crée un dépôt public ou privé et pousse ces fichiers
2. **Railway** : va sur [railway.app](https://railway.app), crée un nouveau projet → *Deploy from GitHub repo*
3. Railway détecte automatiquement un site statique — c'est bon !
4. Ton site est en ligne 🎉

> Railway sert les fichiers statiques sans configuration supplémentaire.

---

## 📧 Configuration EmailJS (obligatoire pour les mails)

### 1. Crée un compte sur [emailjs.com](https://www.emailjs.com)

### 2. Crée un **Service** (Gmail, Outlook, etc.)
   → Note le **Service ID** (ex: `service_abc123`)

### 3. Crée 5 **Templates** :

#### Template 1 — Nouvelle candidature (pour les RH)
- **Sujet** : `[{{server_name}}] Nouvelle candidature — {{poste_nom}}`
- **Corps** :
```
Nouvelle candidature reçue pour le poste : {{poste_nom}} ({{poste_cat}})

Candidat : {{candidat_nom}}
Pseudo RP : {{candidat_rp}}
Email : {{candidat_email}}
Date : {{date}}

Lettre de motivation :
{{motivation}}

CV : {{cv}}

Infos supplémentaires :
{{extra}}
```
- Dans l'onglet **To email** → mets {{to_email}}

#### Template 2 — Accusé de réception (pour le candidat)
- **Sujet** : `[{{server_name}}] Candidature reçue — {{poste_nom}}`
- **Corps** :
```
Bonjour {{to_name}},

Nous avons bien reçu ta candidature pour le poste : {{poste_nom}} sur {{server_name}}.

Notre équipe RH va l'examiner dans les plus brefs délais.

À bientôt,
L'équipe RH de {{server_name}}
```

#### Template 3 — Prise en charge
- **Sujet** : `[{{server_name}}] Ta candidature est prise en charge`
- **Corps** :
```
Bonjour {{to_name}},

Ta candidature pour le poste {{poste_nom}} sur {{server_name}} va être prise en charge dans les plus brefs délais.

Nous reviendrons vers toi très prochainement.

L'équipe RH de {{server_name}}
```

#### Template 4 — Accepté
- **Sujet** : `[{{server_name}}] Candidature acceptée 🎉`
- **Corps** :
```
Bonjour {{to_name}},

Félicitations ! Ta candidature pour le poste {{poste_nom}} sur {{server_name}} a été acceptée.

Bienvenue dans l'équipe ! Un membre de l'équipe te contactera prochainement.

L'équipe RH de {{server_name}}
```

#### Template 5 — Refusé
- **Sujet** : `[{{server_name}}] Candidature — Résultat`
- **Corps** :
```
Bonjour {{to_name}},

Après examen de ta candidature pour le poste {{poste_nom}} sur {{server_name}}, nous ne sommes pas en mesure de donner suite.

Nous te souhaitons bonne chance dans tes recherches.

L'équipe RH de {{server_name}}
```

### 4. Note ta **Public Key**
   → Dans EmailJS : Account → API Keys → Public Key

---

## ⚙️ Configuration dans le site

1. Va sur ton site → clique **Espace RH**
2. Mot de passe par défaut : **`rh2025`**
3. Va dans l'onglet **Configuration**
4. Remplis tous les champs (Public Key, Service ID, Template IDs, Email RH, Nom du serveur)
5. Change le mot de passe RH
6. Clique **Sauvegarder**

> ⚠️ Les données (postes, candidatures, config) sont stockées dans le `localStorage` du navigateur.
> Pour une vraie persistance multi-navigateur, il faudrait un backend ou une base de données.

---

## 🔒 Sécurité

- Le mot de passe RH est stocké en localStorage côté client
- Pour une sécurité renforcée en production, ajoute un backend Node.js avec authentification JWT
- EmailJS gratuit = 200 emails/mois

---

## ✅ Fonctionnalités

- [x] Page publique avec postes par catégorie (WL / STAFF / ANIMATION / DÉVELOPPEMENT)
- [x] Formulaire de candidature (nom, prénom, RP, email, motivation, CV, extras)
- [x] Mail automatique aux RH à chaque candidature
- [x] Accusé de réception automatique au candidat
- [x] Espace RH protégé par mot de passe
- [x] Création / modification / suppression de postes
- [x] Liste des candidatures avec filtres (statut, catégorie)
- [x] Bouton "Prendre en charge" → mail au candidat
- [x] Bouton "Accepter" → mail au candidat
- [x] Bouton "Refuser" → mail au candidat
- [x] Configuration EmailJS depuis l'interface
