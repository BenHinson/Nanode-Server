var fs = require('fs-extra');
var express = require('express');
var Drive_Router = express.Router();

const sanitize = require("sanitize-filename");
const csp = require(`helmet-csp`)
const cors = require('cors');
const corsOptions = {origin: 'https://drive.Nanode.one'}
const bodyParser = require('body-parser');

const mime = require('mime');
const sharp = require('sharp');

const crypto = require('crypto');
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');

const Nano = require('../Nano.js');
const Nord = require('../Nord.js');
const GetSet = require('../GetSet.js');
const Helper = require('../helper.js');

// const Encryptor = require('../Encryptor.js');

const codexConverter = {1: "Text", 2: "Video", 3: "Audio"};
const UploadDrive = 'F';

const loadJsonFile = require('load-json-file');

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Drive_Router.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
Drive_Router.use(bodyParser.urlencoded({extended: true}));
Drive_Router.use(bodyParser.json({limit: '50mb'}))
Drive_Router.use(cors(corsOptions))
Drive_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'https://upload.nanode.one', 'https://Nanode.one/socket.io/','wss://Nanode.one/socket.io/'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

Drive_Router.use(Nord.Middle);


Drive_Router.get('/', async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/drive.html', {extensions: ['html', 'htm']}) })

Drive_Router.use('/storage/:content', async (req, res, next) => {
  let userID = req.headers.uID;
  
  let WantedURL = req.params.content;
  if (!Helper.validateClient('nanoID', WantedURL)) {return Helper.ErrorPage(res)};
  let imgHeight = (req.query.h == "null") ? null : parseInt(req.query.h || null);
  let imgWidth = (req.query.w == "null") ? null : parseInt(req.query.w || null);
  let codex = parseInt(req.query.cdx);

  let Type = await Nano.Read({"user": userID, "type": "SPECIFIC", "section": (codex ? "codex" : "main"), "ids": [WantedURL], "keys": ["type"]});
  Type = Type[WantedURL].type;

  if (typeof Type !== 'undefined' && Type.mime) {
    fs.readFile(`F:\\Nanode\\Files\\Mass\\${uuidv3(WantedURL, userID)}`, function(err, data) {
      if (err) {console.log("File Not Found"); return Helper.ErrorPage(res);}
      else {
        res.setHeader('Content-Type', Type.mime);
        res.writeHead(200);
        if (!codex && Type.file && !Type.mime.includes("svg")) {
          sharp(data)
          .resize({fit: sharp.fit.contain, width: imgWidth || null, height: imgHeight || null})
          .toBuffer((err, data, info) => { return res.end(data); })
        } else {res.end(data);}
      }
    })
    return;
  }
})

Drive_Router.use('/user/:section?/:item?', async (req, res, next) => {
  const section = Helper.validateClient('section', req.params.section) ? req.params.section : 'main';
  const item = Helper.validateClient('nanoID', req.params.item) ? req.params.item : undefined;

  if (req.headers.uID && section && item) {
    let nano = await Nano.Read({"user": req.headers.uID, "type": "ID", "section": section, "ids": [item], "contents": false});
    if (nano[item]) {
      nano[item].security = Helper.securityValue(nano[item]);
      nano[item].contents = {};
    }
    return res.status(200).send( nano )
  } else { return res.status(400).send({"Error": "Invalid Request"}) }
  return Helper.ErrorPage(res);
})

Drive_Router.use('/folder/:oID', async (req, res, next) => {
  let userID = req.headers.uID;
  let oID = req.params.oID.replace('$', '');
  let section = Helper.validateClient(req.query.s) ? req.query.s : "main";

  if (userID && oID) {
    let itemSecurity = await Helper.securityChecker({"userID":userID, "Section": section, "oID":oID, "Wanted": "Access"});
    if (itemSecurity) { return res.send({"Locked": itemSecurity}); return; }
    else {
      let Result = await Nano.Read({"user": userID, "type": "ID", "section": section, "ids": [oID], "contents": false});
      if (Result) { Result = Result[oID] || Result;
        return res.send({
          "Parent": {"name": Result.name || "homepage", "id": Result.id || "homepage"},
          "Contents": Result.id
            ? { [Result.id]: { "name": Result.name, "contents": Result.contents } } // For Folders
            : Result // For Homepage
        });
      }
    }
  }
  return Helper.ErrorPage(res);
})

Drive_Router.use('/settings', async (req, res, next) => {
  if (req.headers.uID != "null") {
    let accountData = await GetSet.Account_Get(req.headers.uID, ["settings", "plan"]);
    accountData = accountData[0];
    if (typeof accountData.settings == 'undefined' || accountData.settings == false) {
      await GetSet.Account_Write({ "user": req.headers.uID, "type": "Set", "parentKey": "settings", "data": Helper.Settings_Template }); 
    }
    else { res.send({"Settings": accountData.settings, "Plan": {"max": accountData.plan.max, "used": accountData.plan.used}}) }
  } 
  else { res.send({"Error": "NOT_LOGGED_IN"}) }
})

Drive_Router.post('/auth', async (req, res) => {
  console.log("Have a key sent to the user that unlocks it for the session. Various Reasons...")
  const {body} = req;
  if (body && req.headers.uID != "null") {
    let access = await Helper.securityChecker({"Input":body.Entries, "userID":req.headers.uID, "oID":body.Item, "Wanted":"Access"});
    if (access === true) {
      let Result = await Nano.Read({"user": req.headers.uID, "type": "ID", "section": "main", "ids": [body.Item]});
      if (Result) { Result = Result[oID] || Result; return res.send({"Parent": {"name": Result.name || "homepage", "id": Result.id || "homepage"}, "Contents": Result.contents || Result });}
    }
  }
  return res.status(401).send({"Error": "Invalid"});
})


Upload_Object_Tree = {}; // Seperates Uploads by Account IDs

Drive_Router.post('/upload/', async (req, res, next) => {
  const {body} = req;
  if (body.message) {
    if (body.message == "Queue_Empty" && Upload_Object_Tree[req.headers.uID]) {Upload_Object_Tree[req.headers.uID] = []; return res.sendStatus(200);}
    if (body.message = "Cancelled") { console.log("Upload Cancelled, empty Tree and Remove file chunks?") }
  }

  if (body.meta && body.chunk_info && body.file && (body.meta.size == body.chunk_info.total_size)) {

    let result = await File_Write ({
      user: req.headers.uID,
      id: body.meta.id,
      index: body.chunk_info.index,
      total: body.chunk_info.total_chunks,
      FileArray: Buffer.from(body.file),
    })
    
    if (result.written) { // Entire File written, add to Upload_Tree and request next file.
      // Encrypt File here
      await Write_To_User_File(req.headers.uID, result.file_oID, body.meta);
      return res.status(200).json({ "status": "Complete" });
    }
    return res.status(200).json({ "status": result });
   } else {
    return res.status(403).json({ "status": "Incomplete" });
  }
})

File_Write = async(chunk) => {
  const {user, id, index, total, FileArray} = chunk;

  const Chunk_Storage = 'F://Nanode/Files/Chunks/';
  const End_Storage = `${UploadDrive}://Nanode/Files/Mass/`;
  // const End_Storage = `${UploadDrive}://Nanode/Files/Trail/`;

  let ThisChunkName = Chunk_Storage+["CHUNK", id, index].join('-');
  let PreviousChunkName = Chunk_Storage+["CHUNK", id, index-1].join('-');

  if (index > 0) { // Add to Previous
    await fs.promises.appendFile(PreviousChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
    await fs.promises.rename(PreviousChunkName, ThisChunkName).catch(err => {console.log(err); return "Failed"});
  } else {
    await fs.promises.writeFile(ThisChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
  }
  if (index >= total - 1) { // Finish Up by Moving File and Renaming
    let file_oID = uuidv1();
    await fs.promises.rename(ThisChunkName, End_Storage+uuidv3(file_oID, user)).catch(err => {console.log(err); return "Failed"});
    return {"written": true, "file_oID": file_oID};
  }
  return "Success";
}

Write_To_User_File = async(user, oID, meta) => {
  if (!Upload_Object_Tree[user]) { Upload_Object_Tree[user] = []; }
  let relative_path = meta.relative_path.split('/');
  let fID = await Create_Folders(relative_path.slice(0, -1), user, meta);
  await Create_New_Item(user, oID, fID ?? meta.parent, meta);
}
Create_Folders = async(relative_path, user, meta) => {
  let previous_Folder;
  for (let i=0; i<relative_path.length; i++) {
    if (!relative_path[i]) { continue; }
  	let found = Upload_Object_Tree[user].find(item => meta[relative_path[i]]);
  	if (found) { previous_Folder = found[relative_path[i]].id; continue; }
    let fID = uuidv1();
    Upload_Object_Tree[user].push( {[relative_path[i]]: {"id": fID}});
    await Create_New_Item(user, fID, previous_Folder ?? meta.parent, {"section": meta.section, "name": relative_path[i]});
    previous_Folder = fID;
  }
  return previous_Folder;
  // let lastFolder = Upload_Object_Tree[user].find(item => meta[relative_path.slice(-1)]); // I may be able to remove these and replace with the previous_Folder variable;
  // return relative_path.length ? lastFolder[relative_path.slice(-1)].id : null; // I may be able to remove these and replace with the previous_Folder variable;
}
Create_New_Item = async(user, oID, pID, meta) => {
  // oID: object_ID, pID: parent_ID
  const {section, name, type, size, isFi, modified} = meta;
  let datenow = Helper.timeNow();

  let ItemData = {
    "id": oID,
    "name": Helper.truncate(name, 128),
    "parent": Helper.truncate(pID, 128),
    "size": size ?? 1,
    "type": {
      "file": isFi ?? 'FOLDER',
      "mime": type ?? 'FOLDER'
    },
    "time": {
      "created": {
        "stamp": datenow,
        "who": user
      }
    }
  }
  modified ? ItemData.time['modified'] = {"stamp": new Date(modified).toISOString(), "who": user} : '';
  isFi ? ItemData['contents'] = {"drive": UploadDrive, "file": uuidv3(oID, user)} : '';

  let written = await Nano.Write({
    "user": user,
    "type": "Item",
    "section": Helper.validateClient("section", section) ? section : 'main',
    "parent": Helper.truncate(pID, 128),
    "data": ItemData
  })
  if (written) {await GetSet.Account_Write({ "user": user, "type": "Increment", "parentKey": "plan", "childKey": "used", "data": written})};
}


module.exports = Drive_Router;