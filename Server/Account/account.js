const Mongo_Connect = require('../Admin/mongo');

const Account_Coll = Mongo_Connect.getColl('account');

const Node = require('../Node/node.js');
const Nord = require('../Middleware/Nord.js');
const Helper = require('../helper.js');
const Logger = require('../Middleware/Logger.js')

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cookie_sign = require('cookie-signature');
const { nanoid } = require('nanoid');
const uuidv4 = require('uuid/v4');

// =================================================== 

module.exports = {
  // =====================  ACTION  =====================

  Login: async(Email, Password, req, res) => {
    Account_Coll.find({email: Email.toLowerCase()}, {$exists: true}).toArray(async(err, doc) => {
      if (doc && doc.length) {
        bcrypt.compare(Password, doc[0].password, async (err, result) => {
          if (!result) {
            Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Wrong Password", "email": Email})
            return res.send({ "Acc_Server": "Incorrect_Cred" })
          } else {
            Logger.CustomActivityLog({"action": 'SUCCESSFUL Login Attempt', "email": Email})
            let Cookies = await Nord.Nord_Session("Nanode.one", doc[0].cookieID, doc[0].userID, nanoid(), new Date().getTime(), Helper.Device_Info("HTTP", req)) ///////////

            await Nord.SetCookie('HTTP', res, 'nord', Cookies.Nord, 31536000000); // 1 Year
            await Nord.SetCookie('HTTP', res, 'session', Cookies.Session, 86400000); // 1 Day

            return res.send({ "Acc_Server": "_Login" })
          }
        })
      } else {
        Logger.CustomActivityLog({"action": 'FAILED Login Attempt', "reason": "Account Not Found", "email": Email})
        return res.send({ "Acc_Server": "Incorrect_Cred" })
      }
    })
  },
  
  // =====================  WRITE  =====================

  Create: async(Email, Password, req, res) => {
    let Check = await Account_Coll.find({email: Email}, {$exists: true}).limit(1).toArray();
    if (Check.length) {console.log("Account Exists Already"); return res.send({ "Acc_Server": "Already_Exists" }) }
  
    let Hashed_Password = await bcrypt.hash(Password, saltRounds);
    if (!Hashed_Password) { console.error("Couldn't hash Password"); return; }
  
    let uID = uuidv4();
    let CookieID = nanoid();
    let Username = Email.split('@')[0].replace(/[^a-zA-Z +]/g,' ').replace(/  +/g, ' ');
  
    return Account_Coll.insertOne({"email": Email.toLowerCase(), "password": Hashed_Password, "passwordLength": Password.length, "userID": uID, "photo": "", "username": Username, "cookieID": CookieID, "key": crypto.randomBytes(32), "settings": Helper.Settings_Template, "plan": (10 * 1024 * 1024 * 1024) })
      .then(async() => {
        await Nord.Nord_Create("Nanode.one", CookieID, uID);
        await Node.Account_Setup(uID);
        return res.send({ "Acc_Server": "_Registered" })
      })
      .catch(err => { console.error(`Couldn't Create Account: ${err}`); return false; })
  },

  Write: async(Params) => {
    const {user, type, parentKey, childKey, data} = Params;
    let MongoEdit = {};
  
    if (type == "Increment") {  MongoEdit.$inc = { [`${parentKey}.${childKey}`]: data || 1 } }
    else if (type == "Set") { MongoEdit.$set = { [`${parentKey}.${childKey ? childKey : ''}`]: data } }
    else {return false;}
  
    return Account_Coll.updateOne( {"userID": user}, MongoEdit )
    .then(result => {return true})
    .catch(err => {console.error(`Couldn't update account info:  ${err}`); return false; })
  },

  // =====================  READ  =====================

  Get: async(uID, query) => {
    let Project = {};
    ["password", "cookieID", "key"].forEach(Key => delete query[Key]);
    query.forEach(item => { Project[item] = 1; });

    return await Account_Coll.aggregate([
      { $match: { 'userID': uID } },
      { $project: Project }
    ]).toArray();
  },
}