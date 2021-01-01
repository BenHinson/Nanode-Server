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

const Nano_Reader = require('../Nano_Reader.js');
const Nano_Writer = require('../Nano_Writer.js');
const Helper = require('../helper.js');
const Nord = require('../Nord.js');

// const Encryptor = require('../Encryptor.js');

const codexConverter = {1: "Text", 2: "Video", 3: "Audio"}

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

Drive_Router.use(Nord.Middle)


Drive_Router.get('/', async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/drive.html', {extensions: ['html', 'htm']}) })

Drive_Router.use('/storage/:content', async (req, res, next) => {
  let userID = req.headers.uID;
  
  let WantedURL = req.params.content;
  let imgHeight = (req.query.h == "null") ? null : (typeof req.query.h == "string") ? parseInt(req.query.h) : undefined;
  let imgWidth = (req.query.w == "null") ? null : (typeof req.query.w == "string") ? parseInt(req.query.w) : undefined;
  let codex = parseInt(req.query.cdx);

  Type = await Nano_Reader.returnInformation(userID, (codex ? "CodexInfo" : "Information"), WantedURL, (codex ? [codexConverter[codex], "Type"] : ["Type"]))

  if (typeof Type !== 'undefined' && Type.length) {
    let File_Wanted = uuidv3(WantedURL, userID);

    if (codex) {
      fs.readFile('F:\\Nanode\\UsersContent\\'+File_Wanted, function(err, data) {
        if (err) {console.log("Couldn't Find File");} else {
          res.setHeader("Content-Type", Type);
          return res.end(data);
        }
      });
    } else {
      fs.readFile('F:\\Nanode\\UsersContent\\'+File_Wanted, function(err, data) {
        if (err) {console.log("Couldn't Find File");} else {
          res.setHeader("Content-Type", Type[0].mimeT);
          res.writeHead(200);
          if ( Type[0].isImg && !Type[0].mimeT.includes("svg") && (typeof imgHeight == "number" || imgHeight == null) && (typeof imgWidth == "number" || imgWidth == null) ) {
            sharp(data)
            .resize({fit: sharp.fit.contain, width: imgWidth, height: imgHeight})
            .toBuffer((err, data, info) => { return res.end(data); })
          } else { return res.end(data); }
        }
      })
    }
    return;
  }
})

Drive_Router.use('/user/:section?/:area?/:item?', async (req, res, next) => {
  let userID = req.headers.uID;

  const Section = Helper.capitalize(req.params.section);
  const Area = Helper.CheckConvertParam(req.params.area);
  const Item = Helper.CheckConvertParam(req.params.item);

  if (userID && Section) {
    let usersContent = await loadJsonFile('F:\\Nanode\\UserJSON\\'+userID+".json");
    var WantedData = {};

    if (Section && Area && Item && Item != "Security" && usersContent[Section][Area][Item]) {
      var WantedData = usersContent[Section][Area][Item];
    } else if (Section && Area && usersContent[Section][Area]) {
      var WantedData = usersContent[Section][Area];
    } else if (Section && usersContent[Section]) {
      var WantedData = usersContent[Section]
    } else { return res.send({"Error": "Invalid Request"}) }

    if (WantedData.UUID) { WantedData.Security = Helper.securityValue(WantedData); } 
    else { for (item in WantedData) {
      WantedData[item].Security = Helper.securityValue(WantedData[item]);
      // MongoDB Search for the userid if it doesnt match the userID
    } }

    return res.send( WantedData )
  }
  return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');
})

Drive_Router.use('/folder/:oID', async (req, res, next) => {
  let userID = req.headers.uID;
  let oID = req.params.oID;

  if (userID && oID) {
    let itemSecurity = await Helper.securityChecker(false, userID, oID, "Access");
    if (itemSecurity) { return res.send({"Locked": itemSecurity}); return; }
    else {
      let result = await Nano_Reader.returnInformation(userID, "Main_Contents", oID, "")
      if (result) { return res.send({"Parent": result[0], "Contents": result[1] });}
    }
  }
  return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');
})

Drive_Router.use('/settings', async (req, res, next) => {
  if (req.headers.uID != "null") {
    let settings = await Nano_Reader.Account_Get(req.headers.uID, ["settings"]);
    if (typeof settings.settings == 'undefined' || settings.settings == false) {await Nano_Writer.Account_Write(req.headers.uID, "settings", Helper.Settings_Template); }
    else { res.send({"Settings": settings.settings}) }
  } 
  else { res.send({"Error": "NOT_LOGGED_IN"}) }
})

Drive_Router.post('/auth', async (req, res) => {
  console.log("Have a key sent to the user that unlocks it for the session. Various Reasons...")
  const {body} = req;
  if (body && req.headers.uID != "null") {
    let access = await Helper.securityChecker(body.Entries, req.headers.uID, body.Item, "Access");
    if (access === true) {
      let result = await Nano_Reader.returnInformation(req.headers.uID, "Main_Contents", body.Item, "")
      if (result) { return res.status(200).send({"Parent": result[0], "Contents": result[1] }); }
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
      Meta: body.meta,
    })
    
    if (result.written) { // Entire File written, add to Upload_Tree and request next file.
      // Encrypt File here
      await Write_To_User_File(req.headers.uID, result.file_oID, body.meta);
      // Add the Size to the users account.
      return res.status(200).json({ "status": "Complete" });
    }
    return res.status(200).json({ "status": result });
   } else {
    return res.status(403).json({ "status": "Incomplete" });
  }
})

