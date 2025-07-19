document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "https://rocknite-studio.alwaysdata.net/covoitealps/profile/login";
    }
});
