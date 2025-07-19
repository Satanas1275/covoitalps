document.addEventListener('DOMContentLoaded', function () {
    const pb = new PocketBase("https://rocknite-studio.alwaysdata.net");

    // Inscription
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const email = document.getElementById('email').value;
            const mot_de_passe = document.getElementById('mot_de_passe').value;
            const nom = document.getElementById('nom').value;

            try {
                await pb.collection('users').create({
                    email,
                    password: mot_de_passe,
                    passwordConfirm: mot_de_passe,
                    name: nom
                });

                alert('Utilisateur créé avec succès.');
                window.location.href = '/covoitealps/login/login.html';
            } catch (error) {
                console.error("Erreur lors de l'inscription:", error);
                if (error.message.includes('Failed to fetch')) {
                    alert('Erreur de connexion au serveur. Vérifiez l\'URL, le réseau ou les restrictions CORS.');
                } else {
                    alert(`Erreur: ${error.message}`);
                }
            }
        });
    }

    // Connexion
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const email = document.getElementById('email').value;
            const mot_de_passe = document.getElementById('mot_de_passe').value;

            try {
                const authData = await pb.collection('users').authWithPassword(email, mot_de_passe);
                localStorage.setItem('token', pb.authStore.token);
                localStorage.setItem('name', authData.record.name);
                window.location.href = '../../point';
            } catch (error) {
                console.error('Erreur lors de la connexion:', error);
                alert(`Erreur lors de la connexion: ${error.message}`);
            }
        });
    }

    // Page protégée
    const messageElement = document.getElementById('message');
    const logoutButton = document.getElementById('logout-button');

    if (messageElement) {
        const token = localStorage.getItem('token');

        if (!token) {
            messageElement.textContent = 'Aucun token trouvé. Veuillez vous connecter.';
            return;
        }

        try {
            pb.authStore.save(token, null);
        } catch (err) {
            messageElement.textContent = 'Token invalide.';
            return;
        }

        (async function () {
            try {
                const user = await pb.collection('users').authRefresh();
                messageElement.textContent = `Bienvenue sur la page protégée ! (Connecté en tant que ${localStorage.getItem('name')})`;
            } catch (error) {
                console.error('Erreur lors de l\'accès à la page protégée:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('name');
                messageElement.textContent = 'Erreur d\'accès. Token supprimé.';
                window.location.href = '/covoitealps/profile/login/index.html';
            }
        })();
    }

    // Déconnexion
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            pb.authStore.clear();
            localStorage.removeItem('token');
            localStorage.removeItem('name');
            alert('Déconnecté.');
            window.location.href = '/covoitealps/login/login.html';
        });
    }
});