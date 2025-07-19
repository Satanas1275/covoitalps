document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('name');
    if (!username) {
        alert("Veuillez définir votre nom d'utilisateur dans la page appropriée.");
        window.location.href = "/covoitealps/profile/";
        return;
    }

    const conducteurList = document.getElementById('conducteur-list');
    const conducteurHeader = document.getElementById('conducteur-header');

    // Récupère TOUS les trajets utilisateurs
    async function fetchAllUserTrajets() {
        try {
            const res = await fetch('/covoitealps/api/usertrajets/all');
            if (res.ok) {
                return await res.json();
            }
            return {};
        } catch (e) {
            return {};
        }
    }

    // Affiche les passagers à prendre pour chaque jour où tu es conducteur
    async function render() {
        conducteurList.innerHTML = "Chargement…";
        const allUserTrajets = await fetchAllUserTrajets();
        let myTrajets = {};
        if (allUserTrajets[username]) {
            myTrajets = allUserTrajets[username].trajets || {};
        }

        // Pour chaque jour où tu es conducteur
        const jours = Object.keys(myTrajets).sort();
        if (jours.length === 0) {
            conducteurList.innerHTML = "<em>Tu n'es conducteur sur aucun trajet ce mois-ci.</em>";
            return;
        }

        conducteurList.innerHTML = "";
        for (const date of jours) {
            const traj = myTrajets[date];
            const div = document.createElement('div');
            div.className = "conducteur-jour";

            let html = `<div class="conducteur-date"><b>${date}</b></div>`;
            // ALLER
            if (traj.aller) {
                html += `<div class="conducteur-sens"><u>ALLER</u> (${traj.aller.heure})</div>`;
                if (traj.aller.passagers && traj.aller.passagers.length > 0) {
                    html += `<ul class="conducteur-passagers">`;
                    for (const p of traj.aller.passagers) {
                        html += `<li>${p}</li>`;
                    }
                    html += `</ul>`;
                } else {
                    html += `<div class="conducteur-nopass">Aucun passager pour l'aller.</div>`;
                }
            }
            // RETOUR
            if (traj.retour) {
                html += `<div class="conducteur-sens"><u>RETOUR</u> (${traj.retour.heure})</div>`;
                if (traj.retour.passagers && traj.retour.passagers.length > 0) {
                    html += `<ul class="conducteur-passagers">`;
                    for (const p of traj.retour.passagers) {
                        html += `<li>${p}</li>`;
                    }
                    html += `</ul>`;
                } else {
                    html += `<div class="conducteur-nopass">Aucun passager pour le retour.</div>`;
                }
            }
            div.innerHTML = html;
            conducteurList.appendChild(div);
        }
    }

    render();
});