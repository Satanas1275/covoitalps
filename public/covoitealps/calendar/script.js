document.addEventListener('DOMContentLoaded', async () => {
    // Récupérer le nom d'utilisateur depuis localStorage
    const username = localStorage.getItem('name');
  
    // Vérifier si le nom d'utilisateur est défini
    if (!username) {
      alert("Veuillez définir votre nom d'utilisateur dans la page appropriée.");
      window.location.href = "../profile/"; // Rediriger vers la page de profil (ou une autre page)
      return;
    }
  
    // Récupérer les éléments du DOM
    const allerDays = {
      Lundi: document.getElementById('LA'),
      Mardi: document.getElementById('MA'),
      Mercredi: document.getElementById('MeA'),
      Jeudi: document.getElementById('JA'),
      Vendredi: document.getElementById('VA'),
    };
    const allerTime = document.getElementById('TA');
    const retourDays = {
      Lundi: document.getElementById('LR'),
      Mardi: document.getElementById('MR'),
      Mercredi: document.getElementById('MmR'),
      Jeudi: document.getElementById('JR'),
      Vendredi: document.getElementById('VR'),
    };
    const retourTime = document.getElementById('TR');
    const saveBtn = document.getElementById('save-btn');
  
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
  
    // Charger les informations actuelles de l'utilisateur
    async function loadUserInfo() {
      const users = await fetchUsers();
      const user = users.find(u => u.username === username);
  
      if (user) {
        // Pré-remplir les jours et l'heure pour l'aller
        if (user.aller) {
          Object.keys(allerDays).forEach(day => {
            allerDays[day].checked = user.aller.days.includes(day);
          });
          allerTime.value = user.aller.time || '';
        }
  
        // Pré-remplir les jours et l'heure pour le retour
        if (user.retour) {
          Object.keys(retourDays).forEach(day => {
            retourDays[day].checked = user.retour.days.includes(day);
          });
          retourTime.value = user.retour.time || '';
        }
      }
    }
  
    // Sauvegarder les informations de l'utilisateur
    async function saveUserInfo() {
      const point = localStorage.getItem('chosenStop') || null;
  
      if (!point) {
        alert("Veuillez choisir un point dans la page des points.");
        return;
      }
  
      // Récupérer les jours sélectionnés pour l'aller
      const allerSelectedDays = Object.keys(allerDays).filter(day => allerDays[day].checked);
      const allerTimeValue = allerTime.value;
  
      // Récupérer les jours sélectionnés pour le retour
      const retourSelectedDays = Object.keys(retourDays).filter(day => retourDays[day].checked);
      const retourTimeValue = retourTime.value;
  
      // Créer l'objet utilisateur
      const userData = {
        username: username,
        point: point,
        aller: {
          days: allerSelectedDays,
          time: allerTimeValue,
        },
        retour: {
          days: retourSelectedDays,
          time: retourTimeValue,
        },
      };
  
      try {
        const response = await fetch('/covoitealps/api/users/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          alert(result.message);
          // Rediriger vers la page principale après sauvegarde
          window.location.href = "../";
        } else {
          alert(result.error);
        }
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des informations:', error);
        alert('Une erreur est survenue lors de la sauvegarde des informations.');
      }
    }
  
    // Charger les informations au démarrage
    await loadUserInfo();
  
    // Gérer le clic sur le bouton "Sauvegarder"
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // Empêcher le comportement par défaut du bouton
        await saveUserInfo();
      });
    }
  });