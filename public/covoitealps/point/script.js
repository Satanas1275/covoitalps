document.addEventListener('DOMContentLoaded', async () => {
  // Chercher le conteneur pour la liste des points
  const pointsContainer = document.getElementById('point-list');

  // Vérifier si le conteneur existe
  if (!pointsContainer) {
    console.log("Le conteneur 'point-list' n'a pas été trouvé. Le script ne s'exécutera pas.");
    return;
  }

  // Récupérer le bouton d'ajout
  const addButton = document.querySelector('.add-button');

  // Récupérer le nom d'utilisateur depuis localStorage
  const username = localStorage.getItem('name');

  // Vérifier si le nom d'utilisateur est défini
  if (!username) {
    alert("Veuillez définir votre nom d'utilisateur dans la page appropriée.");
    window.location.href = "../profile/"; // Rediriger vers la page de profil
    return;
  }

  // Récupérer les points depuis le backend
  async function fetchPoints() {
    try {
      const response = await fetch('/covoitealps/api/points');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des points:', error);
      return [];
    }
  }

  // Récupérer les utilisateurs depuis le backend
  async function fetchUsers() {
    try {
      const response = await fetch('/covoitealps/api/users');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      return [];
    }
  }

  // Mettre à jour le point de l'utilisateur dans users.json
  async function updateUserPoint(newPoint) {
    const users = await fetchUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      // Si l'utilisateur n'existe pas encore dans users.json, créer une entrée minimale
      const newUser = {
        username: username,
        point: newPoint,
        aller: { days: [], time: "" }, // Valeurs par défaut
        retour: { days: [], time: "" },
      };

      try {
        const response = await fetch('/covoitealps/api/users/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newUser),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('Erreur lors de la création de l\'utilisateur:', result.error);
        }
      } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
      }
    } else {
      // Mettre à jour le point de l'utilisateur existant
      user.point = newPoint;

      try {
        const response = await fetch('/covoitealps/api/users/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('Erreur lors de la mise à jour du point:', result.error);
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour du point:', error);
      }
    }
  }

  // Afficher la liste des points
  async function displayPoints() {
    const points = await fetchPoints();
    pointsContainer.innerHTML = "<h2>Points disponibles :</h2>";

    if (points.length === 0) {
      pointsContainer.innerHTML += "<p>Aucun point disponible.</p>";
      return;
    }

    points.forEach(point => {
      const pointElement = document.createElement("div");
      pointElement.classList.add("point-box");
      pointElement.innerHTML = `
        <p>${point}</p>
      `;
      // Ajouter un événement de clic pour sélectionner le point comme arrêt
      pointElement.addEventListener('click', async () => {
        localStorage.setItem('chosenStop', point);
        await updateUserPoint(point); // Mettre à jour le point dans users.json
        window.location.href = "../"; // Redirection vers la page principale
      });
      pointsContainer.appendChild(pointElement);
    });
  }

  // Créer une modale pour ajouter un nouveau point
  function createAddPointModal() {
    // Créer le conteneur de la modale
    const modal = document.createElement('div');
    modal.classList.add('modal');
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Ajouter un nouveau point</h3>
        <input type="text" id="new-point-input" placeholder="Entrez le nom du point" />
        <div class="modal-buttons">
          <button id="cancel-add-btn">Annuler</button>
          <button id="confirm-add-btn">Ajouter</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Gérer le bouton "Ajouter"
    const confirmBtn = document.getElementById('confirm-add-btn');
    confirmBtn.addEventListener('click', async () => {
      const newPointInput = document.getElementById('new-point-input');
      const newPoint = newPointInput.value.trim();

      try {
        const response = await fetch('/covoitealps/api/points/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ point: newPoint }),
        });

        const result = await response.json();

        if (response.ok) {
          await displayPoints(); // Rafraîchir la liste des points
          modal.remove(); // Fermer la modale
        }
      } catch (error) {
        console.error('Erreur lors de l\'ajout du point:', error);
      }
    });

    // Gérer le bouton "Annuler"
    const cancelBtn = document.getElementById('cancel-add-btn');
    cancelBtn.addEventListener('click', () => {
      modal.remove(); // Fermer la modale sans ajouter
    });
  }

  // Gérer le clic sur le bouton d'ajout
  if (addButton) {
    addButton.addEventListener('click', () => {
      createAddPointModal(); // Afficher la modale
    });
  }

  // Afficher les points au chargement de la page
  await displayPoints();
});