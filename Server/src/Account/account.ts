import {getColl} from '../Admin/mongo';
const Account_Coll = getColl('account');

import Node from '../Node/node.js'
import Nauth from '../Middleware/Nauth.js'
import Nelp from '../tools.js'
import {Settings_Template} from '../templates'
import Logger from '../Middleware/Logger.js'

import crypto from 'crypto'
import bcrypt from 'bcrypt'

import cookie_sign from 'cookie-signature'
import {nanoid} from 'nanoid'
import {v4 as uuidv4} from 'uuid';

// ======================= TS ========================
import { Request, Response } from 'express';

// =====================  ACTION  =====================

const Login = async(email:string, password:string, req:Request, res:Response) => {
  Account_Coll.find({email: email.toLowerCase()}, {$exists: true}).toArray(async(err:any, doc:any) => {
    if (doc && doc.length) {
      bcrypt.compare(password, doc[0].password, async (err, result:boolean) => {
        if (!result) {
          Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Wrong Password", email})
          return res.send({ "Acc_Server": "Incorrect_Cred" })
        } else {
          Logger.CustomActivityLog({"action": 'SUCCESSFUL Login Attempt', email})
          
          await Nauth.Session(res, "nanode.one", doc[0].cookieId, doc[0].userId, nanoid(), new Date().getTime(), Nelp.deviceInfo(req));

          return res.send({ "Acc_Server": "_Login" })
        }
      })
    } else {
      Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Account Not Found", email})
      return res.send({ "Acc_Server": "Incorrect_Cred" })
    }
  })
}

// =====================  WRITE  =====================

const Create = async(email:string, password:string, req:Request, res:Response) => {
  let check = await Account_Coll.find({email}, {$exists: true}).limit(1).toArray();
  if (check.length) {console.log("Account Exists Already"); return res.send({ "Acc_Server": "Already_Exists" }) }

  let hashedPassword = await bcrypt.hash(password, process.env.SALT_ROUNDS!);
  if (!hashedPassword) { console.error("Couldn't hash Password"); return; }

  let userId = uuidv4();
  let cookieId = nanoid();
  let username = email.split('@')[0].replace(/[^a-zA-Z +]/g,' ').replace(/  +/g, ' ');

  return Account_Coll.insertOne({"email": email.toLowerCase(), "password": hashedPassword, "passwordLength": password.length, userId, "photo": "", username, cookieId, "key": crypto.randomBytes(32), "settings": Settings_Template, "plan": {'max': (10 * 1024 * 1024 * 1024), 'used': 0} })
    .then(async() => {
      await Nauth.Create("nanode.one", cookieId, userId);
      await Node.Account_Setup(userId);
      return res.send({ "Acc_Server": "_Registered" })
    })
    .catch((err: any) => { console.error(`Couldn't Create Account: ${err}`); return false; })
}

const Write = async(params:WriteParams) => {
  const {userId, type, multi, parentKey, childKey, data} = params;
  let mongoEdit:MongoEdit = {};

  if (type == "INCREMENT") {  mongoEdit.$inc = { [`${parentKey}.${childKey}`]: data || 1 } }
  else if (type == "SET") { mongoEdit.$set = { [`${parentKey}.${childKey ? childKey : ''}`]: data } }
  else if (type == 'UNSET') { mongoEdit.$unset = {};
    Array.isArray(childKey)
      ? childKey.forEach(item => mongoEdit.$unset[`${parentKey}.${item ? item : ''}`] = '')
      : mongoEdit.$unset[`${parentKey}.${childKey ? childKey : ''}`] = '';
  }
  else {return false;}

  return Account_Coll.updateOne( {userId}, mongoEdit )
  .then((result: any) => {return true})
  .catch((err: any) => {console.error(`Couldn't update account info:  ${err}`); return false; })
}

// =====================  READ  =====================

const Get = async(userId:string, query:LooseObject) => {
  let project:LooseObject = {_id: 0};
  ["password", "cookieId", "key"].forEach(key => delete query[key]);
  query.forEach((item:string) => { project[item] = 1; });
  
  return await Account_Coll.aggregate([
    { $match: { userId } },
    { $project: project }
  ]).toArray();
}

export default { Login, Create, Write, Get }