document.addEventListener('DOMContentLoaded', async () => {
    // --- Variables globales ---
    const username = localStorage.getItem('name');
    if (!username) {
        alert("Veuillez définir votre nom d'utilisateur dans la page appropriée.");
        window.location.href = "../profile/";
        return;
    }

    const calendarEl = document.getElementById('calendar');
    const trajetListEl = document.getElementById('trajet-list');
    const saveBtn = document.getElementById('save-btn');
    const modal = document.getElementById('trajet-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const trajetForm = document.getElementById('trajet-form');
    const allerCheck = document.getElementById('aller-check');
    const retourCheck = document.getElementById('retour-check');
    const allerTime = document.getElementById('aller-time');
    const retourTime = document.getElementById('retour-time');
    const allerPlaces = document.getElementById('aller-places');
    const retourPlaces = document.getElementById('retour-places');
    const dateTitle = document.getElementById('selected-date-title');
    const driverBtn = document.getElementById('driver-btn');
    const trajetHeader = document.getElementById('trajet-header');

    // userTrajets au format { "YYYY-MM-DD": { aller: {heure, places, passagers}, retour: {heure, places, passagers} } }
    let userTrajets = {};
    let selectedDate = null;

    // --- Initialisation du header avec le point de covoiturage ---
    function updateTrajetHeader() {
        const point = localStorage.getItem('chosenStop');
        trajetHeader.textContent = "Mes trajets pour : " + (point ? point : "(aucun point sélectionné)");
    }
    updateTrajetHeader();

    // --- Récupère les trajets depuis le backend (ou localStorage si besoin) ---
    async function fetchUserTrajets() {
        try {
            const res = await fetch('/covoitealps/api/usertrajets?username=' + encodeURIComponent(username));
            if (res.ok) return await res.json();
            return {};
        } catch (e) {
            console.error('Erreur fetch trajets:', e);
            return {};
        }
    }
    // --- Sauvegarde les trajets ---
    async function saveUserTrajets() {
        const point = localStorage.getItem('chosenStop');
        if (!point) {
            alert("Veuillez choisir un point de covoiturage dans la page dédiée !");
            return false;
        }
        try {
            const res = await fetch('/covoitealps/api/usertrajets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    point,
                    trajets: userTrajets
                })
            });
            const result = await res.json();
            // >>> AJOUT ICI : message custom si présence de l'erreur spécifique du backend
            if (!res.ok) {
                if (
                result.error &&
                result.error.startsWith("Impossible de changer l'heure")
                ) {
                    alert("Ooops ! On dirait que des personnes sont inscrites sur ce créneau ! Vos modifications n'ont donc pas été prises en compte...");
                } else {
                    alert(result.error || 'Erreur sauvegarde !');
                }
                return false;
            }
            alert(result.message || 'Enregistré !');
            return true;
        } catch (e) {
            alert('Erreur réseau sauvegarde');
            return false;
        }
    }

    // --- Affiche le calendrier du mois courant ---
    function renderCalendar() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = new Date(year, month, 1);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lundi=0
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        calendarEl.innerHTML = '';

        // Header
        dayNames.forEach(day => {
            const hd = document.createElement('div');
            hd.className = 'day-header';
            hd.textContent = day;
            calendarEl.appendChild(hd);
        });

        // Cases vides avant le 1er du mois
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            calendarEl.appendChild(empty);
        }

        // Jours du mois
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            if (dateStr === today.toISOString().slice(0,10)) cell.classList.add('today');
            if (userTrajets[dateStr]) cell.classList.add('has-trajet');
            cell.textContent = d;
            cell.addEventListener('click', () => openTrajetModal(dateStr));
            calendarEl.appendChild(cell);
        }
    }

    // --- Affiche la liste des trajets réservés ---
    function renderTrajetList() {
        trajetListEl.innerHTML = '';
        const entries = Object.entries(userTrajets).sort();
        if (entries.length === 0) {
            trajetListEl.innerHTML = "<em>Aucun trajet enregistré ce mois-ci.</em>";
            return;
        }
        for (const [date, traj] of entries) {
            const item = document.createElement('div');
            item.className = 'trajet-item';
            let desc = `<span><b>${date}</b></span>`;
            if (traj.aller) {
                desc += `<span>Aller: <b>${traj.aller.heure}</b> (${traj.aller.places || 4} places)</span>`;
            }
            if (traj.retour) {
                desc += `<span>Retour: <b>${traj.retour.heure}</b> (${traj.retour.places || 4} places)</span>`;
            }
            item.innerHTML = `<div class="trajet-desc">${desc}</div>`;
            const btn = document.createElement('button');
            btn.textContent = 'Suppr.';
            btn.onclick = () => { delete userTrajets[date]; renderCalendar(); renderTrajetList(); };
            item.appendChild(btn);
            trajetListEl.appendChild(item);
        }
    }

    // --- Modal : saisir ALLER/RETOUR pour une date ---
    function openTrajetModal(dateStr) {
        selectedDate = dateStr;
        dateTitle.textContent = `Trajet du ${dateStr}`;
        // Pré-remplir si existant
        const traj = userTrajets[dateStr] || {};
        // ALLER
        allerCheck.checked = Boolean(traj.aller);
        allerTime.value = traj.aller ? traj.aller.heure : '';
        allerPlaces.value = traj.aller ? (traj.aller.places || 4) : 4;
        allerTime.style.display = allerCheck.checked ? '' : 'none';
        allerPlaces.style.display = allerCheck.checked ? '' : 'none';
        // RETOUR
        retourCheck.checked = Boolean(traj.retour);
        retourTime.value = traj.retour ? traj.retour.heure : '';
        retourPlaces.value = traj.retour ? (traj.retour.places || 4) : 4;
        retourTime.style.display = retourCheck.checked ? '' : 'none';
        retourPlaces.style.display = retourCheck.checked ? '' : 'none';
        modal.style.display = 'flex';
    }
    closeModalBtn.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    allerCheck.onchange = () => {
        allerTime.style.display = allerCheck.checked ? '' : 'none';
        allerPlaces.style.display = allerCheck.checked ? '' : 'none';
    };
    retourCheck.onchange = () => {
        retourTime.style.display = retourCheck.checked ? '' : 'none';
        retourPlaces.style.display = retourCheck.checked ? '' : 'none';
    };

    trajetForm.onsubmit = (e) => {
        e.preventDefault();
        // On stocke chaque sens comme un objet {heure, places, passagers: []}
        const allerVal = allerCheck.checked ? allerTime.value : null;
        const allerNb = allerCheck.checked ? parseInt(allerPlaces.value, 10) : null;
        const retourVal = retourCheck.checked ? retourTime.value : null;
        const retourNb = retourCheck.checked ? parseInt(retourPlaces.value, 10) : null;
        if (!allerVal && !retourVal) {
            delete userTrajets[selectedDate];
        } else {
            userTrajets[selectedDate] = {};
            if (allerVal) userTrajets[selectedDate].aller = { heure: allerVal, places: allerNb, passagers: [] };
            if (retourVal) userTrajets[selectedDate].retour = { heure: retourVal, places: retourNb, passagers: [] };
        }
        modal.style.display = 'none';
        renderCalendar();
        renderTrajetList();
    };

    // --- Bouton conducteur ---
    driverBtn.onclick = () => { window.location.href = "/covoitealps/conducteur/"; };

    // --- Sauvegarde des infos ---
    saveBtn.onclick = async () => {
        if (await saveUserTrajets()) {
            // window.location.href = "../"; // désactive la redirection pour rester sur le calendrier
        }
    };

    // --- Chargement initial ---
    async function init() {
        // Structure attendue :
        // { "YYYY-MM-DD": { aller: {heure, places, passagers}, retour: {heure, places, passagers} } }
        const trajets = await fetchUserTrajets() || {};
        // (Conversion rétro-compatibilité si besoin)
        userTrajets = {};
        for (const [date, t] of Object.entries(trajets)) {
            userTrajets[date] = {};
            if (t.aller) {
                userTrajets[date].aller = typeof t.aller === 'object'
                  ? { heure: t.aller.heure, places: t.aller.places || 4, passagers: t.aller.passagers || [] }
                  : { heure: t.aller, places: 4, passagers: [] };
            }
            if (t.retour) {
                userTrajets[date].retour = typeof t.retour === 'object'
                  ? { heure: t.retour.heure, places: t.retour.places || 4, passagers: t.retour.passagers || [] }
                  : { heure: t.retour, places: 4, passagers: [] };
            }
        }
        renderCalendar();
        renderTrajetList();
    }
    init();
});