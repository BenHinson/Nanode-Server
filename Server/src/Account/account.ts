import {getColl} from '../Admin/mongo';
const Account_Coll = getColl('account');

import Node from '../Node/node.js'
import Nauth from '../Middleware/Nauth.js'
import Nelp from '../tools.js'
import {Settings_Template} from '../templates'
import Logger from '../Middleware/Logger.js'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
const saltRounds = 10;

import cookie_sign from 'cookie-signature'
import {nanoid} from 'nanoid'
import {v4 as uuidv4} from 'uuid';

// ======================= TS ========================
import { Request, Response } from 'express';

// =====================  ACTION  =====================

const Login = async(Email:string, Password:string, req:Request, res:Response) => {
  Account_Coll.find({email: Email.toLowerCase()}, {$exists: true}).toArray(async(err:any, doc:any) => {
    if (doc && doc.length) {
      bcrypt.compare(Password, doc[0].password, async (err, result:boolean) => {
        if (!result) {
          Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Wrong Password", "email": Email})
          return res.send({ "Acc_Server": "Incorrect_Cred" })
        } else {
          Logger.CustomActivityLog({"action": 'SUCCESSFUL Login Attempt', "email": Email})
          
          await Nauth._Session(res, "nanode.one", doc[0].cookieID, doc[0].userID, nanoid(), new Date().getTime(), Nelp.deviceInfo(req));

          return res.send({ "Acc_Server": "_Login" })
        }
      })
    } else {
      Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Account Not Found", "email": Email})
      return res.send({ "Acc_Server": "Incorrect_Cred" })
    }
  })
}

// =====================  WRITE  =====================

const Create = async(Email:string, Password:string, req:Request, res:Response) => {
  let Check = await Account_Coll.find({email: Email}, {$exists: true}).limit(1).toArray();
  if (Check.length) {console.log("Account Exists Already"); return res.send({ "Acc_Server": "Already_Exists" }) }

  let Hashed_Password = await bcrypt.hash(Password, saltRounds);
  if (!Hashed_Password) { console.error("Couldn't hash Password"); return; }

  let uID = uuidv4();
  let CookieID = nanoid();
  let Username = Email.split('@')[0].replace(/[^a-zA-Z +]/g,' ').replace(/  +/g, ' ');

  return Account_Coll.insertOne({"email": Email.toLowerCase(), "password": Hashed_Password, "passwordLength": Password.length, "userID": uID, "photo": "", "username": Username, "cookieID": CookieID, "key": crypto.randomBytes(32), "settings": Settings_Template, "plan": {'max': (10 * 1024 * 1024 * 1024), 'used': 0} })
    .then(async() => {
      await Nauth._Create("nanode.one", CookieID, uID);
      await Node.Account_Setup(uID);
      return res.send({ "Acc_Server": "_Registered" })
    })
    .catch((err: any) => { console.error(`Couldn't Create Account: ${err}`); return false; })
}

const Write = async(Params:Write_Params) => {
  const {user, type, multi, parentKey, childKey, data} = Params;
  let MongoEdit:MongoEdit = {};

  if (type == "Increment") {  MongoEdit.$inc = { [`${parentKey}.${childKey}`]: data || 1 } }
  else if (type == "Set") { MongoEdit.$set = { [`${parentKey}.${childKey ? childKey : ''}`]: data } }
  else if (type == 'Unset') { MongoEdit.$unset = {};
    Array.isArray(childKey)
      ? childKey.forEach(item => MongoEdit.$unset[`${parentKey}.${item ? item : ''}`] = '')
      : MongoEdit.$unset[`${parentKey}.${childKey ? childKey : ''}`] = '';
  }
  else {return false;}

  return Account_Coll.updateOne( {"userID": user}, MongoEdit )
  .then((result: any) => {return true})
  .catch((err: any) => {console.error(`Couldn't update account info:  ${err}`); return false; })
}

// =====================  READ  =====================

const Get = async(uID:string, query:LooseObject) => {
  let Project:LooseObject = {_id: 0};
  ["password", "cookieID", "key"].forEach(Key => delete query[Key]);
  query.forEach((item:string) => { Project[item] = 1; });
  
  return await Account_Coll.aggregate([
    { $match: { 'userID': uID } },
    { $project: Project }
  ]).toArray();
}

export default { Login, Create, Write, Get }