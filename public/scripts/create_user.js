(function () {
    form = document.getElementById("login_form")

    form.onsubmit = async function(event) {
        event.preventDefault();

        var formData = new FormData(form);
        var formJson = Object.fromEntries(formData);

        if (formJson["password"] != formJson["confirmedPassword"]) {
            document.getElementById("invalid-login-warning-text").innerHTML = "Passwords do not match"
            return
        }

        fetch("", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            redirect: "follow",
            body: JSON.stringify(formJson)
        })
        .then(response => {
            if (response.status == 200) {
                location.href = response.url
            } else  {
                response.json().then(json => {
                    console.log(json)
                    document.getElementById("invalid-login-warning-text").innerHTML = json.message                
                })
            }
        })
    }
})();


function checkPassword(value) {
    
}

function resetWarning() {
    document.getElementById("invalid-login-warning-text").innerHTML = ""
}