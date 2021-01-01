var express = require('express');
var Account_Router = express.Router();

const csp = require(`helmet-csp`)
const corsOptions = {origin: 'https://account.Nanode.one'}

const crypto = require('crypto');
const validator = require('validator');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const uuidv4 = require('uuid/v4');
const { nanoid } = require('nanoid');
const cookie_sign = require('cookie-signature');

const Helper = require('../Helper.js');
const Nord = require('../Nord.js');
const Nano_Writer = require('../Nano_Writer');
const Keys = require('../Keys.js');

const Mongo_Connect = require('../Mongo_Connect.js');
const Account_Coll = Mongo_Connect.getColl("account");



//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Account_Router.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
Account_Router.use(express.urlencoded({extended: false}))
Account_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'https://Nanode.one/socket.io/','wss://Nanode.one/socket.io/'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));


Account_Router.use('/login', function(req, res, next) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\login.html'); })
Account_Router.get('/', Nord.Middle, async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/account.html', {extensions: ['html', 'htm']}) });


app.post('/login', async (req, res) => {
  if ( req.body.email && req.body.password ) {
    await Account_Login(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Incorrect_Cred" })
  }
})

app.post('/signup', async (req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    await Account_Create(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Invalid_Email" })
  }
})


// ----- MONGO -----

Account_Create = async(Email, Password, req, res) => {
  let Check = await Account_Coll.find({email: Email}, {$exists: true}).limit(1).toArray();
  if (Check.length) {console.log("Account Exists Already"); return res.send({ "Acc_Server": "Already_Exists" }) }

  let Hashed_Password = await bcrypt.hash(Password, saltRounds);
  if (!Hashed_Password) { console.error("Couldn't hash Password"); return; }

  let UserID = uuidv4();
  let CookieID = nanoid();

  return accountDB.insertOne({email: Email.toLowerCase(), password: Hashed_Password, userID: UserID, cookieID: CookieID, key: crypto.randomBytes(32), settings: Helper.Settings_Template})
    .then(async() => {
      await Nord.Nord_Create("Nanode.one", CookieID, UserID); ////////////////////////////////////////////
      await Nano_Writer.createUserJSON(UserID);
      await Nano_Writer.setUpDrive(UserID);
      return res.send({ "Acc_Server": "_Registered" })
    })
    .catch(err => { console.error(`Couldn't Create Account: ${err}`); return false; })
},

Account_Login = async(Email, Password, req, res) => {
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

module.exports = Account_Router;