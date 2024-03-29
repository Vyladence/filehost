(function () {
    form = document.getElementById("login_form")

    form.onsubmit = async function(event) {
        event.preventDefault();

        var formData = new FormData(form);
        var formJson = Object.fromEntries(formData);

        fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            redirect: "follow",
            body: JSON.stringify(formJson)
        }).then(response => {
            if (response.status == 200) {
                location.href = response.url
            } else  {
                document.getElementById("invalid-login-warning-text").innerHTML = "Invalid Username or Password"
            } 
        })
    }
})();

function resetWarning() {
    document.getElementById("invalid-login-warning-text").innerHTML = ""
}