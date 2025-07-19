document.addEventListener('DOMContentLoaded', async () => {
  const trajetsContainer = document.getElementById('trajet-list');

  if (!trajetsContainer) {
    console.log("Le conteneur 'trajet-list' n'a pas été trouvé.");
    return;
  }

  async function fetchTrajets() {
    try {
      const response = await fetch('/covoitealps/api/trajets');
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des trajets:', error);
      return {};
    }
  }

  function getUpcomingDays() {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const today = new Date();
    const currentDay = today.getDay();
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;

    let startDay;
    if (currentDay === 0 || currentDay === 6) {
      startDay = 1;
    } else {
      startDay = currentDay;
    }

    const upcomingDays = [];
    for (let i = 0; i < 5; i++) {
      const dayIndex = (startDay + i - 1) % 5;
      const dayName = days[dayIndex];
      if (currentDay === 0 || currentDay === 6) {
        upcomingDays.push(dayName);
      } else {
        const dayOffset = (dayIndex + 1 - currentDay + 7) % 7;
        if (dayOffset === 0 || dayOffset > 0) {
          upcomingDays.push(dayName);
        }
      }
    }
    return upcomingDays;
  }

  async function registerAsPassenger(trajet, jour) {
    const currentUser = localStorage.getItem('name');
    console.log('Tentative d\'inscription - currentUser:', currentUser);

    if (!currentUser) {
      alert("Veuillez vous connecter pour vous inscrire comme passager.");
      console.log('currentUser est null ou vide. Vérifiez votre système de connexion.');
      return;
    }

    // Vérifier si l'utilisateur est le conducteur de ce trajet spécifique
    if (trajet.conducteur === currentUser) {
      alert("Vous êtes le conducteur de ce trajet, vous ne pouvez pas vous inscrire comme passager.");
      return;
    }

    // Vérifier si l'utilisateur est déjà conducteur d'un autre trajet le même jour
    const allTrajets = await fetchTrajets();
    let isAlreadyDriver = false;

    // Parcourir tous les points et leurs trajets pour ce jour
    for (const point in allTrajets) {
      const trajetsJour = allTrajets[point][jour] || [];
      if (trajetsJour.some(t => t.conducteur === currentUser)) {
        isAlreadyDriver = true;
        break;
      }
    }

    if (isAlreadyDriver) {
      alert("Vous êtes déjà conducteur d'un autre trajet ce jour-là, vous ne pouvez pas vous inscrire comme passager.");
      return;
    }

    if (trajet.nmb_de_place_restant <= 0) {
      alert("Aucune place restante pour ce trajet.");
      return;
    }

    try {
      const response = await fetch('/covoitealps/api/trajets/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          point: localStorage.getItem('chosenStop'),
          jour: jour,
          conducteur: trajet.conducteur,
          nmb_de_place_restant: trajet.nmb_de_place_restant - 1,
          passager: currentUser,
        }),
      });

      if (response.ok) {
        alert(`Vous êtes inscrit comme passager pour le trajet de ${trajet.conducteur} le ${jour}.`);
        await displayTrajets();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error || 'Inscription échouée'}`);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du trajet:', error);
      alert("Une erreur est survenue. Veuillez réessayer.");
    }
  }

  async function displayTrajets() {
    const chosenStop = localStorage.getItem('chosenStop') || null;
    const trajets = await fetchTrajets();
    trajetsContainer.innerHTML = "<h2>Vous conduit :</h2>";

    if (!chosenStop) {
      trajetsContainer.innerHTML += "<p>Veuillez choisir un arrêt en cliquant sur un point dans la page des points.</p>";
      return;
    }

    if (!trajets[chosenStop]) {
      trajetsContainer.innerHTML += "<p>Aucun trajet disponible pour cet arrêt.</p>";
      return;
    }

    const jours = getUpcomingDays();
    const trajetsLieu = trajets[chosenStop];

    if (jours.length === 0) {
      trajetsContainer.innerHTML += "<p>Aucun jour à venir à afficher.</p>";
      return;
    }

    jours.forEach((jour) => {
      const jourElement = document.createElement("p");
      jourElement.textContent = jour;
      trajetsContainer.appendChild(jourElement);

      const trajetsJour = trajetsLieu[jour] || [];
      if (trajetsJour.length > 0) {
        trajetsJour.forEach(trajet => {
          const tbox = document.createElement("div");
          tbox.classList.add("tbox");
          tbox.innerHTML = `
            <a href="#">
              <p>${chosenStop}</p>
              <p>Places restantes: ${trajet.nmb_de_place_restant}</p>
              <p>Conducteur: ${trajet.conducteur}</p>
              ${trajet.aller ? `<p>Aller: ${trajet.aller}</p>` : ''}
              ${trajet.retour ? `<p>Retour: ${trajet.retour}</p>` : ''}
            </a>
          `;
          tbox.addEventListener('click', (e) => {
            e.preventDefault();
            registerAsPassenger(trajet, jour);
          });
          trajetsContainer.appendChild(tbox);
        });
      } else {
        const emptyMsg = document.createElement("p");
        emptyMsg.textContent = "Aucun trajet prévu.";
        trajetsContainer.appendChild(emptyMsg);
      }
    });
  }

  await displayTrajets();
});