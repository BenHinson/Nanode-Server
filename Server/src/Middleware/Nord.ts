// nord - Node-Object-Record-Database

import CryptoJS from 'crypto-js';
import cookie from 'cookie'
import cookie_sign from 'cookie-signature'

import { nanoid } from 'nanoid';

import {WHITELIST, ROTATION_KEY, SECRET_KEY, COOKIE_ENCRYPT_KEY} from '../Admin/keys'
import {validateUUID, DeviceMatch, Device_Info, timeNow} from '../helper';
import Logger from '../Middleware/Logger'

import {getDB} from '../Admin/mongo';
const Nord_DB = getDB('nord');

// ======================= TS ========================
import { NextFunction } from 'connect';
import { Request, Response } from 'express';

/////////////////////////////////////////////////////////


const Middle = async(req:Request, res:Response, next:NextFunction) => {
  try {
    let Account:NordAccount = await ValidateCookie(req, res);
    Logger.ActivityLog(req, Account);
    if (Account.uID || req.originalUrl.match(/\/settings|check/)) { // @ts-ignore // trying to set req.headers.uid
      req.headers.uID = Account.uID || null;
      return next();
    }
    throw 'No Account uID for non: settings or check page';
  } catch (error) {
    console.log('Nord Middleware Error: '+ error);
    return res.redirect('https://account.Nanode.one/login');
  }
}

// Called via link.js  ejs validation or Middle.
// Validates the cookies, against the spec. Returns userID or redirects to login page if not 'settings or check' urls.

const ValidateCookie = async(req:Request, res:Response): Promise<NordAccount> => {
  if (!req.cookies) { return cookieError("No Cookies", req); }

  // @ NORD Cookie Check
  let Nord_Cookie:Cookie = getCookie(req.cookies.nord);
  if (!completeCookie('NORD', Nord_Cookie) || !validateUUID(Nord_Cookie.uID)) {
    return cookieError("Incomplete Nord or Incorrect uID", req) };

  // @ SESSION Cookie Check
  let Session_Cookie:Cookie = getCookie(req.cookies.session);
  if (completeCookie('SESSION', Session_Cookie)) {
    if (
      (Session_Cookie.toc + 7200000 >= new Date().getTime())
      && (Session_Cookie.sID == Nord_Cookie.sID)
      && (Session_Cookie.rot == ROTATION_KEY)
      )
      { return cookieSuccess(Nord_Cookie, req); }
  }

  // console.log(Nord_Cookie, Session_Cookie);

  // @ DATABASE Call and Check
  let Record = await Nord_Return(Nord_Cookie.domain, Nord_Cookie.cID);
  if (!Record || Record.uID != Nord_Cookie.uID) { return cookieError("No Match: User ID", req); };
  // console.log(Record);

  let Session = Record.sessions[Nord_Cookie.sID];
  if (!Session || Session.Locked !== false) {
    console.log(`Session: ${Nord_Cookie.sID} does not exist in Sessions. Can only happen via previous session update right?`)
    return cookieError("No Such Session or Locked", req);
  };
  

  if ( DeviceMatch(Device_Info(req), Session.Dev_Info) ) {
    let new_Session:NewSession = {"Added": new Date().getTime(), "Dev_Added": Session.Dev_Added, "Dev_Info": Device_Info(req), "Locked": Session.Locked}
    let Cookies = await Nord_Update(Nord_Cookie.domain, Record._id, Nord_Cookie.cID, Nord_Cookie.uID, Nord_Cookie.sID, nanoid(), new_Session)

    await SetCookie(res, 'nord', Cookies.Nord, 31536000000);
    await SetCookie(res, 'session', Cookies.Session, 86400000); // 86400000  31536000000
    
    return cookieSuccess(Nord_Cookie, req);
  }
  else { return cookieError("Different Device", req); }
}

const SetCookie = async(Response:Response, Name:'session'|'nord', Cookie:Cookie, Age:number) => {
  return Response.cookie(Name, cookie_sign.sign(Cookie, SECRET_KEY), {domain: 'nanode.one', maxAge: Age, httpOnly: true, secure: true});
}

// ----- MONGO -----

const Nord_Create = async(domain:string, cookieID:string, userID:string) => {
  return Nord_DB.collection(domain).insertOne({cID: cookieID, uID: userID, sessions: {}})
  .then((result:boolean) => { return true; })
  .catch((err:Error) => {console.error(`Couldn't create cookie data ${err}`); return false; })
}
const Nord_Session = async(domain:string, cookieID:string, userID:string, sessionID:string, sessionTime:number, DeviceInfo:Device) => {
  return Nord_DB.collection(domain).updateOne({cID: cookieID}, {$set: {["sessions."+sessionID]: {"Added": sessionTime, "Dev_Added": timeNow(), "Dev_Info": DeviceInfo, "Locked": false}}})
  .then((result:boolean) => {
    return {
      "Nord": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "cID": cookieID, "uID": userID, "sID": sessionID}), COOKIE_ENCRYPT_KEY).toString(), 
      "Session": CryptoJS.AES.encrypt(JSON.stringify({"domain": domain, "sID":sessionID, "toc": sessionTime, "rot": ROTATION_KEY }), COOKIE_ENCRYPT_KEY).toString()
    };
  })
  .catch((err:Error) => {console.error(`Couldn't write new session: ${err}`); return false; })
}


export { ValidateCookie, Middle, SetCookie, Nord_Create, Nord_Session}


// =================================================== 

const Nord_Update = async(domain:string, Obj_id:string, cID:string, uID:string, cur_sID:string, new_sID:string, new_session:NewSession) => {
  console.log(`Session Updated from: ${cur_sID} to ${new_sID}`)
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


const getCookie = (encrypted_Cookie:string) => {
  return encrypted_Cookie
    ? ( JSON.parse( CryptoJS.AES.decrypt(decodeURIComponent( cookie_sign.unsign( encrypted_Cookie , SECRET_KEY ) ), COOKIE_ENCRYPT_KEY).toString(CryptoJS.enc.Utf8) ) )
    : false;
}

const completeCookie = (type:'NORD'|'SESSION', cookie:Cookie): boolean => {
  if (type == 'NORD') { return (cookie && cookie.sID && cookie.cID) ? true : false; }
  else if (type == 'SESSION') { return (cookie && cookie.toc && cookie.sID && cookie.rot) ? true : false }
  else { return false }
}


const cookieError = (err_message:string, req:Request) => { return {"uID": false, "err": err_message, "req": {"type": 'HTTP', "url": req.originalUrl}} }
const cookieSuccess = (Nord_Cookie:Cookie, req:Request) => { return {"uID": Nord_Cookie.uID, "req": {"type": 'HTTP', "url": req.originalUrl}} }