function modifyDataEntries(element) {
	selectedType = element.selectedOptions[0].value
	optionList = element.options

	for (x in optionList) {
		if (typeof optionList[x] != "object") continue;
		document.getElementById(optionList[x].value).style.display = "none"
	}

	document.getElementById(selectedType).style.display = ""
}

function linkGeneratorPopup() {
	popup = document.getElementById("link_generator")
	popup.style.display = ""
}

function copyLink (element) {
	link = location.origin + '/' + element.parentElement.parentElement.dataset.key

	copyText(link).then(function() {
		element.innerHTML = "Copied"
	})
	.catch(function(rej) {
		element.innerHTML = "Error"
	});

	setTimeout(() => { element.innerHTML="Copy Link"; }, 2000)
}

function copyText (text) {
	return new Promise((resolve, reject) => {
		navigator.clipboard.writeText(text).then(
			resolve, reject
		)
	})
}

function createNewLink() {
	form = document.getElementById("link_generator_form")
	var formData = new FormData(form);
	var formJson = Object.fromEntries(formData);
	formJson.type = "CREATE_USER"
	formJson.uses = 1

	console.log(formJson)

	fetch("/createtemplink", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json"
		},
		redirect: "follow",
		body: JSON.stringify(formJson)
	})
	.then(response => response.json()
	.then(json => {
		if (response.status == 200) {
			copyText(location.origin + "/" + json.message)
			location.reload()
		} else  {
			document.getElementById("invalid-login-warning-text").innerHTML = json.message
		}
	}))
}

function deleteUserPopup(text) {
	console.log(text)
	popup = document.getElementById("delete_popup")
	popup.dataset.user = text
    popup.style.display = ""
}

function deleteUser(user) {
	fetch("/deleteuser", {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({"user": user})
    })
    .then(response => { 
        if (response.status == 200) location.reload()
    })
}

userTable = document.getElementById("userTable").children
for (entry in [...Array(userTable["length"]).keys()]) {
	dateCreated = userTable[entry].querySelector("#date_created")
	created_date = new Date(Number(dateCreated.innerHTML.trim()))
	dateCreated.innerHTML = created_date.toLocaleString()

	lastLoggedIn = userTable[entry].querySelector("#last_logged_in")
	login_date = new Date(Number(lastLoggedIn.innerHTML.trim()))
	lastLoggedIn.innerHTML = login_date.toLocaleString()
}