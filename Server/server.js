// Module Calls
const fs = require('fs-extra');
const path = require('path');

const CryptoJS = require("crypto-js");
const crypto = require('crypto');
const uuid = require('uuid');
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');
const { nanoid } = require("nanoid");


const bodyParser = require('body-parser');
const helmet = require('helmet')
const csp = require(`helmet-csp`)
const cors = require('cors');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const subdomain = require('express-subdomain');
express = require('express');
app = express();
router = express.Router({mergeParams: true});

const ejs = require('ejs');

mime = require('mime-types');


Start_Server = function() {
  options = {
    key: fs.readFileSync('Server/auth/nanode.one.key'),
    cert: fs.readFileSync('Server/auth/nanode.one.crt'),
    ca: fs.readFileSync('Server/auth/origin_ca_rsa_root.pem'),
  }

  // Start Server
  const server = require('https').createServer(options, app);
  global.io = require('socket.io')(server, {cookie: false});

  // Setup Server
  app.set('view-engine', 'ejs');
  app.use(helmet());
  app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
  app.use(cookieParser(Keys.SECRET_KEY));
  cors({credentials: true, origin: true})
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json({limit: '50mb'}))
  app.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
  app.use(csp({
    directives: {
      connectSrc: ["'self'", 'https://nanode.one/socket.io/','wss://nanode.one/socket.io/'],
      styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
    }
  }));
  app.use(helmet.featurePolicy({features: {camera: ["'none'"], microphone: ["'none'"],}}))
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({ message: err.message, error: err });
  })
  
  // Server Listen
  server.listen(443, () => { console.log('Running on Port', server.address().port) });

  // Subdomains
  app.use(subdomain('drive', require('./routes/drive')))
  app.use(subdomain('account', require('./routes/account')))
  app.use(subdomain('dev', require('./routes/dev')))
  app.use(subdomain('link', require('./routes/link')))
  app.use(subdomain('spiral', require('./routes/spiral')))
  app.use(express.static('../Nanode Client'));

  // ========== Error page Fallback ==========
  app.use(function (req, res, next) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })
}

const Keys = require('./Keys.js')
const Mongo_Connect = require('./Mongo_Connect');
const { write } = require('fs');

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// A nice little article and website for tips and tricks
// https://www.thatsanegg.com/blog/10-javascript-oneliners-you-have-got-to-add-your-arsenal-as-a-developer/

Mongo_Connect.connectToServer(function(err, client) {
  if (err) {console.log(`ERROR: ${err}`)}
  console.log("Successful MongoDB Connection.");

  Start_Server();

  const Helper = require('./Helper.js');
  const Nord = require('./Nord.js');
  const Nano = require('./Nano.js');
  const GetSet = require('./GetSet.js');
  const Send = require('./Send.js');
  

  io
  .use(async(socket, next) => { // Authentication
    let Account = await Nord.Check("SOCKET", socket);
    if (!Account) {console.log("Unauth - Socketio"); return next(new Error("Unauthorized")); }
    else {socket.uID = Account.uID; return next(); };
    // return res.redirect('https://account.Nanode.one/login')
  })

  .on('connection', function(socket) {

    socket.on('Codex', async (CallData) => {  console.log("Deprecated No...? Port Calls over to new Nano."); return;

      let Action = CallData.emitAction; let Codex = CallData.CodexWanted; let Path = CallData.CodexPath; let Data = CallData.Data; let itemNumber = CallData.itemNumber;

      let codexContents = ''

      if (socket.uID && Codex.match(/Text|Video|Audio/)) {
        if (Action == "Call") {
          codexContents = await Nano_Reader.returnInformation(socket.uID, Codex, "Codex", Path);
        }
        else if (Action == "Call_Children") {
          codexContents = await Nano_Reader.returnInformation(socket.uID, "Codex_Children", Codex, Path)
        }
        else if (Action == "Make") {
          await Nano_Writer.writeJSONObject(socket.uID, "Codex", Codex, "Make", {"Name": Data.Name, "Parent": Path})
          codexContents = await Nano_Reader.returnInformation(socket.uID, Codex, "Codex", Path);
        }
        else if (Action == "Move") {
          await Nano_Writer.writeJSONObject(socket.uID, "Codex", Codex, "Move", {"OID": Data.OID, "To": Data.To, "Parent": Path})
          return;
        }
        else if (Action == "Upload") {
          if (Codex == "Audio") { 
            var New_Codex_Item = { "Name": Data.Name, "Duration": Data.Duration, "Size": Data.Size, "Type": Data.Type, "Data": Data.Data, "Parent": Path } }
          else { 
            var New_Codex_Item = { "Name": Data.Name, "F100C": Data.F100C, "Size": Data.Size, "Type": Data.Type, "Data": Data.Data, "Parent": Path } }
          await Nano_Writer.writeJSONObject(socket.uID, "Codex", Codex, "", New_Codex_Item);
          socket.emit('CodexProgress', itemNumber);
          return;
        }
        else if (Action == "Delete") {
          await Nano_Writer.writeJSONObject(socket.uID, "Delete", "Codex", Codex, Path)
          return;
        }
        socket.emit('CodexContent', codexContents)
      } else {
        console.log("Not Logged In @ "+socket.uID);
      }
    })


    socket.on('CallSettings', async (action, data) => {
      if (socket.uID) {
        if (action == "Read") {
          let settings = await GetSet.Account_Get(socket.uID, ["settings"]);
          if (typeof settings.settings == 'undefined' || settings.settings == false) {
            await GetSet.Account_Write({ "user": socket.uID, "type": "Set", "parentKey": "settings", "data": Helper.Settings_Template }); }
          else { socket.emit('Settings', settings.settings) }
        } else if (action == "Write") { // writes settings one at a time.
          await GetSet.Account_Write({ "user": socket.uID, "type": "Set", "parentKey": "settings", "childKey": data[0], "data": data[1] });
        }
      } 
      else { socket.emit('NoLoggedSettings') }
    })
  })
})