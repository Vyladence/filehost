DB = undefined;
const TYPES = [ "CREATE_USER", "DOWNLOAD_FILE" ]

String.prototype.toProperCase = function () {
	string = this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	doNotCapitalize = ["the", "and", "as", "if", "at", "but", "by", "for", "from", "if", "in", "of", "once", "onto", "or", "over", "past", "so", "than", "that", "till", "to", "up", "upon", "with", "when", "yet"]
	string = string.trim()
	strArr = string.split(" ")
	for (x in strArr) {
		if (doNotCapitalize.indexOf(strArr[x].toLowerCase()) != -1 && x != 0 && x != strArr.length) {
			strArr[x] = strArr[x].toLowerCase()
		}
	}
	output = strArr.join(" ")
	return output
}

function generateKey () {
    var characters = 'ABCDEFGHKMNPRTUVWXYZabcdehkmpqsuvwxyz3456789';

    result = ""
    // Generate random string of characters
    for ( var i = 0; i < 20; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // If the random string already exists, try again else return result
    if (DB.prepare("SELECT * FROM ephemeral_keys WHERE key = ?").get(result)) {
        return generateKey()
    } else {
        return result
    }
}

function convertKeyInfo (row) {
    return {
        key: row["key"],
        type: row["type"],
        data: JSON.parse(row["json_data"]),
        remainingUses: row["remaining_uses"],
    }
}

/**
 * Generates a random key, adds it to the database, and returns it
 * @param {String} type What the key should be used for
 * @param {Number} uses How many times the key should be allowed to be used
 * @param {JSON} jsonData Data for the type of key
 * @returns {String} key
 */
function createEphemeralKey ( type = "", uses = 0, jsonData = {}, user = "" ) {
    // Convert type index to string value
    if (typeof type == "number") {
        if ([...Array(TYPES.length).keys()].indexOf(type) == -1) { return false }
        else { type = TYPES[type] }
    }

    if (uses == 0 || TYPES.indexOf(type) == -1) {
        return false;
    }

    newKey = generateKey()

    DB.prepare("INSERT INTO ephemeral_keys (key, type, remaining_uses, json_data, created_by) VALUES (?, ?, ?, ?, ?)").run(newKey, type, uses, JSON.stringify(jsonData), user)
    return newKey;
}

/**
 * Checks if an ephemeral key is valid (found in DB)
 * @param {*} key The key to search the database for
 * @returns keyInfo if row is found or false if not
 */
function checkEphemeralKey ( key = "" ) {
    row = DB.prepare("SELECT * FROM ephemeral_keys WHERE key = ?").get(key)
    
    if (row) {
        return convertKeyInfo(row)
    } else {
        return false
    }
}

/**
 * Decrements the remaining uses on an ephemeral key or deletes it if remaining uses = 0
 * @param {String} key key to decrement
 */
function useEphemeralKey ( key = "" ) {
    row = DB.prepare("SELECT * FROM ephemeral_keys WHERE key = ?").get(key)

    if (row) {
        // Decrement remaining uses
        remainingUses = row["remaining_uses"] - 1
        if (remainingUses == 0) {
            DB.prepare("DELETE FROM ephemeral_keys WHERE key = ?").run(key)
        } else {
            DB.prepare("UPDATE ephemeral_keys SET remaining_uses = ? WHERE key = ?").run(remainingUses, key)
        }
    }
}

/**
 * Hard removes a key directly from the DB
 * @param {String} key key to delete
 */
function deleteEphemeralKey ( key = "" ) {
    DB.prepare("DELETE FROM ephemeral_keys WHERE key = ?").run(key)
}

function getKeyList () {
    rows = DB.prepare("SELECT * FROM ephemeral_keys").all()
    outputRows = []

    for (row in rows) {
        outputRows[row] = convertKeyInfo(rows[row])
    }

    return outputRows
}

module.exports = function(database) {
    DB = database

    var module = {
        deleteEphemeralKey,
        createEphemeralKey,
        checkEphemeralKey,
        useEphemeralKey,
        getKeyList,
        TYPES
    };
  
    return module; 
};