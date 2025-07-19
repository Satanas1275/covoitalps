document.addEventListener('DOMContentLoaded', async () => {
  const username = localStorage.getItem('name');
  const point = localStorage.getItem('chosenStop');
  const trajetHeader = document.getElementById('trajet-header');
  const allerList = document.getElementById('aller-list');
  const retourList = document.getElementById('retour-list');
  const alerteNoPoint = document.getElementById('alerte-no-point');
  const driverBtn = document.getElementById('driver-btn');

  if (!username) {
    alert("Veuillez définir votre nom d'utilisateur dans la page appropriée.");
    window.location.href = "/covoitealps/profile/";
    return;
  }

  function updateHeader() {
    trajetHeader.textContent = "Covoiturages pour : " + (point ? point : "(aucun point sélectionné)");
    alerteNoPoint.style.display = point ? "none" : "";
  }
  updateHeader();

  function getFrenchDayName(dateStr) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const d = new Date(dateStr);
    return jours[d.getDay()];
  }
  function getNextDaysWithLabel(count) {
    const arr = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      arr.push({
        iso,
        label: getFrenchDayName(iso)
      });
    }
    return arr;
  }

  async function fetchAllUserTrajets() {
    try {
      const res = await fetch('/covoitealps/api/usertrajets/all');
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Erreur fetch trajets:', e);
      return {};
    }
  }

  async function fetchMyReservation() {
    try {
      const res = await fetch('/covoitealps/api/reservation/user?username=' + encodeURIComponent(username));
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      return { aller: null, retour: null };
    } catch (e) {
      return { aller: null, retour: null };
    }
  }

  async function reserveTrajet(date, sens, conducteur) {
    try {
      const res = await fetch('/covoitealps/api/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          point,
          date,
          sens,
          conducteur
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur réservation");
      return true;
    } catch (e) {
      alert('Erreur pour réserver : ' + e.message);
      return false;
    }
  }

  async function unreserveTrajet(date, sens, conducteur) {
    try {
      const res = await fetch('/covoitealps/api/reservation/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          sens,
          date,
          conducteur
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur annulation");
      return true;
    } catch (e) {
      alert('Erreur pour se désinscrire : ' + e.message);
      return false;
    }
  }

  function groupTrajetsByDate(trajets, sens, jours) {
    // { dateISO: [ { conducteur, heure, places, passagers } ] }
    const map = {};
    for (const u of trajets) {
      for (const [date, t] of Object.entries(u.trajets)) {
        if (jours.some(j => j.iso === date) && t[sens]) {
          let tObj = t[sens];
          if (typeof tObj === "string") {
            tObj = { heure: tObj, places: 4, passagers: [] };
          }
          if (!map[date]) map[date] = [];
          map[date].push({
            conducteur: u.user,
            heure: tObj.heure || tObj,
            places: tObj.places || 4,
            passagers: tObj.passagers || []
          });
        }
      }
    }
    Object.values(map).forEach(arr => arr.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }

  function isConducteurCeJour(trajets, sens, date, user) {
    for (const t of trajets) {
      for (const [d, v] of Object.entries(t.trajets)) {
        if (d === date && v[sens]) {
          if (typeof v[sens] === "object" && t.user === user) return true;
          if (typeof v[sens] === "string" && t.user === user) return true;
        }
      }
    }
    return false;
  }

  function isPassagerCeTrajet(passagers) {
    return passagers && passagers.includes(username);
  }

  async function render() {
    allerList.innerHTML = "Chargement…";
    retourList.innerHTML = "Chargement…";
    const [allTrajets, myResa] = await Promise.all([fetchAllUserTrajets(), fetchMyReservation()]);

    const trajets = Object.entries(allTrajets)
      .filter(([user, obj]) => obj.point === point)
      .map(([user, obj]) => ({ user, trajets: obj.trajets }));

    const jours = getNextDaysWithLabel(7);

    function renderSens(sens, listEl) {
      listEl.innerHTML = '';
      const map = groupTrajetsByDate(trajets, sens, jours);

      for (const j of jours) {
        const arr = map[j.iso] || [];
        const jourDiv = document.createElement('div');
        jourDiv.className = 'trajet-jour';
        jourDiv.innerHTML = `<b>${j.label} :</b><br>`;
        if (arr.length === 0) {
          jourDiv.innerHTML += `<span style="color:#aaa;">Personne... Propose toi !</span>`;
        } else {
          arr.forEach((t, idx) => {
            const placesRestantes = t.places - (t.passagers?.length || 0);
            const isSelfConducteur = t.conducteur === username;
            const isConducteurToday = isConducteurCeJour(trajets, sens, j.iso, username);
            const isFull = placesRestantes <= 0;
            const isAlreadyPassager = isPassagerCeTrajet(t.passagers);

            const item = document.createElement('div');
            item.className = 'trajet-item';

            // Infos verticales, une ligne par info
            item.innerHTML = `
              <div id="heure">
                <div>heure :</div>
                <div><b>${t.heure}</b></div>
              </div>
              <div id="cond">
                <div>conducteur :</div>
                <div><b>${t.conducteur}</b></div>
              </div>
              <div id="place">
                <div>place :</div>
                <div><b>${placesRestantes}/${t.places}</b></div>
              </div>
              <div class="resa-btn-container"></div>
            `;

            const resaBtnContainer = item.querySelector('.resa-btn-container');
            if (isSelfConducteur) {
              resaBtnContainer.innerHTML = `<span style="color:#aaa;font-size:0.95em">(C'est vous)</span>`;
            } else if (isFull && !isAlreadyPassager) {
              resaBtnContainer.innerHTML = `<span style="color:#c22;font-size:0.95em;">Complet</span>`;
            } else if (isConducteurToday) {
              resaBtnContainer.innerHTML = `<span style="color:#aaa;font-size:0.95em;">Vous êtes conducteur sur ce créneau</span>`;
            } else if (isAlreadyPassager) {
              const btn = document.createElement('button');
              btn.textContent = "Se désinscrire";
              btn.onclick = async () => {
                await unreserveTrajet(j.iso, sens, t.conducteur);
                render();
              };
              resaBtnContainer.appendChild(btn);
            } else {
              const btn = document.createElement('button');
              btn.textContent = "Réserver";
              btn.onclick = async () => {
                await reserveTrajet(j.iso, sens, t.conducteur);
                render();
              };
              resaBtnContainer.appendChild(btn);
            }
            jourDiv.appendChild(item);
          });
        }
        listEl.appendChild(jourDiv);
      }
    }

    renderSens('aller', allerList);
    renderSens('retour', retourList);
  }

  driverBtn.onclick = () => { window.location.href = "/covoitealps/conducteur/"; };

  render();
});