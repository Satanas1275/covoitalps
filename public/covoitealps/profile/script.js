document.addEventListener("DOMContentLoaded", function () {
    // Récupérer le nom d'utilisateur depuis localStorage
    const username = localStorage.getItem("name");
    const usernameElement = document.getElementById("username");

    if (username) {
        usernameElement.textContent = `Bienvenue, ${username} !`;
    } else {
        usernameElement.textContent = "Non connecté";
    }

    // Gestion de la déconnexion
    const logoutButton = document.querySelector(".ProfileContainer a");
    logoutButton.addEventListener("click", function (event) {
        event.preventDefault(); // Empêche le lien de changer de page

        // Suppression des données de session
        localStorage.removeItem("token");
        localStorage.removeItem("name");

        // Recharger la page pour appliquer les changements
        location.reload();
    });
});
