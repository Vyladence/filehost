checkTextOverflow("title")
function checkTextOverflow(element) {
    container = document.getElementById(element);

    while (container.scrollWidth > 190) {
        currentFontSize = container.style.fontSize.replace(/[^0-9]+/, '')
        container.style.fontSize = `${currentFontSize - 1}px`;
    }
}

function toggleUserPopup() {
    popup = document.getElementById("user_popup")
    if (popup.style.display == "none") {
        popup.style.display = ""
    } else {
        popup.style.display = "none"
    }
}

window.onclick = function(e) {
    popup = document.getElementById("user_popup")

    if (!e.target.matches("#user_popup") && popup.style.display == "" && !e.target.matches(".user_container")) {
        popup.style.display = "none";
        e.preventDefault(); // Prevents propagation
    }
}

function logout() {
    fetch("/logout", {
        method: 'POST',
        credentials: 'same-origin',
    }).then(() => {
        document.cookie = "SID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
        location.reload()
    })
}