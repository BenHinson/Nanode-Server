// Nauth - Node-Object-Record-Database

import CryptoJS from 'crypto-js';
import cookie from 'cookie'
import cookie_sign from 'cookie-signature'

import { nanoid } from 'nanoid';

import {WHITELIST, ROTATION_KEY, SECRET_KEY, COOKIE_ENCRYPT_KEY} from '../Admin/keys';

import Nelp from '../tools';
import Logger from './Logger';
import Account from '../Account/account';

import {getDB} from '../Admin/mongo';
const Nauth_DB = getDB('Nauth');

// ======================= TS ========================
import { NextFunction } from 'connect';
import { Request, Response } from 'express';

/////////////////////////////////////////////////////////

const Nauth = {
  Middle: (req:Request, res:Response, next:NextFunction) => {
    new Middle(req, res, next);
  },
  _Create: (domain:string, cID:string, uID:string) => {
    // Create an entry within the Nauth Database
    return Nauth_DB.collection(domain).insertOne({cID, uID, sessions: {}})
      .then((result:boolean) => { return true; })
      .catch((err:Error) => {console.error(`Couldn't create cookie data ${err}`); return false; })
  },
  _Session: (res:Response, domain:string, cID:string, uID:string, sID:string, session_created:number, DeviceInfo:Device) => {
    // Set a cookie session into the Nauth Database
    return Nauth_DB.collection(domain).updateOne({cID}, {$set: {[`sessions.${sID}`]: {"Added": session_created, "Dev_Added": Nelp.timeNowString(), "Dev_Info": DeviceInfo, "Locked": false}}})
      .then((result:boolean) => { return Nauth._Make_and_Set(res, domain, cID, uID, sID, session_created) })
      .catch((err:Error) => {console.error(`Couldn't write new session: ${err}`); return false; })
  },
  _Make_and_Set: (res:Response, domain:string, cID:string, uID:string, sID:string, toc:number) => {
    // Creates and then sets the Nauth cookie for the client.
    let new_cookie = CryptoJS.AES.encrypt(JSON.stringify({domain, cID, uID, sID, toc, rot: ROTATION_KEY}), COOKIE_ENCRYPT_KEY).toString();
    return res.cookie('nauth', cookie_sign.sign(new_cookie, SECRET_KEY), {domain: 'nanode.one', maxAge: 31_536_000_000, httpOnly: true, secure: true});  // 1 Year
  }
}


class Middle {
  req:Request
  res:Response

  constructor(req:Request, res:Response, next:NextFunction) {
    this.req = req;
    this.res = res;

    this.Authenticate(next);
  }
  
  async Authenticate(next:NextFunction): Promise<void> {
    try {
      const NauthAccount:NauthAccount = await this.Validate(this.getCookie(this.req.cookies?.nauth));
      
      Logger.ActivityLog(this.req, NauthAccount);

      if (NauthAccount.uID || this.req.originalUrl.match(/\/settings|check/)) { // @ts-ignore // trying to set req.headers.uID
        this.req.headers.uID = NauthAccount.uID || null;
        
        if (this.req.query?.details === 'true') {
          this.req.headers.accountDetails = (
            await Account.Get(NauthAccount.uID as string, ['username', 'photo', 'plan'])
          )[0];
        }
        return next();
      }
      throw 'No Account uID needed for non: settings or check page'; // Runs the catch block
    } catch (error) {
      console.log('Nauth Middleware Error: '+ error);
      return this.res.redirect('https://account.nanode.one/login');
    }

  }

  async Validate(nauth_cookie:Cookie|false): Promise<NauthAccount> {

    let Trusted_Cookie = this.completeCookie(nauth_cookie);
    if (!Trusted_Cookie) { return this.cookieError("Incomplete Nauth") }

    nauth_cookie = nauth_cookie as Cookie;

    let Accepted_Cookie = this.checkCookie(nauth_cookie);
    if (Accepted_Cookie) { return this.cookieSuccess(nauth_cookie); }

    // The session has ran out and needs to be validated.
    const {domain, cID, uID, sID} = nauth_cookie;

    let Record = await this.Nauth_Read(domain, cID);
    if (!Record || Record.uID !== uID) { return this.cookieError("No Match: User ID"); };
    
    let nauth_session = Record.sessions[sID];
    if (!nauth_session || nauth_session.locked === true) { return this.cookieError("No Such Session or Locked"); }
    
    let Device_Match = Nelp.deviceMatch(Nelp.deviceInfo(this.req), nauth_session.dev_info);
    if (!Device_Match) { return this.cookieError("Different Device") }

    // Set a New Session and Return that.
    
    let new_session:NewSession = {
      "added": new Date().getTime(),
      "dev_added": nauth_session.Dev_added,
      "dev_info": Nelp.deviceInfo(this.req),
      'locked': nauth_session.locked
    }
    
    let New_Session_Id = await this.Nauth_Update(domain, Record._id, sID, nanoid(), new_session);
    if (!New_Session_Id) { return this.cookieError("Failed creating new Session") }
    
    Nauth._Make_and_Set(this.res, domain, cID, uID, New_Session_Id, new_session.added);

    return this.cookieSuccess(nauth_cookie);
  }

  // ===================================

  getCookie(encrypted_Cookie:string):Cookie|false {
    return encrypted_Cookie
      ? ( JSON.parse( CryptoJS.AES.decrypt(decodeURIComponent( cookie_sign.unsign( encrypted_Cookie , SECRET_KEY ) ), COOKIE_ENCRYPT_KEY).toString(CryptoJS.enc.Utf8) ) )
      : false;
  }
  completeCookie(cookie:Cookie|false): boolean {
    return (cookie && cookie.domain && cookie.sID && cookie.cID && cookie.toc && cookie.rot && cookie.uID) ? true : false;
  }
  checkCookie(nauth_cookie:Cookie): boolean {
    return (nauth_cookie.toc + 7_200_000 > new Date().getTime() && nauth_cookie.rot === ROTATION_KEY) ? true : false;
  }

  // ===================================

  async Nauth_Read(domain:string, cID:string): Promise<LooseObject|false> {
    return Nauth_DB.collection(domain).find({cID}, {$exists: true})
      .toArray()
      .then((items:any) => { return items.length ? items[0] : false })
      .catch((err:Error) => { console.error(`Error finding cID: ${err}`); return false; })
  }

  async Nauth_Update(domain:string, Obj_id:string, cur_sID:string, new_sID:string, new_session:NewSession) {
    return Nauth_DB.collection(domain).updateOne({_id: Obj_id}, {
      $set: {[`sessions.${new_sID}`]: new_session},
      $unset: {[`sessions.${cur_sID}`]: 1}
    })
    .then((result:boolean) => {return new_sID})
    .catch((err:Error) => {console.error(`Couldn't update session:  ${err}`); return false; })
  }

  // ===================================

  cookieError(err_message:string) {
    return {"uID": false, "err": err_message, "req": {"type": 'HTTP', "url": this.req.originalUrl}} }
  cookieSuccess(Nord_Cookie:Cookie) {
    return {"uID": Nord_Cookie.uID, "req": {"type": 'HTTP', "url": this.req.originalUrl}} }
}

/////////////////////////////////////////////////////////

export default Nauth;