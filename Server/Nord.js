// nord - Nano-Object-Record-Database

const CryptoJS = require("crypto-js");
const crypto = require('crypto');

const cookie = require('cookie');
const cookie_sign = require('cookie-signature')

const { nanoid } = require("nanoid");

const Keys = require('./Keys.js');
const Helper = require('./helper.js');

const Mongo_Connect = require('./Mongo_Connect.js');
const Nord_DB = Mongo_Connect.getDB("nord");

/////////////////////////////////////////////////////////

// USER ACCOUNT PAGE, VIEW CONNECTED DEVICES, REMOVE / LOCK A DEVICE

  // tray - all cookies
  // Nord_Cookie - [ domain, cID(cookie ID), uID(user ID), sID(session ID) ]  |  Refresh Token  |  Verified With Sessions Device
  // Session_Cookie - [ domain, sID(session ID), toc(time-of-creation), rot(rotational) ]  |  Access Token  |  Lasts 2 Hours, grants access for that time.

  // 6 Points of Info in the Two Cookies.
  // Session = Server Rotational Key, Session ID, Time Key.
  // Nord = Cookie ID, User ID, Session ID

  // If sessions dont match | Times > 2 Hours | Rotationals Dont Match
  // Check Database for Cookie ID
  // Check User IDs, Check Session Device Info, Check Session Time Info

/////////////////////////////////////////////////////////

// Nord.Check("SOCKET", socket)
// Nord.Check("HTTP", req)

// login: cookietest@nanode.one
// password: c00kieTEST!

// WhiteList
// if (WhiteListID.indexOf(Nord_Cookie.uID) !== -1) { return {"uID": Nord_Cookie.uID, "req": requestURL(Type, Connection)} }
// WhiteList

// Nord WhiteList
WhiteListID = ["41feb20c-ad74-4b57-abbb-a695334c3569","56d0bc91-229e-4109-9fd5-d968386518a6","69ebe365-398f-4340-b4a0-b51da339fa19"]

