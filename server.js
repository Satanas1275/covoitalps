const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 8102;

// Middleware pour parser les requêtes JSON
app.use(express.json());

// Servir les fichiers statiques (HTML, CSS, JS) depuis le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Fonction pour vérifier si une semaine s'est écoulée depuis la dernière synchronisation
function hasWeekPassed(lastSyncDate) {
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  return (now - new Date(lastSyncDate)) >= oneWeekInMs;
}

// Fonction pour lire ou initialiser lastSync.json
function getLastSyncDate() {
  const lastSyncFile = path.join(__dirname, 'lastSync.json');
  if (!fs.existsSync(lastSyncFile)) {
    const now = new Date().toISOString();
    fs.writeFileSync(lastSyncFile, JSON.stringify({ lastSync: now }));
    return now;
  }
  const data = fs.readFileSync(lastSyncFile, 'utf8');
  if (!data.trim()) {
    const now = new Date().toISOString();
    fs.writeFileSync(lastSyncFile, JSON.stringify({ lastSync: now }));
    return now;
  }
  return JSON.parse(data).lastSync;
}

// Fonction pour mettre à jour lastSync.json
function updateLastSyncDate() {
  const lastSyncFile = path.join(__dirname, 'lastSync.json');
  const now = new Date().toISOString();
  fs.writeFileSync(lastSyncFile, JSON.stringify({ lastSync: now }));
}

// Fonction pour synchroniser trajet.json avec users.json
function syncTrajetsWithUsers(force = false) {
  const lastSyncDate = getLastSyncDate();
  if (!force && !hasWeekPassed(lastSyncDate)) {
    console.log('Synchronisation non nécessaire.');
    return;
  }

  fs.readFile(path.join(__dirname, 'users.json'), 'utf8', (err, userData) => {
    if (err) {
      console.error('Erreur lors de la lecture de users.json:', err);
      return;
    }

    let users = userData.trim() ? JSON.parse(userData) : [];

    fs.readFile(path.join(__dirname, 'point.json'), 'utf8', (err, pointData) => {
      if (err) {
        console.error('Erreur lors de la lecture de point.json:', err);
        return;
      }

      let points = pointData.trim() ? JSON.parse(pointData) : [];

      let trajets = {};
      points.forEach(point => {
        trajets[point] = {
          "Lundi": [],
          "Mardi": [],
          "Mercredi": [],
          "Jeudi": [],
          "Vendredi": []
        };
      });

      const usersByPoint = {};
      users.forEach(user => {
        if (!usersByPoint[user.point]) usersByPoint[user.point] = [];
        usersByPoint[user.point].push(user);
      });

      Object.keys(usersByPoint).forEach(point => {
        const usersForPoint = usersByPoint[point];
        const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
        days.forEach(day => {
          const availableUsers = usersForPoint.filter(user => {
            const hasAller = user.aller && user.aller.days.includes(day);
            const hasRetour = user.retour && user.retour.days.includes(day);
            return hasAller || hasRetour;
          });

          availableUsers.forEach(user => {
            const allerTime = user.aller && user.aller.days.includes(day) ? user.aller.time : null;
            const retourTime = user.retour && user.retour.days.includes(day) ? user.retour.time : null;
            if (allerTime || retourTime) {
              trajets[point][day].push({
                nmb_de_place_restant: 4,
                conducteur: user.username,
                aller: allerTime,
                retour: retourTime,
                passagers: []
              });
            }
          });
        });
      });

      fs.writeFile(path.join(__dirname, 'trajet.json'), JSON.stringify(trajets, null, 2), (err) => {
        if (err) {
          console.error('Erreur lors de l\'écriture de trajet.json:', err);
          return;
        }
        updateLastSyncDate();
        console.log('trajet.json synchronisé avec succès.');
      });
    });
  });
}

// Endpoint API pour récupérer trajet.json
app.get('/covoitealps/api/trajets', (req, res) => {
  const filePath = path.join(__dirname, 'trajet.json');
  if (!fs.existsSync(filePath)) {
    console.log('trajet.json n\'existe pas, création d\'un fichier vide.');
    fs.writeFileSync(filePath, '{}');
  }
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Erreur lecture trajet.json:', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la lecture de trajet.json' });
    }
    res.json(data.trim() ? JSON.parse(data) : {});
  });
});

