function selectFile (element) {
    currentSelected = document.getElementById("selectedFile")
    filenameInput = document.getElementById("rename_file_input")
    directoryInput = document.getElementById("file_directory_input")

    if (currentSelected) {
        currentSelected.id = ""
    }
    
    if (currentSelected == element) {
        element.id = ""
        filenameInput.value = ""
        directoryInput.value = ""
        toggleControlPanel(false)
    } else {
        element.id = "selectedFile"
        filenameInput.value = element.children[1].children[0].innerHTML.trim()
        directoryInput.value = document.getElementById("fileTable").dataset.directory
        
        if (element.children[1].children[0].innerHTML.trim() == "&lt;--") {
            toggleControlPanel(false)
        } else {
            toggleControlPanel(true)
        }
    }
}

function toggleControlPanel(state) {
    controlPanel = document.getElementById("control_panel")
    if (state) {
        controlPanel.style.width = "430px"
        controlPanel.style.borderwidth = ""
        controlPanel.style.marginRight = "10px"
    } else {
        controlPanel.style.width = "0px"
        controlPanel.style.borderwidth = "0px"
        controlPanel.style.marginRight = "0px"
    }
}

function moveFile(updateButton) {
    selectedFile = document.getElementById("selectedFile")

    if (!selectedFile) {
        oldText = updateButton.textContent
        updateButton.textContent = "Select a file first"
		setTimeout(() => {updateButton.textContent = oldText}, 2000)
        return
    }

    oldDir = document.getElementById("fileTable").dataset.directory
    newDir = document.getElementById("file_directory_input").value

    oldFilename = selectedFile.children[1].children[0].innerHTML.trim()
    newFilename = document.getElementById("rename_file_input").value.trim()

    // Change File Name mode
    if (oldFilename == newFilename && updateButton.innerHTML == "Update Filename" ) {
        updateButton.textContent = "The file already has this name"
		setTimeout(() => {updateButton.textContent = "Update Filename"}, 2000)
        return
    }

    // Change File Path mode
    if (oldDir == newDir && updateButton.innerHTML == "Move File" ) {
        updateButton.textContent = "The file is already located here"
		setTimeout(() => {updateButton.textContent = "Move File"}, 2000)
        return
    }

    oldFileExtension = oldFilename.split('.').pop()
    newFileExtension = newFilename.split('.').pop()

	if (newFileExtension == oldFileExtension) {
		sendReq()
	} else {
		if (updateButton.textContent == "Are you sure? (Click to confirm)") {
			sendReq()
		} else {
			updateButton.textContent = "Are you sure? (Click to confirm)"
            setTimeout(() => {updateButton.textContent = "Update File Name"}, 4000)
		}
	}

    async function sendReq () {
        dir = document.getElementById("fileTable").dataset.directory
		data = {
			"oldPath": rewritePath(oldDir) + "/" + oldFilename,
			"newPath": rewritePath(newDir) + "/" + newFilename
		}
	
		fetch("/movefile", {
			method: 'POST',
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'same-origin',
			redirect: 'follow',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(data)
		})
		.then(() => { location.reload() })
    }    
}

function singleUse(updateButton) {
    selectedFile = document.getElementById("selectedFile")

    if (!selectedFile) {
        oldText = updateButton.textContent
        updateButton.textContent = "Select a file first"
		setTimeout(() => {updateButton.textContent = oldText}, 2000)
        return
    }
    
    if (selectedFile.children[0].innerHTML.trim()) {
        oldText = updateButton.textContent
        updateButton.textContent = "Selected item cannot be a directory"
		setTimeout(() => {updateButton.textContent = oldText}, 2000)
        return
    }

    directory = document.getElementById("fileTable").dataset.directory
    filename = selectedFile.children[1].children[0].innerHTML.trim()

    sendReq()

    async function sendReq () {
		data = {
            uses: 1,
            type: "DOWNLOAD_FILE",
            path: directory + "/" + filename
		}
	
        fetch("/createtemplink", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            redirect: "follow",
            body: JSON.stringify(data)
        })
        .then(response => response.json().then(json => {
            oldText = updateButton.textContent
            if (response.status == 200) {
                copyText(location.origin + "/" + json.message).then(function() {
                    updateButton.textContent = "Success"
                })
                .catch(function(rej) {
                    updateButton.textContent = "Copy link failed"  
                });
            } else  {
                updateButton.textContent = "Server Error"
            }
            setTimeout(() => {updateButton.textContent = oldText}, 2000)
        }))
    }    
}

function copyText (text) {
	return new Promise((resolve, reject) => {
		navigator.clipboard.writeText(text).then(
			resolve, reject
		)
	})
}

function rewritePath(path = "") {
    if (path == "" || path == "/") return ""

    // if first character is not slash, add it
    if (path[0] != "/") {
        path = "/" + path
    }
    
    // if last character is slash, remove it
    if (path[path.length - 1] == "/") {
        path = path.slice(0, path.length - 1)
    }

    //remove diractory traversal attempts
    filteredPath = path.replace(/(\.{2,})/gi, "")

    // remove consecutive slashes
    filteredPath = filteredPath.replace(/(\/)(?=\1)/gi, "");

    changed = path != filteredPath

    if (changed) {
        return rewritePath(filteredPath)
    }

    return filteredPath
}

function deleteFilePopup() {
    popup = document.getElementById("delete_popup")
    popup.style.display = ""
}

function deleteSelectedFile() {
    selectedFile = document.getElementById("selectedFile")

    currentDir = document.getElementById("fileTable").dataset.directory
    filename = selectedFile.children[1].children[0].innerHTML.trim()

    filePath = currentDir + "/" + filename
    
    fetch("/deletefile", {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({"filePath": filePath})
    })
    .then(response => { 
        if (response.status == 200) location.reload()
    })
}

class UrlParams {
    constructor(search) {
       this.qs = decodeURIComponent(search || location.search).substr(1);
       this.params = {};
       this.parseQueryString();
    }
    parseQueryString() {
       this.qs.split('&').reduce((a, b) => {
         let [key, val] = b.split('=');
         a[key] = val
         return a;
       }, this.params);
    }
    get(key) {
       return this.params[key];
    }
    set(key, value) {
        this.params[key] = value
    }
    toString() {
        var outputString = ""
        for (var key in this.params) {
            outputString += key + "=" + this.params[key]

            var keys = Object.keys(this.params)
            if (keys.indexOf(key) != keys.length - 1) outputString += "&"
        }
        return outputString
    }
}

window.onload = () => {
    //https://stackoverflow.com/questions/5546207/how-to-set-querystring-with-javascript
    const path = window.location.pathname;
    const params = new UrlParams()
    const hash = window.location.hash;

    if (params.get("path")) {
        params.set("path", rewritePath(params.get("path")))
        window.history.replaceState({}, '', `${path}?${params}${hash}`);
    }
}