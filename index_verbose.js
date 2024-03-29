const path = require('path')
const fs = require('fs');
const fileUpload = require("express-fileupload");
const express = require('express')
const app = express();

app.listen(process.env['PORT'] || 8080);
console.log("Running on port " + (process.env['PORT'] || 8080))

app.set('view engine', 'ejs');
app.set('trust proxy', 'loopback')

// TODO: Write own fileupload middleware, this one's fucking broken
/* app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : 'tmp',
    debug: true,
})); */

app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(express.static('public'))

fs.readdirSync("./default_data").forEach((file) => {
    if (!fs.existsSync("./data/" + file)) {
        fs.cpSync("./default_data/" + file, "./data/" + file, {recursive: true})
    }
})

const db = new require('better-sqlite3')('./data/filehost.db');
SITE_NAME = require("./data/config.json")["site_name"]
const Users = require('./user_management')(db)

app.use( (req, res, next) => {
    res.fileResponse = (file, cb) => {
        console.log("fileResponse called")
        if ( file == undefined || !fs.existsSync(`./files/${file}`)) {
            console.log("file not found, replying 404")
            res.reply(404)
            console.log("Absent file requested - " + file)
            return
        }

        console.log("file found, continuing")
        directViewFileTypes = [ "png", "jpg", "jpeg", "webp", "webm" ]
        extension = file.split('.').pop()
    
        options = { root: path.join(__dirname) };
        
        if (directViewFileTypes.indexOf(extension) > -1) {
            res.sendFile(`./files/${file}`, options)
        } else {
            res.download(`./files/${file}`, options)
        }
    
        res.on('finish', function() {
            console.log("File downloaded - " + file)
            if (cb && typeof cb === "function") { cb() }
        });
    }
    next()
})

app.use( (req, res, next) => {
    res.reply = (resCode, message) => {
        var { STATUS_CODES } = require('http');
    
        res.status(resCode)
        
        data = { status: resCode, statusText: STATUS_CODES[resCode] }
        if (message) data["message"] = message
    
        switch (req.accepts(["html", "json"])) {
            case "html":
                res.render(`errorStatusPage`, data)
                break
            case "json":
                res.json(data).end()
                break
            default:
                res.type('txt').send(JSON.stringify(data))
        }
    }
    next()
})

app.use( (req, res, next) => {
    console.log("parsing request cookies..")
    if (!req.headers.cookie) {
        console.log("no cookies found")
        req.parsedCookies = {};
    } else {
        cookieList = req.headers.cookie.split('; ');
        var result = {};
    
        console.log("open parse loop")
        for (const cookie of cookieList) {
            var cur = cookie.split('=');
            result[cur[0]] = cur[1];
        }
        console.log("parse loop complete")
    
        req.parsedCookies = result;
    }

    next()
})

function humanFileSize(size) {
    if (size == 0) { return "" }
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
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

    // remove directory traversal attempts
    filteredPath = path.replace(/(\.{2,})/gi, "")

    // remove consecutive slashes
    filteredPath = filteredPath.replace(/(\/)(?=\1)/gi, "");

    return filteredPath
}

// TODO: rewrite this?
function customReadDir(dir = "") {
    console.log("reading directory..")
    if (!fs.existsSync(`./files${dir}`)) {
        return {"Directory Not Found": {}}
    }
    fileList = fs.readdirSync(`./files${dir}`)

    fileInfo = {}
    dirInfo = {}

    if (dir != "") {
        dirInfo["<--"] = {isDirectory: true, isBackButton: true}
    }

    for (file in fileList) {
        stats = fs.lstatSync(`./files${data.currentPath}/${fileList[file]}`)
        
        if (stats.isDirectory()) {
            dirInfo[fileList[file]] = {
                isDirectory: true,
            }
        } else {
            fileInfo[fileList[file]] = {
                isDirectory: false,
                size: humanFileSize(stats.size),
            }
        }
    }

    fileInfo = Object.keys(fileInfo).sort().reduce(
        (obj, key) => { 
            obj[key] = fileInfo[key]; 
            return obj;
        }, 
        {}
    );

    dirInfo = Object.keys(dirInfo).sort().reduce(
        (obj, key) => { 
          obj[key] = dirInfo[key]; 
          return obj;
        }, 
        {}
    );

    console.log("directory read")
    return { ...dirInfo, ...fileInfo }
}

