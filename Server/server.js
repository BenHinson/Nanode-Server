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

JSZip = require("jszip");
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
}

const Keys = require('./Keys.js')
const Mongo_Connect = require('./Mongo_Connect');

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
  

  io
  .use(async(socket, next) => { // Authentication
    let Account = await Nord.Check("SOCKET", socket);
    if (!Account) {console.log("Unauth - Socketio"); return next(new Error("Unauthorized")); }
    else {socket.uID = Account.uID; return next(); };
    // return res.redirect('https://account.Nanode.one/login')
  })

  .on('connection', function(socket) {
    
    socket.on('ItemCreate', async (data) => {
      let Write = {
        "user": socket.uID,
        "type": data.type,
        "section": Helper.validateClient("section", data.section) ? data.section : "main",
        "parent": data.type == "Span" ? "homepage" : Helper.truncate(data.parent, 128),
        "data": data.type == "Span"
          ? {"name": Helper.truncate(data.name, 128)}
          : {
            "id": uuidv1(),
            "name": Helper.truncate(data.name, 128),
            "parent": Helper.truncate(data.parent, 128),
            "type": {
              "file": false,
              "mime": "FOLDER"
            },
            "security": {"pass": Helper.truncate(data.Options.pass, 256), "Pin": Helper.truncate(data.Options.pPin, 256)},
            "colour": data.Options.colour,
            "description": Helper.truncate(data.Options.description, 512),
            "time": {
              "created": {
                "stamp": Helper.timeNow(),
                "who": socket.uID
              }
            }
          }
      }

      if (data.type.match(/Item|Folder|File|Span/i)) {
        if (await Nano.Write(Write)) {
          let Result = await Nano.Read({"user": socket.uID, "type": "ID", "section": data.section, "ids": [data.directory]});
          if (Result) {
            Result = Result[data.directory] || Result;
            socket.emit('Directory', {"Parent": {"name": Result.name || "homepage", "id": Result.id || "homepage"}, "Contents": Result.contents || Result}) };
        }
      }      
    })

    socket.on('ItemEdit', async (data) => {
      let Edit = {
        "user": socket.uID,
        "type": data.action,
        "section": Helper.validateClient("section", data.section) ? data.section : "main",
        "id": data.ID,
      };

      if (data.action == "DATA") { Edit.changeTo = data.EditData; }
      else if (data.action == "MOVE") { Edit.moveTo = data.To; }

      if (await Nano.Edit(Edit)) {
        // if (data.Path) { // Path states that we send back directory to User
        //   let Result = await Nano.Read({"user": Edit.user, "type": "ID", "section": Edit.section, "ids": [data.Path]});
        //   if (Result) {
        //     Result = Result[data.Path] || Result; 
        //     socket.emit('Directory', {"Parent": {"name": Result.name || "homepage", "id": Result.id || "homepage"}, "Contents": Result.contents || Result}) }
        // }
      }
      return;
    })

    ////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////

    socket.on('Share', async({Action, objectID, Params}) => {
      if (Action == "Link") {
        let linkID = '';
        let file_name = uuidv3(objectID, socket.uID);
        let Called_Information = await Nano.Read({"user": socket.uID, "type": "SPECIFIC", "section": Params.section, "ids": [objectID], "keys": ["share","type"]});
        Called_Information = Called_Information[objectID];
        if (Called_Information.share && Called_Information.share.link) { linkID = Called_Information.share.link.url; }
        else if (Called_Information) {
          linkID = await generateShareLinkID(socket.uID, objectID, file_name, Called_Information.type.mime);
          await Nano.Edit({ "user": socket.uID, "type": "DATA", "section": Params.section, "id": objectID, "changeTo": {"share": {"link": {"url": linkID}}} })
        }

        let linkURL = 'https://link.nanode.one/'+linkID;
        socket.emit('Link_Return', "LINK", linkURL);
      }
    })

    generateShareLinkID = async (userID, objectID, file_name, mime) => {
      let linkID = nanoid(16);
      let linkinDB = await Nano_Writer.writeShareLink(linkID, userID, objectID, file_name, mime);
      if (linkinDB === false) { return linkID = generateShareLinkID(userID, objectID, file_name, mime); }
      return linkID;
    }


    socket.on('downloadItems', async (For, DownloadItems) => {
      console.log("Yeah... this is going to need some review. Potentially a whole rewrite. Nano.Read TREE should work though (downloadItems)"); return;
      if (For == "SELF" || For == "SHARE") {
        // Limit Download requests
        if (socket.uID) {
          zipForDownload(For, await Nano_Reader.returnInformation(socket.uID, "Main_Children", DownloadItems), socket.uID);
        }
      }
    })

    zipForDownload = async (For, ToDownload, userID) => {
      var zip = new JSZip();
      var BaseParent = zip.folder("Download");

      let zipSize = 0;
      let zipContents = [];
      let zipTitle = '';

      zipLooper(ToDownload, BaseParent);

      async function zipLooper(Items, Parent) {
        for (Contents in Items) {
          if (Items[Contents].Name) {
            let fileData = fs.readFileSync( "F:\\Nanode\\UsersContent\\"+Items[Contents].File_Name);
            let fileName = (Items[Contents].Name.split(".").shift())+"."+mime.extension(Items[Contents].Mime);
            Parent.file(fileName, fileData);
            zipSize += Items[Contents].Size;
            zipContents.push({"Name": Items[Contents].Name, "Mime":Items[Contents].Mime, "File_Name":Items[Contents].File_Name});
          } else {
            if (!zipTitle.length) { zipTitle = Contents }
            SubParent = Parent.folder(Contents)
            zipLooper(Items[Contents], SubParent)
          }
        }
      }

      if (!zipTitle.length) { zipTitle = "Collection of Files" }

      let downloadID = await generateDownloadLinkID(For, userID, zipSize, zipContents, zipTitle);

      zip
        .generateNodeStream({type:'nodebuffer',streamFiles:true})
        .pipe(fs.createWriteStream("F:\\Nanode\\UserDownloads\\Nanode_"+downloadID+".zip"))
        .on('finish', function() {
          let downloadURL = 'https://link.nanode.one/download/'+downloadID;
          socket.emit('Link_Return', "DOWNLOAD", downloadURL);
        })
    }
    generateDownloadLinkID = async (For, userID, Size, Contents, Title) => {
      let linkID = nanoid(24);
      let linkinDB = await GetSet.writeDownloadLink(linkID, For, userID, Size, Contents, Title);
      if (linkinDB === false) { return linkID = generateDownloadLinkID(For, userID, Size, Contents, Title); }
      return linkID;
    }

    ////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////

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

    socket.on('Bin', async (CallData) => {  console.log("Also Deprecated, Call Normally and set Section to Bin."); return;

      let Action = CallData.emitAction; let Path = CallData.binItem; let Of = CallData.Of

      if (Action != "Call") { await Nano_Writer.writeJSONObject(socket.uID, "Bin", Path, Of, Action); }
      let binContent = await Nano_Reader.returnInformation(socket.uID, "Contents", "Bin", Of);
      socket.emit('BinContent', binContent)
    }) 



    socket.on('CallSettings', async (action, data) => {
      if (socket.uID) {
        if (action == "Read") {
          let settings = await GetSet.Account_Get(socket.uID, ["settings"]);
          if (typeof settings.settings == 'undefined' || settings.settings == false) {await GetSet.Account_Write(socket.uID, "settings", Helper.Settings_Template); }
          else { socket.emit('Settings', settings.settings) }
        } else if (action == "Write") { // writes settings one at a time.
          await GetSet.Account_Write(socket.uID, "settings", { [data[0]]: data[1] });
        }
      } 
      else { socket.emit('NoLoggedSettings') }
    })
  })
})