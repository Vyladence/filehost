function changeText(caller) {
    filename = caller.files[0].name
    filesize = caller.files[0].size
	filePlaceholder = document.getElementById("file_selector_button").children[0]
    fileObj = document.getElementById("file_selector_button").children[1]
    filenameInput = document.getElementById("filenameInput")

	if(filesize > 5 * 1024 * 1024 * 1024){ // 5 GB
		alert("File is too big!");
	} else {
        fileObj.children[0].innerHTML = filename
        filenameInput.value = filename
        fileObj.children[1].innerHTML = byteNumberToName(filesize)
        
		filePlaceholder.style.display = "none"
        fileObj.style.display = ""
	}
}

function byteNumberToName(bytes) {
	if (bytes/(1024*1024*1024) > 1) {
		return (bytes/(1024*1024*1024)).toFixed(1) + "GB"
	} else if (bytes/(1024*1024) > 1) {
		return (bytes/(1024*1024)).toFixed(1) + "MB"
	} else if (bytes/(1024) > 1) {
		return (bytes/(1024)).toFixed(1) + "KB"
	} else {
		return bytes + "B"
	}
}

function copyText (text) {
	return new Promise((resolve, reject) => {
		navigator.clipboard.writeText(text).then(
			resolve, reject
		)
	})
}

(function() {
    var form = document.getElementById('upload_form');
    var fileSelect = document.getElementById('file-input');
    var newFilename = document.getElementById("filenameInput")
    var destDirectory = document.getElementById("destinationDirInput")

    form.onsubmit = function(event) {
        event.preventDefault();

        // Get the files from the input
        var files = fileSelect.files;

        // Create a FormData object.
        var formData = new FormData();

        //Grab only one file since this script disallows multiple file uploads.
        var file = files[0];

        if (file.size >= 500 * 1024 * 1024) {
            alert("File is too big!");
            return;
        }

         // Add the file to the AJAX request.
        formData.append('file', file);
		formData.append('newFilename', newFilename.value)
        formData.append("destination", destDirectory.value)

        // Set up the request.
        var xhr = new XMLHttpRequest();

        // Set up a handler for when the task for the request is complete.
        xhr.onloadend = function() {
			if (xhr.status == 200) {
                console.log(xhr.response)
                document.getElementById("copy_link_button").dataset.newLink = location.origin + "/file" + JSON.parse(xhr.responseText).message
                document.getElementById("uploaded_popup").style.display = ""
                document.getElementById("stylized_upload_button").children[0].innerHTML = "Done!"
			} else {
				console.log("error " + this.status);
			}
		};

		xhr.upload.onprogress = function(event) {
			percentDecimal = event.loaded / event.total
			percentage = Math.floor(percentDecimal * 100)
			
			document.getElementById("upload_progress").style.width = (percentDecimal * 600) + "px"
            document.getElementById("stylized_upload_button").children[0].innerHTML = percentage + "%"
            

            if (percentage == 100) {
                document.getElementById("stylized_upload_button").children[0].innerHTML = "Processing..."
            }
		};


        // Open the connection.
        xhr.open('POST', '/upload')
        xhr.setRequestHeader("Accept", "application/json")

        document.getElementById("stylized_upload_button").style.width = "100%"

        // Send the data.
        xhr.send(formData);
    }
})();


(function() {
    fileInput = document.getElementById("file_selector_button")

	fileInput.ondragover = fileInput.ondragenter = function(evt) {
		evt.preventDefault();

		fileInput.style.background = "#154015";
		fileInput.style.outlineColor = "#0f0";
	};

	fileInput.ondragleave = function(evt) {
		evt.preventDefault();

		fileInput.style.background = "";
		fileInput.style.outlineColor = "";
	};
	  
	fileInput.ondrop = function(evt) {
		evt.preventDefault();

		fileInput.style.background = "";
		fileInput.style.outlineColor = "";

		document.getElementById("file-input").files = evt.dataTransfer.files;
		changeText(document.getElementById("file-input"))
	};
})()