File_Write = async(chunk) => {
  const {user, id, index, total, FileArray, Meta} = chunk;

  const Chunk_Storage = 'F://Nanode/Upload/Chunks/';
  // const End_Storage = 'F://Nanode/Upload/Complete/';
  const End_Storage = 'F://Nanode/UsersContent/';

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

Write_To_User_File = async(user, oID, item) => {
  if (!Upload_Object_Tree[user]) { Upload_Object_Tree[user] = []; }
  let relative_path = item.relative_path.split('/');
  let fID = await Create_Folders(relative_path.slice(0, -1), user, item);
  await Create_New_Item(user, oID, fID ?? item.parent, item);
}
Create_Folders = async(relative_path, user, item) => {
  let previous_Folder;
  for (let i=0; i<relative_path.length; i++) {
    if (!relative_path[i]) { continue; }
  	let found = Upload_Object_Tree[user].find(item => item[relative_path[i]]);
  	if (found) { previous_Folder = found[relative_path[i]].id; continue; }
    let fID = uuidv1();
    Upload_Object_Tree[user].push( {[relative_path[i]]: {"id": fID}});
    await Create_New_Item(user, fID, previous_Folder ?? item.parent, {"name": relative_path[i], "span": item.span});
    previous_Folder = fID;
  }
  return previous_Folder;
  // let lastFolder = Upload_Object_Tree[user].find(item => item[relative_path.slice(-1)]); // I may be able to remove these and replace with the previous_Folder variable;
  // return relative_path.length ? lastFolder[relative_path.slice(-1)].id : null; // I may be able to remove these and replace with the previous_Folder variable;
}
Create_New_Item = async(user, oID, pID, item) => {
  // oID: object_ID, fID: folder_ID, pID: parent_ID, uID: user_ID
  let datenow = new Date(Date.now());

  let New_Item = {
    "UUID": oID,
    "Name": {"Cur":Helper.truncate(item.name, 128)},
    "Span": Helper.truncate(item.span, 128),
    "Parent": Helper.truncate(pID, 128),
    "Size": item.size ?? '',
    "Type": {"isFi": item.isFi ?? false},
    "Time":{"CreaT":datenow, "CreaW":user, "ModiT": item.modified ? new Date(item.modified).toISOString() : datenow, "ModiW": user}
  };
  if (item.isFi) {
    New_Item.Type['mimeT'] = item.type;
    New_Item.Type['isImg'] = item.type.includes('image/') ? item.type : '';
  }
  await Nano_Writer.writeJSONObject(user, "New", pID, item.isFi ? "File" : "Folder", New_Item);
}




module.exports = Drive_Router;