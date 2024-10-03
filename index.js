const path = require('path')
const fs = require('fs');
const fileUpload = require("express-fileupload");
const express = require('express')
const app = express();

app.listen(process.env['PORT'] || 8080);
console.log("Running on port " + (process.env['PORT'] || 8080))

app.set('view engine', 'ejs');
app.set('trust proxy', 'loopback')

app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
    useTempFiles : true,
    tempFileDir : 'tmp',
}));

app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(express.static('public'))

fs.readdirSync("./default_data").forEach((file) => {
    if (!fs.existsSync("./data/" + file)) {
        fs.cpSync("./default_data/" + file, "./data/" + file, {recursive: true})
    }
})

if (!fs.existsSync("./files")) {
    fs.mkdirSync("./files")
}

const db = new require('better-sqlite3')('./data/filehost.db');
SITE_NAME = require("./data/config.json")["site_name"]
const Users = require('./user_management')(db)

app.use( (req, res, next) => {
    req.parseCookies = () => {
        if (!req.headers.cookie) {
            return {};
        } else {
            cookieList = req.headers.cookie.split('; ');
            var result = {};
        
            for (const cookie of cookieList) {
                var cur = cookie.split('=');
                result[cur[0]] = cur[1];
            }
        
            return result;
        }
    }
    
    res.fileResponse = (file, cb) => {
        if ( file == undefined || !fs.existsSync(`./files/${file}`)) {
            res.reply(404)
            console.log("Absent file requested - " + file)
            return
        }

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
    var filteredPath = path.replace(/(\.{2,})/gi, "")

    // remove consecutive slashes
    var filteredPath = filteredPath.replace(/(\/)(?=\1)/gi, "");

    return filteredPath
}

// TODO: rewrite this?
function customReadDir(dir = "") {
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

    return { ...dirInfo, ...fileInfo }
}

function restrict(req, res, next) {
    var session = Users.validSession(req)

    // If session is found, allow access
    if (session) { next(); return }

    // If session is not found and method is GET, redirect to login page
    if (req.method == "GET") { res.redirect("/login"); return }
    
    // Reply with a 401 to all other requests
    res.reply(401) 
    return
}

app.get(["/login"], async (req, res) => {
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
    sid = req.parseCookies()["SID"]
    Users.logout(sid)
    res.reply(200)
})

app.post("/changepassword", async (req, res) => {
    username = Users.sessionUsername(req)
    
    if (!username) {
        res.reply(401)
        return
    }

    oldPassword = req.body.oldPassword
    newPassword = req.body.newPassword

    if (!(oldPassword && newPassword)) {
        req.reply(400)
        return
    }

    attempt = Users.checkPassword(Users.sessionUsername(req), oldPassword)

    if (attempt != "OK") {
        res.reply(400, "Incorrect Password")
        return
    }

    output = Users.changePassword(username, newPassword)

    if (output == "BAD_PASSWORD") {
        req.reply(400, "Invalid Password")
        return
    }

    newSession = Users.login(username, password, req.ip, (req.headers['user-agent'] || ""))
    Users.logout(req.parseCookies()["SID"])
    
    res.cookie("SID", newSession, { 
        maxAge: 1000 * 60 * 60 * 24 * 7, 
        sameSite: "none", 
        secure: true, 
        httpOnly: true,
    }).reply(200)
})

/* ADMIN ROUTES */

app.get("/admin(/:page)?", restrict, async (req, res) => {
    defaultPage = "manage_files"

    data = {
        siteName: SITE_NAME,
        selectedPage: (req.params.page ? req.params.page : defaultPage),
        user: Users.sessionUsername(req),
    }

    if (!fs.existsSync(`./views/partials/${data.selectedPage}.ejs`)) {
        data.selectedPage = defaultPage
    }

    switch (data.selectedPage) {
        case "manage_files": {
            data.friendlyName = "Manage Files"
            data.currentPath = rewritePath(req.query["path"])
            data.fileInfo = customReadDir(data.currentPath)
        } break;
        case "temp_links": {
            data.friendlyName = "Temporary Links"
            data.keyList = Keys.getKeyList()
        } break
        case "users": {
            data.friendlyName = "Manage Users"
            data.userList = Users.userList()
        } break
        case "upload_file": {
            data.friendlyName = "Upload a File"
        } break
    }

    res.render("admin", data)
})

app.post(["/deleteuser"], restrict, async (req, res) => {
	user = req.body["user"]
    console.log(user)
    
    if (!user) {
        res.reply(400)
        return;
    }

    Users.removeUserSessions(user)
    Users.deleteUser(user)

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

// TODO: add error checking and handling
app.post(["/upload"], restrict, (req, res) => {
    if (!req.files) {
        res.reply(400, "No file")
        return
    }

    if (req.files.file.truncated) {
        res.reply(400, "File too large")
        return
    }

    rootDir = __dirname + "/files"
    destination = rewritePath(req.body.destination)
    newFilename = rewritePath(req.body.newFilename)

    // TODO: clean this up
    fileNum = 1
    rawFilename = newFilename.split(".")
    extension = rawFilename.pop()
    rawFilename = rawFilename.join(".")
    finalPath = destination + rawFilename + "." + extension

    while (fs.existsSync(rootDir + finalPath)) {
        finalPath = destination + rawFilename + " (" + fileNum + ")." + extension
        fileNum += 1
    }
    
    fs.cpSync(req.files.file.tempFilePath, rootDir + finalPath, { root: path.join(__dirname) })
    fs.rmSync(req.files.file.tempFilePath)
    
    res.reply(200, finalPath)
})

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

    newKey = Keys.createEphemeralKey(type, uses, data, Users.sessionUsername(req))

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

// ---------- Ephemeral Routes ----------
const Keys = require('./ephemeral_keys')(db)

app.get(["/:key"], async (req, res, next) => {
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

app.post(['/:key'], async (req, res, next) => {
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

// Creates one-time use route to create a new user on first start up
if (Object.keys(Users.userList()).length == 0) {
    app.get("/", (req, res) => {
        if (Object.keys(Users.userList()).length != 0) {
            res.reply(404)
            return
        }
        res.render("createNewUser")
    })

    app.post("/", (req, res) => {
        if (Object.keys(Users.userList()).length != 0) {
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
    if(fs.existsSync(`./data/favicons/${file}`)) {
        res.sendFile(`./data/favicons/${file}`, options) 
    } else {
        res.reply(404)
    }
})

app.get(["/download/*", "/file/*"], (req, res, next) => {
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