module.exports = {

  Check: async(Type, Connection, Response) => { // Check Database, return false or users ID // Send Login res.redirect('https://account.nanode.one/login')
    let tray = (Type == "SOCKET"
      ? cookie.parse(JSON.stringify(Connection.handshake.headers.cookie))
      : Connection.cookies);
    if (!tray) { return {"uID": false, "err": "No Cookies", "req": requestURL(Type, Connection)}; }

    // @ NORD COOKIE CHECK
    let Nord_Cookie = getCookie(tray.nord);
    if (!completeCookie('NORD', Nord_Cookie)) { return {"uID": false, "err": "Incomplete Nord", "req": requestURL(Type, Connection)} };

    // @ SESSION COOKIE CHECK
    let Session_Cookie = getCookie(tray.session);
    if (completeCookie('SESSION', Session_Cookie)) {

      if ((Session_Cookie.toc + 7200000 > new Date().getTime())
        && (Session_Cookie.sID == Nord_Cookie.sID)
        && (Session_Cookie.rot == Keys.ROTATION_KEY)
        ) { return {"uID": Nord_Cookie.uID, "req": requestURL(Type, Connection)}; }

    }

    // @ DATABASE CALL AND CHECK
    let Record = await module.exports.Nord_Return(Nord_Cookie.domain, Nord_Cookie.cID);
    if (!Record || Record.uID != Nord_Cookie.uID) { return {"uID": false, "err": "No Match User ID", "req": requestURL(Type, Connection)} };
    let Session = Record.sessions[Nord_Cookie.sID];
    if (!Session || Session.Locked !== false) { return {"uID": false, "err": "No Such Session or Locked", "req": requestURL(Type, Connection)} };
    
    if ( Helper.DeviceMatch(Helper.Device_Info(Type, Connection), Session.Dev_Info) ) {
      let new_Session = {"Added": new Date().getTime(), "Dev_Added": Session.Dev_Added, "Dev_Info": Helper.Device_Info(Type, Connection), "Locked": Session.Locked}
      let Cookies = await module.exports.Nord_Update(Nord_Cookie.domain, Record._id, Nord_Cookie.cID, Nord_Cookie.uID, Nord_Cookie.sID, nanoid(), new_Session)

      await module.exports.SetCookie(Type, (Type == "SOCKET" ? Connection : Response), 'nord', Cookies.Nord, 31536000000);
      await module.exports.SetCookie(Type, (Type == "SOCKET" ? Connection : Response), 'session', Cookies.Session, 86400000); // 86400000  31536000000
      
      return {"uID": Nord_Cookie.uID, "req": requestURL(Type, Connection)};
    }
    else { return {"uID": false, "err": "Different Device", "req": requestURL(Type, Connection)}; }
  },

  Middle: async(req, res, next) => {
    try {
      let Account = await module.exports.Check("HTTP", req, res);
      if (!Account.uID || Account.uID == false) {
        if (req.originalUrl.match(/\/settings|check/)) {req.headers.uID = null; return next();}
        else { return res.redirect('https://account.Nanode.one/login'); } }
      else {req.headers.uID = Account.uID; return next(); }
    } catch (error) {
      console.log('Nord Middleware Error: '+ error);
      return res.redirect('https://account.Nanode.one/login');
    }
  },

  SetCookie: async(Type, Response, Name, Cookie, Age) => { //  SOCKET||HTTP , socket||res , Session||Nord , the encrypted cookie , max age in ms
    if (Type == "SOCKET" && Response) {
      Response.conn.transport.once('headers', (headers) => {
        return headers['set-cookie'] = Name+"="+cookie_sign.sign(Cookie, Keys.SECRET_KEY)+"; Max-Age="+Age/1000+"; HttpOnly; Secure; Domain=nanode.one; path=/";
        // return false; console.log("Cannot Sign Socket Cookies...")
      })
    } else if (Type == "HTTP") {
      return Response.cookie(Name, cookie_sign.sign(Cookie, Keys.SECRET_KEY), {domain: 'nanode.one', maxAge: Age, httpOnly: true, secure: true});
    }
  },

  // ----- MONGO -----

  Nord_Create: async(domain, cookieID, userID) => {
    return Nord_DB.collection(domain).insertOne({cID: cookieID, uID: userID, sessions: {}})
    .then(result => { return true; })
    .catch(err => {console.error(`Couldn't create cookie data ${err}`); return false; })
  },
  Nord_Session: async(domain, cookieID, userID, sessionID, sessionTime, DeviceInfo) => {
    return Nord_DB.collection(domain).updateOne({cID: cookieID}, {$set: {["sessions."+sessionID]: {"Added": sessionTime, "Dev_Added": Helper.timeNow(), "Dev_Info": DeviceInfo, "Locked": false}}})
    .then(result => {
      return {
        "Nord": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "cID": cookieID, "uID": userID, "sID": sessionID}), Keys.COOKIE_ENCRYPT_KEY).toString(), 
        "Session": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "sID":sessionID, "toc": sessionTime, "rot": Keys.ROTATION_KEY }), Keys.COOKIE_ENCRYPT_KEY).toString()
      };
    })
    .catch(err => {console.error(`Couldn't write new session: ${err}`); return false; })
  },
  Nord_Update: async(domain, Obj_id, cID, uID, cur_sID, new_sID, new_session) => {
    return Nord_DB.collection(domain).updateOne({_id: Obj_id}, {
      $set: {["sessions."+new_sID]: new_session},
      $unset: {["sessions."+cur_sID]: 1}
    })
    .then(result => {
      return {
        "Nord": CryptoJS.AES.encrypt(JSON.stringify({"domain":domain, "cID": cID, "uID": uID, "sID": new_sID}), Keys.COOKIE_ENCRYPT_KEY).toString(), 
        "Session": CryptoJS.AES.encrypt(JSON.stringify({"domain":domain, "sID":new_sID, "toc": new_session.Added, "rot": Keys.ROTATION_KEY }), Keys.COOKIE_ENCRYPT_KEY).toString()
      }
    })
    .catch(err => {console.error(`Couldn't update account info:  ${err}`); return false; })
  },
  Nord_Return: async(domain, cookie) => {
    return Nord_DB.collection(domain).find({cID: cookie}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { console.error(`Error finding cID: ${err}`); return false; })
  },
}

getCookie = function(encrypted_Cookie) {
  return encrypted_Cookie
    ? ( JSON.parse( CryptoJS.AES.decrypt(decodeURIComponent( cookie_sign.unsign( encrypted_Cookie , Keys.SECRET_KEY ) ), Keys.COOKIE_ENCRYPT_KEY).toString(CryptoJS.enc.Utf8) ) )
    : false;
}

completeCookie = function(type, cookie) {
  if (type == 'NORD') { return (cookie && cookie.sID && cookie.cID) ? true : false; }
  else if (type == 'SESSION') { return (cookie && cookie.toc && cookie.sID && cookie.rot) ? true : false }
  else { return false }
}

requestURL = function(Type, Connection) {
  return {"type": Type, "url": (Type == 'SOCKET' ? Connection.url : Connection.originalUrl)};
}