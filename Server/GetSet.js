const Mongo_Connect = require('./Mongo_Connect.js');

const Account_Coll = Mongo_Connect.getColl('account');
const Link_Coll = Mongo_Connect.getColl('link');
const Download_Coll = Mongo_Connect.getColl('download');

const Nano = require('./Nano.js');
const Nord = require('../Nord.js');
const Keys = require('../Keys.js');
const Helper = require('./helper.js');

const crpyto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { nanoid } = require('nanoid');
// const uuidv1 = require('uuid/v1');
// const uuidv3 = require('uuid/v3');
const uuidv4 = require('uuid/v4');

// =================================================== 

module.exports = {

  // =====================  WRITE  =====================

  Account_Create: async(Email, Password, req, res) => {
    let Check = await Account_Coll.find({email: Email}, {$exists: true}).limit(1).toArray();
    if (Check.length) {console.log("Account Exists Already"); return res.send({ "Acc_Server": "Already_Exists" }) }
  
    let Hashed_Password = await bcrypt.hash(Password, saltRounds);
    if (!Hashed_Password) { console.error("Couldn't hash Password"); return; }
  
    let uID = uuidv4();
    let CookieID = nanoid();
  
    return Account_Coll.insertOne({email: Email.toLowerCase(), password: Hashed_Password, userID: uID, cookieID: CookieID, key: crypto.randomBytes(32), settings: Helper.Settings_Template})
      .then(async() => {
        await Nord.Nord_Create("Nanode.one", CookieID, uID); ////////////////////////////////////////////
        await Nano.Account_Setup(uID);
        return res.send({ "Acc_Server": "_Registered" })
      })
      .catch(err => { console.error(`Couldn't Create Account: ${err}`); return false; })
  },
  
  Account_Write: async (userID, writeTo, data) => {
    // writeTo = "settings" , data = {"reviews": {"username": "zen", "comment": "traaaash"} }
    let newData = {}
    let current = await module.exports.Account_Get(userID, [writeTo]);

    if (typeof current[writeTo] != 'undefined') { newData[writeTo] = {...current[writeTo], ...data};
    } else { newData[writeTo] = data; }
    // newData[writeTo] = {...(current[writeTo] || {}), ...data}
  
    return Account_Coll.updateOne({userID: userID}, {$set: newData}, {upsert: true})
    .then(result => { return true })
    .catch(err => {console.error(`Couldn't update account info:  ${err}`); return false; })
  },
  
  writeShareLink: async(linkID, userID, objectID, file, mime) => {
    return Link_Coll.insertOne({url: linkID, owner: userID, object: objectID, file: file, mime: mime})
    .then(result => {
      module.exports.Account_Write(userID, "share_links", {linkID: {"file": file}});
      return true;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
  
  writeDownloadLink: async(linkID, For, userID, Size, Contents, Title) => {
    let Preview = [];
    for (i=0; i<Contents.length; i++) { if ( (/image|video|text/g).test(Contents[i].Mime) ) {Preview.push({"File":Contents[i].File_Name, "Mime": Contents[i].Mime})} };
    Contents = Contents.map(obj => ({Name: obj.Name, Mime: obj.Mime}))
    return Download_Coll.insertOne({url: linkID, for: For, owner: userID, title: Title, size: Size, contents: Contents, preview: Preview})
    .then(result => {
      if (For == "SHARE") {module.exports.Account_Write(userID, "download_links", {linkID: {"title": Title, "size": Size, "items": Contents.length}});}
      return true;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },

  // =====================  READ  =====================

  Account_Get: async (userID, wanted) => {
    // wanted = ["username", "userID"]
    return Account_Coll.find({userID: userID}, {$exists: true})
    .toArray()
    .then(account => { return {...account, ...{"password": "BLOCKED"}} })
    .catch((err) => { return {}; })
  },

  readShareLink: async (linkID) => {
    return Link_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },
  
  readDownloadLink: async (linkID) => {
    return Download_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },

  // =====================  ACTION  =====================

  Account_Login: async(Email, Password, req, res) => {
    Account_Coll.find({email: Email.toLowerCase()}, {$exists: true}).toArray(async(err, doc) => {
      if (doc && doc.length) {
        bcrypt.compare(Password, doc[0].password, async (err, result) => {
          if (!result) {
            return res.send({ "Acc_Server": "Incorrect_Cred" })
          } else {
            let Cookies = await Nord.Nord_Session("Nanode.one", doc[0].cookieID, doc[0].userID, nanoid(), new Date().getTime(), Helper.Device_Info("HTTP", req)) ///////////

            res.cookie('nord', cookie_sign.sign(Cookies.Nord, Keys.SECRET_KEY), {domain: 'nanode.one', maxAge: 31536000000, httpOnly: true, secure: true}); // 1 Year
            res.cookie('session', cookie_sign.sign(Cookies.Session, Keys.SECRET_KEY), {domain: 'nanode.one', maxAge: 31536000000, httpOnly: true, secure: true}); // 1 Day (86400 seconds in a day x 1000 to get ms)

            return res.send({ "Acc_Server": "_Login" })
          }
        })
      } else {
        return res.send({ "Acc_Server": "Incorrect_Cred" })
      }
    })
  },

}