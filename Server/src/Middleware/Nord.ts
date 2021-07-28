// nord - Node-Object-Record-Database

import CryptoJS from 'crypto-js';
import cookie from 'cookie'
import cookie_sign from 'cookie-signature'

import { nanoid } from 'nanoid';

import {WHITELIST, ROTATION_KEY, SECRET_KEY, COOKIE_ENCRYPT_KEY} from '../Admin/keys'
import * as Helper from '../helper';
import Logger from '../Middleware/Logger'

import {getDB} from '../Admin/mongo';
const Nord_DB = getDB('nord');

// ======================= TS ========================
import { NextFunction } from 'connect';
import { param } from '../API/subdomains/account';

/////////////////////////////////////////////////////////


const Middle = async(req:Request|any, res:Response|any, next:NextFunction) => {
  try {
    let Account:NordAccount = await Check("HTTP", req, res);
    Logger.ActivityLog(req, Account);
    if (Account.uID || req.originalUrl.match(/\/settings|check/)) {
      req.headers.uID = Account.uID || null;
      return next();
    }
    throw 'No Account uID for non: settings or check page';
  } catch (error) {
    console.log('Nord Middleware Error: '+ error);
    return res.redirect('https://account.Nanode.one/login');
  }
}

/**
 * @param  {}
 * This is a function that is called by {@link Middle}
 * @return userID data or redirects to login page.
*/

const Check = async(Type:'SOCKET'|'HTTP', Connection:Request|any, Response:Response): Promise<NordAccount> => {
  let tray = (Type == "SOCKET"
    ? cookie.parse(JSON.stringify(Connection.handshake.headers.cookie))
    : Connection.cookies);
  if (!tray) { return {"uID": false, "err": "No Cookies", "req": requestURL(Type, Connection)}; }

  // @ NORD COOKIE CHECK
  let Nord_Cookie:Cookie = getCookie(tray.nord);
  if (!completeCookie('NORD', Nord_Cookie)) { return {"uID": false, "err": "Incomplete Nord", "req": requestURL(Type, Connection)} };

  if (!Helper.validateUUID(Nord_Cookie.uID) ) { return {"uID": false, "err": "Incorrect UUID", "req": requestURL(Type, Connection)} };

  // @ SESSION COOKIE CHECK
  let Session_Cookie:Cookie = getCookie(tray.session);
  if (completeCookie('SESSION', Session_Cookie)) {
    if ((Session_Cookie.toc + 7200000 >= new Date().getTime())
      && (Session_Cookie.sID == Nord_Cookie.sID)
      && (Session_Cookie.rot == ROTATION_KEY)
      ) { return {"uID": Nord_Cookie.uID, "req": requestURL(Type, Connection)}; }
  }
  // console.log(Nord_Cookie);
  // console.log(Session_Cookie);

  // @ DATABASE CALL AND CHECK
  let Record = await Nord_Return(Nord_Cookie.domain, Nord_Cookie.cID);
  // console.log(Record);
  
  if (!Record || Record.uID != Nord_Cookie.uID) { return {"uID": false, "err": "No Match User ID", "req": requestURL(Type, Connection)} };
  let Session = Record.sessions[Nord_Cookie.sID];
  if (!Session || Session.Locked !== false) { return {"uID": false, "err": "No Such Session or Locked", "req": requestURL(Type, Connection)} };
  
  if ( Helper.DeviceMatch(Helper.Device_Info(Type, Connection), Session.Dev_Info) ) {
    let new_Session:NewSession = {"Added": new Date().getTime(), "Dev_Added": Session.Dev_Added, "Dev_Info": Helper.Device_Info(Type, Connection), "Locked": Session.Locked}
    let Cookies = await Nord_Update(Nord_Cookie.domain, Record._id, Nord_Cookie.cID, Nord_Cookie.uID, Nord_Cookie.sID, nanoid(), new_Session)

    await SetCookie(Type, (Type == "SOCKET" ? Connection : Response), 'nord', Cookies.Nord, 31536000000);
    await SetCookie(Type, (Type == "SOCKET" ? Connection : Response), 'session', Cookies.Session, 86400000); // 86400000  31536000000
    
    return {"uID": Nord_Cookie.uID, "req": requestURL(Type, Connection)};
  }
  else { return {"uID": false, "err": "Different Device", "req": requestURL(Type, Connection)}; }
}