function restrict(req, res, next) {
    console.log("checking for valid session..")
    session = Users.validSession(req)

    // If session is found, allow access
    if (session) { console.log("session found, allowing access"); next(); return }

    // If session is not found and method is GET, redirect to login page
    if (req.method == "GET") { console.log("session not found, redirecting to login page"); res.redirect("/login"); return }
    
    // Reply with a 401 to all other requests
    console.log("session not found, replying 401"); 
    res.reply(401) 
    return
}

app.get(["/login"], (req, res) => {
    // if user is already logged in, redirect to admin page
    if (Users.validSession(req)) {
        res.redirect("/admin")
        return
    }

    res.render("login")
})

app.post(["/login"], (req, res) => {
    username = req.body['username']
    password = req.body['password']

    if (!(username && password)) {
        res.reply(400)
        return
    }

    output = Users.login(username, password, req.ip, (req.headers['user-agent'] || ""))

    switch (output) {
        case "UNKNOWN_USERNAME":
        case "INCORRECT_PASSWORD":
            res.reply(403)
            break
        default:
            res.cookie("SID", newSID, { 
                maxAge: 1000 * 60 * 60 * 24 * 7, 
                sameSite: "none", 
                secure: true, 
                httpOnly: true,
            }).reply(200)
            break
    }
})

app.post(["/logout"], (req, res) => {
    sid = req.parsedCookies["SID"]
    Users.logout(sid)
    res.reply(200)
})

app.get("/admin(/:page)?", restrict, (req, res) => {
    console.log("admin panel requested")
    defaultPage = "manage_files"

    data = {
        siteName: SITE_NAME,
        selectedPage: (req.params.page ? req.params.page : defaultPage),
        user: session.user,
    }

    if (!fs.existsSync(`./views/partials/${data.selectedPage}.ejs`)) {
        data.selectedPage = defaultPage
    }

    console.log("constructing page data")
    switch (data.selectedPage) {
        case "manage_files": {
            data.currentPath = rewritePath(req.query["path"])
            data.fileInfo = customReadDir(data.currentPath)
        } break;
        case "temp_links": {
            data.keyList = Keys.getKeyList()
        }
    }
    console.log("data constructed")

    console.log("rendering admin page")
    res.render("admin", data)
    console.log("page rendered")
})

app.post(["/movefile"], restrict, async (req, res) => {
	oldPath = rewritePath(req.body["oldPath"])
	newPath = rewritePath(req.body["newPath"])
        
    if (!(oldPath && newPath)) {
        res.reply(400)
        return
    }

	if (!fs.existsSync(`./files/${oldPath}`)) {
        res.reply(404)
        return
    }

    oldPathArr = oldPath.split("/").slice(0,-1)
    newPathArr = newPath.split("/").slice(0,-1)
    
    if (oldPathArr != newPathArr) {
        for(x in newPathArr) {
            workingDir = newPathArr.slice(0, x+1).join("/")

            if (!fs.existsSync("./files/" + workingDir)) {
                fs.mkdirSync("./files/" + workingDir)
            }
        }
    }

	fs.renameSync(`./files/${oldPath}`,`./files/${newPath}`)

	res.reply(200)
});

app.post(["/deletefile"], restrict, async (req, res) => {
	filePath = rewritePath(req.body["filePath"])

    if (!(filePath)) {
        res.reply(400)
        return
    }

	if (!fs.existsSync(`./files${filePath}`)) {
        res.reply(404)
        return
    }    
		
    fs.rmSync(`./files${filePath}`, { recursive: true, force: true })

	res.reply(200)
});

app.post(["/createtemplink"], restrict, async (req, res) => {
	type = req.body.type
    uses = req.body.uses

    if (type == "CREATE_USER") {
        if (!req.body.permission_level) {
            res.reply(400)
            return
        }

        data = { "permission_level": req.body.permission_level }
    } else if (type == "DOWNLOAD_FILE") {
        if (!req.body.path) {
            res.reply(400)
            return
        }

        data = { "targetPath": req.body.path }
    }

    if (!(type && uses && data)) {
        res.reply(400)
        return
    }

    // Key type is valid
	if (Keys.TYPES.indexOf(type) == -1) {
        res.reply(400)
        return
    }

    // Number of uses between 1 and 100
    if (uses < 1 || uses > 100) {
        res.reply(400)
        return
    }

    newKey = Keys.createEphemeralKey(type, uses, data)

    if (!newKey) {
        res.reply(500)
    }

	res.reply(200, newKey)
});

