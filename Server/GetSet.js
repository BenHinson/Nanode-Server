const Mongo_Connect = require('./Mongo_Connect.js');

const Account_Coll = Mongo_Connect.getColl('account');
const Link_Coll = Mongo_Connect.getColl('link');
const Download_Coll = Mongo_Connect.getColl('download');

const Nano = require('./Nano.js');
const Nord = require('./Nord.js');
const Keys = require('./Keys.js');
const Helper = require('./helper.js');

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cookie_sign = require('cookie-signature');
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
    let Username = Email.split('@')[0].replace(/[^a-zA-Z +]/g,' ').replace(/  +/g, ' ');
  
    return Account_Coll.insertOne({"email": Email.toLowerCase(), "password": Hashed_Password, "passwordLength": Password.length, "userID": uID, "photo": "", "username": Username, "cookieID": CookieID, "key": crypto.randomBytes(32), "settings": Helper.Settings_Template, "plan": (10 * 1024 * 1024 * 1024) })
      .then(async() => {
        await Nord.Nord_Create("Nanode.one", CookieID, uID);
        await Nano.Account_Setup(uID);
        return res.send({ "Acc_Server": "_Registered" })
      })
      .catch(err => { console.error(`Couldn't Create Account: ${err}`); return false; })
  },

  Account_Write: async(Params) => {
    const {user, type, parentKey, childKey, data} = Params;
    let MongoEdit = {};
  
    if (type == "Increment") {  MongoEdit.$inc = { [`${parentKey}.${childKey}`]: data || 1 } }
    else if (type == "Set") { MongoEdit.$set = { [`${parentKey}.${childKey ? childKey : ''}`]: data } }
    else {return false;}
  
    return Account_Coll.updateOne( {"userID": user}, MongoEdit )
    .then(result => {return true})
    .catch(err => {console.error(`Couldn't update account info:  ${err}`); return false; })
  },
  
  writeShareLink: async(linkID, userID, objectID, file, mime) => {
    return Link_Coll.insertOne({url: linkID, owner: userID, object: objectID, file: file, mime: mime})
    .then(result => {
      module.exports.Account_Write({ "user": userID, "type": "Set", "parentKey":"share_links", "childKey":linkID, "data": {"file": file} });
      return true;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
  
  writeDownloadLink: async(linkID, For, userID, data) => {
    Contents = data.contents.map(item => ({"Name": item.Name, "Mime": item.Mime}))
    return Download_Coll.insertOne({"url": linkID, "for": For.match(/SELF|SHARE/) ? For : "SELF", "owner": userID, "title": data.title, "size": data.size, "contents": Contents})
      .then(result => {
        if (For == "SHARE") {
          module.exports.Account_Write({ 
            "user": userID, 
            "type":"Set", 
            "parentKey": "download_links", 
            "childKey": linkID, 
            "data": {"title": data.title, "size": data.size, "items": Contents.length} });}
        return linkID;
      })
      .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
  
  incrementDownloadCount: async(url) => {
    return Download_Coll.updateOne( 
      {"url": url}, 
      { $inc: { "count": 1 } }
    )
  },

  // =====================  READ  =====================

  Account_Get: async(uID, query) => {
    let Project = {};
    ["password", "cookieID", "key"].forEach(Key => delete query[Key]);
    query.forEach(item => { Project[item] = 1; });

    return await Account_Coll.aggregate([
      { $match: { 'userID': uID } },
      { $project: Project }
    ]).toArray();
  },

  securityChecker: async({userID, section, oID, wanted, input}) => {
    if (oID.match(/home|homepage/i)) { return false; }
    if (!section) { console.log("Security Checker Requires a section. Must check all calls to securityChecker"); return false; }

    let securityLookup = await Nano.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [oID], "keys": ["security"]});
    if (!securityLookup[oID].security) { return false; }
    let NanoSecu = securityLookup[oID].security;
    
    let level = 0;
    let Type = [];
    
    if (NanoSecu.pass) { level++; Type.push("Password") }
    if (NanoSecu.pin) { level++; Type.push("Pin") }
    // if (NanoSecu.time)
  
    if (wanted == "Amount") { return level; }
    else if (wanted == "Access") {
      if (!input) { return Type.length >= 1 ? Type : false; }
      Object.keys(NanoSecu).forEach(k => (!NanoSecu[k] && NanoSecu[k] !== undefined) && delete NanoSecu[k]);
      Object.keys(input).forEach(k => (!input[k] && input[k] !== undefined) && delete input[k]);
      return JSON.stringify(NanoSecu) === JSON.stringify(input) ? true : false;
    }
    return false;
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