const SetCookie = async(Type:'SOCKET'|'HTTP', Response:Response|any, Name:'session'|'nord', Cookie:Cookie, Age:number) => {
  if (Type == "SOCKET" && Response) {
    Response.conn.transport.once('headers', (headers:any) => {
      return headers['set-cookie'] = Name+"="+cookie_sign.sign(Cookie, SECRET_KEY)+"; Max-Age="+Age/1000+"; HttpOnly; Secure; Domain=nanode.one; path=/";
      // return false; console.log("Cannot Sign Socket Cookies...")
    })
  } else if (Type == "HTTP") {
    return Response.cookie(Name, cookie_sign.sign(Cookie, SECRET_KEY), {domain: 'nanode.one', maxAge: Age, httpOnly: true, secure: true});
  }
}

// ----- MONGO -----

const Nord_Create = async(domain:string, cookieID:string, userID:string) => {
  return Nord_DB.collection(domain).insertOne({cID: cookieID, uID: userID, sessions: {}})
  .then((result:boolean) => { return true; })
  .catch((err:Error) => {console.error(`Couldn't create cookie data ${err}`); return false; })
}
const Nord_Session = async(domain:string, cookieID:string, userID:string, sessionID:string, sessionTime:number, DeviceInfo:Device) => {
  return Nord_DB.collection(domain).updateOne({cID: cookieID}, {$set: {["sessions."+sessionID]: {"Added": sessionTime, "Dev_Added": Helper.timeNow(), "Dev_Info": DeviceInfo, "Locked": false}}})
  .then((result:boolean) => {
    return {
      "Nord": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "cID": cookieID, "uID": userID, "sID": sessionID}), COOKIE_ENCRYPT_KEY).toString(), 
      "Session": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "sID":sessionID, "toc": sessionTime, "rot": ROTATION_KEY }), COOKIE_ENCRYPT_KEY).toString()
    };
  })
  .catch((err:Error) => {console.error(`Couldn't write new session: ${err}`); return false; })
}


export { Check, Middle, SetCookie, Nord_Create, Nord_Session}

// =================================================== 

const Nord_Update = async(domain:string, Obj_id:string, cID:string, uID:string, cur_sID:string, new_sID:string, new_session:NewSession) => {
  return Nord_DB.collection(domain).updateOne({_id: Obj_id}, {
    $set: {["sessions."+new_sID]: new_session},
    $unset: {["sessions."+cur_sID]: 1}
  })
  .then((result:boolean) => {
    return {
      "Nord": CryptoJS.AES.encrypt(JSON.stringify({"domain":domain, "cID": cID, "uID": uID, "sID": new_sID}), COOKIE_ENCRYPT_KEY).toString(), 
      "Session": CryptoJS.AES.encrypt(JSON.stringify({"domain":domain, "sID":new_sID, "toc": new_session.Added, "rot": ROTATION_KEY }), COOKIE_ENCRYPT_KEY).toString()
    }
  })
  .catch((err:Error) => {console.error(`Couldn't update account info:  ${err}`); return false; })
}
const Nord_Return = async(domain:string, cookie:string) => {
  return Nord_DB.collection(domain).find({cID: cookie}, {$exists: true})
    .toArray()
    .then((items:any) => { return items.length ? items[0] : false })
    .catch((err:Error) => { console.error(`Error finding cID: ${err}`); return false; })
}

// =================================================== 


const getCookie = function(encrypted_Cookie:string) {
  return encrypted_Cookie
    ? ( JSON.parse( CryptoJS.AES.decrypt(decodeURIComponent( cookie_sign.unsign( encrypted_Cookie , SECRET_KEY ) ), COOKIE_ENCRYPT_KEY).toString(CryptoJS.enc.Utf8) ) )
    : false;
}

const completeCookie = function(type:'NORD'|'SESSION', cookie:Cookie) {
  if (type == 'NORD') { return (cookie && cookie.sID && cookie.cID) ? true : false; }
  else if (type == 'SESSION') { return (cookie && cookie.toc && cookie.sID && cookie.rot) ? true : false }
  else { return false }
}

const requestURL = function(Type:'SOCKET'|'HTTP', Connection:Request|any) {
  return {"type": Type, "url": (Type == 'SOCKET' ? Connection.url : Connection.originalUrl)};
}