app.post(["/deletetemplink"], restrict, async (req, res) => {
	key = req.body.key
    
    if (!key) {
        res.reply(400)
        return;
    }

    Keys.deleteEphemeralKey(key)

    res.reply(200)
});

// TODO: add error checking and handling
app.post(["/upload"], restrict, (req, res) => {
    /* if (!req.files) {
        res.reply(400, "No file")
        return
    }

    if (req.files.file.truncated) {
        res.reply(400, "File too large")
        return
    }

    console.log(req.files.file)

    destination = __dirname + "/files" + rewritePath(req.body.destination)
    newFilename = rewritePath(req.body.newFilename)
    
    fs.rename(req.files.file.tempFilePath, destination + newFilename, () => {})
     */
    res.reply(200)
})

// ---------- Ephemeral Routes ----------
const Keys = require('./ephemeral_keys')(db)

app.get(["/:key"], (req, res, next) => {
    key = Keys.checkEphemeralKey(req.params.key)

    if (!key) {
        next()
        return
    }

    switch (key.type) {
    case "DOWNLOAD_FILE":
        res.fileResponse(key.data.targetPath, Keys.useEphemeralKey(key.key))
        break;
    case "CREATE_USER":
        res.render("createNewUser")
        break;
    }
})

app.post(['/:key'], (req, res, next) => {
    key = Keys.checkEphemeralKey(req.params.key)

    if (!key) {
        next()
        return
    }

    switch (key.type) {

    case "CREATE_USER":
        username = req.body['username']
        password = req.body['password']
    
        if (!(username && password)) {
            res.reply(400)
            return
        }
    
        switch (Users.createUser(username, password)) {
            case 'BAD_PASSWORD':
                res.reply(406, "Invalid Password")
                break;
            case 'USER_ALREADY_EXISTS': 
                res.reply(409, "An account with that name already exists")
                break;
            case 'OK': 
                output = Users.login(username, password, req.ip, (req.headers['user-agent'] || ""))
                res.cookie("SID", newSID, { 
                    maxAge: 1000 * 60 * 60 * 24 * 7, 
                    sameSite: "none", 
                    secure: true, 
                    httpOnly: true,
                }).redirect("/admin")
                Keys.useEphemeralKey(req.params.key)
                break;
        }
        break;

    }
})

// ---------- Public routes ----------

if (Users.userList().length == 0) {
    app.get("/", (req, res) => {
        if (Users.userList().length != 0) {
            res.reply(404)
            return
        }
        res.render("createNewUser")
    })

    app.post("/", (req, res) => {
        if (Users.userList().length != 0) {
            res.reply(404)
            return
        }

        username = req.body['username']
        password = req.body['password']
    
        if (!(username && password)) {
            res.reply(400)
            return
        }
    
        switch (Users.createUser(username, password)) {
            case 'BAD_PASSWORD':
                res.reply(406, "Invalid Password")
                break;
            case 'USER_ALREADY_EXISTS': 
                res.reply(409, "An account with that name already exists")
                break;
            case 'OK': 
                output = Users.login(username, password, req.ip, (req.headers['user-agent'] || ""))
                res.cookie("SID", newSID, { 
                    maxAge: 1000 * 60 * 60 * 24 * 7,  
                    sameSite: "none", 
                    secure: true, 
                    httpOnly: true,
                }).redirect("/admin")
                break;
        }
    })
}

app.get("/favicon.ico", (req, res) => {
    options = { root: path.join(__dirname) };    
    res.sendFile(`./data/favicons/favicon.ico`, options)
})

app.get("/favicons/:icon", (req, res) => {
    file = decodeURIComponent(req.params.icon)
    options = { root: path.join(__dirname) };    
    res.sendFile(`./data/favicons/${file}`, options)
})

app.get(["/download/*", "/file/*"], (req, res) => {
    filename = decodeURIComponent(req.params[0])

    if (filename.toLowerCase().indexOf("private/") != -1) {
        res.reply(404)
        return
    }

    res.fileResponse(filename);
});

app.get("*", async (req, res) => {
    res.reply(404)
});