// Endpoint API pour récupérer point.json
app.get('/covoitealps/api/points', (req, res) => {
  fs.readFile(path.join(__dirname, 'point.json'), 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la lecture de point.json' });
    }
    res.json(data.trim() ? JSON.parse(data) : []);
  });
});

// Endpoint API pour ajouter un nouveau point
app.post('/covoitealps/api/points/add', (req, res) => {
  const newPoint = req.body.point;
  if (!newPoint || typeof newPoint !== 'string') {
    return res.status(400).json({ error: 'Le point doit être une chaîne non vide.' });
  }

  fs.readFile(path.join(__dirname, 'point.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Erreur lecture point.json' });
    let points = data.trim() ? JSON.parse(data) : [];
    if (points.includes(newPoint)) {
      return res.status(400).json({ error: 'Ce point existe déjà.' });
    }
    points.push(newPoint);

    fs.writeFile(path.join(__dirname, 'point.json'), JSON.stringify(points, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Erreur écriture point.json' });

      fs.readFile(path.join(__dirname, 'trajet.json'), 'utf8', (err, trajetData) => {
        if (err) return res.status(500).json({ error: 'Erreur lecture trajet.json' });
        let trajets = trajetData.trim() ? JSON.parse(trajetData) : {};
        trajets[newPoint] = { "Lundi": [], "Mardi": [], "Mercredi": [], "Jeudi": [], "Vendredi": [] };

        fs.writeFile(path.join(__dirname, 'trajet.json'), JSON.stringify(trajets, null, 2), (err) => {
          if (err) return res.status(500).json({ error: 'Erreur écriture trajet.json' });
          syncTrajetsWithUsers();
          res.json({ message: `Point ${newPoint} ajouté avec succès.` });
        });
      });
    });
  });
});

// Endpoint API pour récupérer users.json
app.get('/covoitealps/api/users', (req, res) => {
  fs.readFile(path.join(__dirname, 'users.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Erreur lecture users.json' });
    res.json(data.trim() ? JSON.parse(data) : []);
  });
});

// Endpoint API pour sauvegarder ou mettre à jour un utilisateur
app.post('/covoitealps/api/users/save', (req, res) => {
  const userData = req.body;
  if (!userData.username || !userData.point) {
    return res.status(400).json({ error: 'Les champs username et point sont requis.' });
  }

  fs.readFile(path.join(__dirname, 'users.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Erreur lecture users.json' });
    let users = data.trim() ? JSON.parse(data) : [];
    const userIndex = users.findIndex(user => user.username === userData.username);

    if (userIndex !== -1) {
      users[userIndex] = userData;
    } else {
      users.push(userData);
    }

    fs.writeFile(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Erreur écriture users.json' });
      syncTrajetsWithUsers();
      res.json({ message: 'Informations sauvegardées avec succès.' });
    });
  });
});

// Endpoint API pour mettre à jour un trajet (inscription passager)
app.post('/covoitealps/api/trajets/update', (req, res) => {
  const { point, jour, conducteur, nmb_de_place_restant, passager } = req.body;
  if (!point || !jour || !conducteur || nmb_de_place_restant === undefined || !passager) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  fs.readFile(path.join(__dirname, 'trajet.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Erreur lecture trajet.json' });
    let trajets = data.trim() ? JSON.parse(data) : {};

    if (!trajets[point] || !trajets[point][jour]) {
      return res.status(400).json({ error: 'Trajet non trouvé.' });
    }

    const trajetIndex = trajets[point][jour].findIndex(t => t.conducteur === conducteur);
    if (trajetIndex === -1) {
      return res.status(400).json({ error: 'Conducteur non trouvé.' });
    }

    if (!trajets[point][jour][trajetIndex].passagers) {
      trajets[point][jour][trajetIndex].passagers = [];
    }
    if (trajets[point][jour][trajetIndex].passagers.includes(passager)) {
      return res.status(400).json({ error: 'Passager déjà inscrit.' });
    }

    trajets[point][jour][trajetIndex].nmb_de_place_restant = nmb_de_place_restant;
    trajets[point][jour][trajetIndex].passagers.push(passager);

    fs.writeFile(path.join(__dirname, 'trajet.json'), JSON.stringify(trajets, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Erreur écriture trajet.json' });
      res.json({ message: 'Trajet mis à jour avec succès.' });
    });
  });
});

// Synchronisation au démarrage
syncTrajetsWithUsers(true);

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré à http://localhost:${port}`);
});