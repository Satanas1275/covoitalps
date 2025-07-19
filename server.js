const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 8102;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// == Helpers pour lire/écrire JSON fichier ==
function readJSON(file, def = {}) {
  if (!fs.existsSync(file)) return def;
  try {
    const d = fs.readFileSync(file, 'utf8');
    return d.trim() ? JSON.parse(d) : def;
  } catch (e) {
    console.log(`[DEBUG] Erreur readJSON(${file}):`, e);
    return def;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// == Fichiers ==
const usertrajetsFile = path.join(__dirname, 'usertrajets.json');
const reservationFile = path.join(__dirname, 'reservation.json');
const pointsFile = path.join(__dirname, 'point.json');

// == Endpoints pour la nouvelle structure ==

// Récupère tous les trajets proposés par tous les utilisateurs
app.get('/covoitealps/api/usertrajets/all', (req, res) => {
  const data = readJSON(usertrajetsFile, {});
  console.log("[DEBUG] /usertrajets/all -->", JSON.stringify(data, null, 2));
  res.json(data);
});

// Récupère les trajets proposés par un utilisateur
app.get('/covoitealps/api/usertrajets', (req, res) => {
  const { username } = req.query;
  const data = readJSON(usertrajetsFile, {});
  console.log(`[DEBUG] /usertrajets?username=${username} -->`, data[username]);
  if (!username || !data[username]) return res.json({});
  res.json(data[username].trajets);
});

// Sauvegarde/écrase les trajets proposés pour un utilisateur
app.post('/covoitealps/api/usertrajets/save', (req, res) => {
  const { username, point, trajets } = req.body;
  if (!username || !point || !trajets) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  const usertrajetsFile = 'usertrajets.json';
  const reservationFile = 'reservation.json';
  const alltraj = readJSON(usertrajetsFile, {});
  const oldUserTrajets = alltraj[username] ? alltraj[username].trajets : {};
  const reservations = readJSON(reservationFile, {});

  // BLOQUER si l'utilisateur est déjà passager sur ce créneau (point/date/sens)
  for (const date of Object.keys(trajets)) {
    for (const sens of ['aller', 'retour']) {
      const newT = trajets[date][sens];
      if (newT) {
        for (const passager of Object.keys(reservations)) {
          const resa = reservations[passager][sens];
          if (
            resa &&
            resa.date === date &&
            resa.conducteur !== username && // tu n'es pas déjà conducteur
            passager === username // tu es déjà passager sur ce slot
          ) {
            return res.status(400).json({ error: `Impossible de devenir conducteur le ${date} (${sens}) : tu es déjà inscrit comme passager sur ce créneau.` });
          }
        }
      }
    }
  }

  // BLOQUER si un autre utilisateur est déjà conducteur sur le même point/date/sens
  for (const user of Object.keys(alltraj)) {
    if (user === username) continue;
    const userTrajets = alltraj[user].trajets || {};
    for (const date of Object.keys(trajets)) {
      for (const sens of ['aller', 'retour']) {
        const otherT = userTrajets[date] && userTrajets[date][sens];
        const newT = trajets[date][sens];
        if (otherT && newT && alltraj[user].point === point) {
          // Si déjà conducteur ce jour/sens/point, blocage (option : ajoute check sur l'heure si besoin)
          return res.status(400).json({ error: `Impossible de devenir conducteur le ${date} (${sens}) : il y a déjà un conducteur sur ce créneau.` });
        }
      }
    }
  }

  // Vérifie changement d'heure avec passagers existants
  for (const date of Object.keys(trajets)) {
    for (const sens of ['aller', 'retour']) {
      const newT = trajets[date][sens];
      const oldT = oldUserTrajets && oldUserTrajets[date] ? oldUserTrajets[date][sens] : null;
      if (newT && oldT && oldT.passagers && oldT.passagers.length > 0) {
        if (newT.heure !== oldT.heure) {
          return res.status(400).json({ error: `Impossible de changer l'heure du ${sens} (${date}) : des passagers sont inscrits.` });
        }
      }
    }
  }

  // Si tout va bien, on enregistre
  alltraj[username] = { point, trajets };
  writeJSON(usertrajetsFile, alltraj);
  res.json({ message: "Trajets enregistrés !" });
});

// Récupère les points de covoiturage
app.get('/covoitealps/api/points', (req, res) => {
  const pts = readJSON(pointsFile, []);
  console.log("[DEBUG] /points -->", pts);
  res.json(pts);
});

// Ajoute un point de covoiturage
app.post('/covoitealps/api/points/add', (req, res) => {
  const { point } = req.body;
  if (!point || typeof point !== "string") return res.status(400).json({ error: "Le point doit être une chaîne non vide." });
  const points = readJSON(pointsFile, []);
  if (points.includes(point)) return res.status(400).json({ error: "Ce point existe déjà." });
  points.push(point);
  writeJSON(pointsFile, points);
  console.log("[DEBUG] Nouveau point ajouté:", point, "Liste complète:", points);
  res.json({ message: `Point ${point} ajouté avec succès.` });
});

// == Gestion des réservations ==

// Lister les réservations d'un utilisateur
app.get('/covoitealps/api/reservation/user', (req, res) => {
  const { username } = req.query;
  const data = readJSON(reservationFile, {});
  console.log(`[DEBUG] /reservation/user?username=${username}`, data[username]);
  res.json(data[username] || { aller: null, retour: null });
});

// Réserver un trajet (aller OU retour)
app.post('/covoitealps/api/reservation', (req, res) => {
  const { username, point, date, sens, conducteur } = req.body;
  console.log("[DEBUG] Reservation POST:", req.body);
  if (!username || !point || !date || !sens || !conducteur) {
    return res.status(400).json({ error: "Champs manquants" });
  }
  const alltraj = readJSON(usertrajetsFile, {});
  const conducteurTrajets = alltraj[conducteur];
  if (
    !conducteurTrajets ||
    conducteurTrajets.point !== point ||
    !conducteurTrajets.trajets[date] ||
    !conducteurTrajets.trajets[date][sens]
  ) {
    console.log("[DEBUG] Reservation: trajet non trouvé");
    return res.status(400).json({ error: "Trajet non trouvé" });
  }

  // Nouveau format attendu : objet avec heure, places, passagers
  const trajetObj = conducteurTrajets.trajets[date][sens];
  if (!trajetObj || typeof trajetObj !== 'object' || !trajetObj.heure) {
    return res.status(400).json({ error: "Trajet mal formé côté conducteur" });
  }
  trajetObj.passagers = trajetObj.passagers || [];
  trajetObj.places = trajetObj.places || 4;

  // Refuser si déjà passager
  if (trajetObj.passagers.includes(username)) {
    return res.status(400).json({ error: "Déjà inscrit sur ce trajet" });
  }
  // Refuser si complet
  if (trajetObj.passagers.length >= trajetObj.places) {
    return res.status(400).json({ error: "Plus de place disponible" });
  }

  // Empêcher d'être passager si tu es conducteur sur ce trajet/jour/sens
  if (conducteur === username) {
    return res.status(400).json({ error: "Tu es déjà conducteur sur ce trajet" });
  }
  // Empêcher d'être passager si tu es conducteur sur ce sens ce jour (même sur un autre trajet)
  for (const user of Object.keys(alltraj)) {
    const t = alltraj[user];
    if (t.point === point &&
        t.trajets[date] &&
        t.trajets[date][sens] &&
        user === username) {
      return res.status(400).json({ error: "Tu es déjà conducteur sur ce créneau" });
    }
  }

  // Ajouter le passager
  trajetObj.passagers.push(username);
  // Mettre à jour dans usertrajets.json
  writeJSON(usertrajetsFile, alltraj);

  // Mettre à jour reservation.json
  const resa = readJSON(reservationFile, {});
  if (!resa[username]) resa[username] = { aller: null, retour: null };
  resa[username][sens] = { date, heure: trajetObj.heure, conducteur };
  writeJSON(reservationFile, resa);

  res.json({ message: "Réservé !" });
});

// Se désinscrire d'un trajet (aller ou retour)
app.post('/covoitealps/api/reservation/unsubscribe', (req, res) => {
  const { username, sens } = req.body;
  console.log("[DEBUG] Unsubscribe:", req.body);
  const resa = readJSON(reservationFile, {});
  if (!resa[username] || !resa[username][sens]) {
    console.log("[DEBUG] Désinscription: Pas inscrit");
    return res.status(400).json({ error: "Pas inscrit" });
  }

  // On enlève le passager aussi de la liste des passagers dans usertrajets.json
  const alltraj = readJSON(usertrajetsFile, {});
  const resaItem = resa[username][sens];
  if (resaItem) {
    for (const user of Object.keys(alltraj)) {
      const t = alltraj[user];
      if (
        t.point === (resaItem.point || t.point) &&
        t.trajets[resaItem.date] &&
        t.trajets[resaItem.date][sens]
      ) {
        let trajetObj = t.trajets[resaItem.date][sens];
        if (typeof trajetObj === "object" && trajetObj.passagers) {
          trajetObj.passagers = trajetObj.passagers.filter(p => p !== username);
        }
      }
    }
    writeJSON(usertrajetsFile, alltraj);
  }

  resa[username][sens] = null;
  writeJSON(reservationFile, resa);
  console.log("[DEBUG] reservation.json après désinscription:", JSON.stringify(resa, null, 2));
  res.json({ message: "Désinscription réussie !" });
});

// == Static/public & start ==
app.listen(port, () => {
  console.log(`Serveur démarré à http://localhost:${port}`);
});