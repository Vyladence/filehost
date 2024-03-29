const crypto = require('crypto')
DB = undefined;

function changePassword ( username = "", newPassword = "" ) {
    if (!validPassword(password)) {
        return "BAD_PASSWORD"
    }

    user = DB.prepare("SELECT * FROM users WHERE username = ?").get(username)

    if (user == undefined) {
        return "UNKNOWN_USERNAME"
    }

    salt = crypto.randomBytes(128).toString('base64')
    hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')

    DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = ?").run(hash, salt, username)

    return "OK"
}

function checkPassword ( username = "", password = "" ) {
    user = DB.prepare("SELECT * FROM users WHERE username = ?").get(username)

    if (user == undefined) {
        return "UNKNOWN_USERNAME"
    }

    passwordAttemptHash = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
    
    if (passwordAttemptHash != user.password_hash) {
        return "INCORRECT_PASSWORD"
    }

    return "OK"
}

function validPassword ( password = "" ) {
    // ^.*              : Start
    // (?=.{8,60})      : between 8 and 60 characters
    // (?=.*[a-zA-Z])   : Letters
    // (?=.*\d)         : Digits
    // .*$              : End 

    return /^.*(?=.{8,60})(?=.*[a-zA-Z])(?=.*\d).*$/.test(password)
}


/**
 * Logs a user in
 * @param {Express.Request} req The express request object
 * @param {String} username 
 * @param {String} password 
 * @param {String} ip The login request source's IP address
 * @param {String} ua The login request source's User Agent
 * @returns {String} The new SID of the logged in user
 */
function login ( username = "", password = "", ip = "", ua = "") {
    attempt = checkPassword(username, password)

    if (attempt != "OK") return attempt;

	newSID = crypto.randomBytes(32).toString('base64url')
    newSIDhash = crypto.createHash('sha512').update(newSID).digest('hex');

    DB.prepare("INSERT INTO active_sessions (hashed_sid, ip_addr, user_agent, username, invalid_after) VALUES (?, ?, ?, ?, ?)").run(newSIDhash, ip, ua, username, Date.now() + 6 * 60 * 60 * 1000)
    DB.prepare("UPDATE users SET last_logged_in = ? WHERE username = ?").run(Date.now(), username)

    return newSID
}

/**
 * Logs a user out
 * @param {String} sid The SID of the session to invalidate
 */
function logout ( sid = "" ) {
    SIDhash = crypto.createHash('sha512').update(sid).digest('hex');
    DB.prepare("DELETE FROM active_sessions WHERE hashed_sid = ?").run(SIDhash)
}

function removeUserSessions( username = "" ) {
    DB.prepare("DELETE FROM active_sessions WHERE username = ?").run(username)
}


function createUser( username = "", password = "" ) {
    if (!validPassword(password)) {
        return "BAD_PASSWORD"
    }

    if (DB.prepare("SELECT * FROM users WHERE username = ?").get(username)) {
        return "USER_ALREADY_EXISTS"
    }

    salt = crypto.randomBytes(128).toString('base64')
    hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')

    DB.prepare("INSERT INTO users (username, password_hash, salt, date_created, last_logged_in, permission_level) VALUES (?, ?, ?, ?, ?, ?)").run(username, hash, salt, Date.now(), Date.now(), "Admin")
    return "OK"
}

function deleteUser( username = "" ) {
    DB.prepare("DELETE FROM users WHERE username = ?").run(username)
}

function userList() {
    output = DB.prepare("SELECT * FROM users").all()
    cleanedOutput = []

    for (user in output) {
        cleanedOutput.push({
            username: output[user].username,
            permissionLevel: output[user].permission_level,
            joinDate: output[user].date_created,
            lastLoggedIn: output[user].last_logged_in
        })
    }
    
    return cleanedOutput
}


function cleanSessions() {
    DB.prepare("DELETE FROM active_sessions WHERE invalid_after < ?").run(Date.now())
}

function validSession ( req ) {
    sid = req.parseCookies()["SID"]
    ua = (req.headers['user-agent'] || "")
    ip = req.ip

    if (!sid) {
        return false
    }

    SIDhash = crypto.createHash('sha512').update(sid).digest('hex')

    row = DB.prepare("SELECT * FROM active_sessions WHERE hashed_sid = ? AND ip_addr = ? AND user_agent = ?").get(SIDhash, ip, ua)

    // Session is not found
    if (!row) {
        return undefined
    }

    // If session has expired, remove
    // else renew session
    if (row["invalid_after"] < Date.now()) {
        DB.prepare("DELETE FROM active_sessions WHERE hashed_sid = ?").run(SIDhash)
        return undefined
    } else {
        DB.prepare("UPDATE active_sessions SET invalid_after = ? WHERE hashed_sid = ?").run(Date.now() + 6 * 60 * 60 * 1000, SIDhash)
    }

    return { user: row["username"], permissionLevel: row["permission_level"] }
}

function sessionUsername( req ) {
    sid = req.parseCookies()["SID"]

    if (!sid) {
        return false
    }

    SIDhash = crypto.createHash('sha512').update(sid).digest('hex')
    row = DB.prepare("SELECT * FROM active_sessions WHERE hashed_sid = ?").get(SIDhash)
    
    if (!row) {
        return undefined
    }

    return row["username"]
}

module.exports = function(database) {
    DB = database
    cleanSessions()

    var module = {
      login,
      logout,
      validSession,
      removeUserSessions,
      sessionUsername,
      checkPassword,
      changePassword,
      createUser,
      deleteUser,
      userList,
    };
  
    return module; 
};