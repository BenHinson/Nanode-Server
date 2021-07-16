var fs = require('fs-extra');
var express = require('express');
var Drive_Router = express.Router();

const csp = require(`helmet-csp`)
const cors = require('cors');
const corsOptions = {origin: 'https://drive.Nanode.one'}
const bodyParser = require('body-parser');

const crypto = require('crypto');
const uuidv3 = require('uuid/v3');
const { nanoid } = require('nanoid');

const Nord = require('../../Middleware/Nord.js');
const Node = require('../../Node/node.js');
const ReadWrite = require('../../Nano/ReadWrite.js');
const Modify = require('../../Nano/modify.js');
const Search = require('../../Node/Search.js');
const Security = require('../../Node/security.js');
const Recent = require('../../Node/recent.js');
const Account = require('../../Account/account.js');
const Links = require('../../Account/links.js');
const Helper = require('../../helper.js');
const Send = require('../send.js');

// const Encryptor = require('../Encryptor.js');

const codexConverter = {1: "Text", 2: "Video", 3: "Audio"};

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

// Drive_Router.use(Nord.Middle); // Cannot set, as this then runs for every static item too. js/css files, images etc...

Drive_Router.get('/', Nord.Middle, async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/drive.html', {extensions: ['html', 'htm']}) })

Drive_Router.use('/storage/:content', Nord.Middle, async (req, res, next) => {
  let userID = req.headers.uID;
  
  let WantedURL = req.params.content;
  if (!Helper.validateClient('nodeID', WantedURL)) {return Helper.ErrorPage(res)};
  let imgHeight = (req.query.h == "null") ? null : parseInt(req.query.h || null);
  let imgWidth = (req.query.w == "null") ? null : parseInt(req.query.w || null);
  let section = Helper.validateClient("section", req.query.s) ? req.query.s : "main";

  let Type = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [WantedURL], "keys": ["type"]});
  Type = Type[WantedURL]?.type;

  if (typeof Type !== 'undefined') {
    if (!Type.file) { return Helper.ErrorPage(res) }
  
    if (!imgHeight && !imgWidth) { Recent.Push({"user": userID, section, "id": WantedURL}) }
  
    Type.mime.includes('image') && !Type.mime.includes('svg') 
      ? resize = {"width": imgWidth || null, "height": imgHeight || null} 
      : resize = false;

    return ReadWrite.Mass(res, uuidv3(WantedURL, userID), Type.mime, resize);
  }

})

Drive_Router.use('/user/:section?/:item?', Nord.Middle, async (req, res, next) => {
  const section = Helper.validateClient('section', req.params.section) ? req.params.section : 'main';
  const item = Helper.validateClient('nodeID', req.params.item) ? req.params.item : undefined;

  if (req.headers.uID && section && item) {
    let node = await Node.Read({"user": req.headers.uID, "type": "ID", "section": section, "ids": [item], "contents": false});
    
    if (node[item]) {
      if (section == 'bin') {
        node = await Send.FormatResponse('binInfo', node, {'user': req.headers.uID, 'section': section});
      } else {
        node[item].security = Security.Value(node[item]);
        node[item].contents = {};
      }
    }
    return res.status(200).send(node)
  } else { return res.status(400).send({"Error": "Invalid Request"}) }
  return Helper.ErrorPage(res);
})

Drive_Router.use('/folder/:oID', Nord.Middle, async (req, res, next) => {
  let userID = req.headers.uID;
  let oID = req.params.oID;
  let section = Helper.validateClient("section", req.query.s) ? req.query.s : "main";
  let subSection = Helper.validateClient('subSection', req.query.sub) ? req.query.sub : undefined;

  if (userID && oID && section) {
    let itemSecurity = await Security.Checker({"userID":userID, "section": section, "oID":oID, "wanted": "Access"});
    if (itemSecurity) { return res.send({"Auth": itemSecurity, "Item": oID}); return; }
    else {
      return await Send.Read_Send_Contents( 
        { "user":userID,  "type":'ID',  "section":section,  "subSection":subSection,  "path":[oID],  "contents":false },
        { "ConType":"HTTP",  "ConLink":res } );
    }
  }
  return Helper.ErrorPage(res);
})

Drive_Router.use('/activity/:action/:section?', Nord.Middle, async (req, res, next) => {
  let userID = req.headers.uID;
  let section = Helper.validateClient("section", req.params.section) || "main";
  let action = req.params.action;
  
  if (userID && action && section) {
    if (action == 'recent') {
      return res.status(200).send(await Recent.Fetch({userID, section}));
    }
  }
  return Helper.ErrorPage(res);
})

Drive_Router.use('/account/:data?', Nord.Middle, async (req, res, next) => {
  if (req.params.data == 'bin') {
    let size = await Node.Read({"user": req.headers.uID, "CUSTOM": {'size.bin': 1}})
    return res.send({"size": size.size});
  }
  else if (req.params.data == 'settings') {
    let accountData = await Account.Get(req.headers.uID, ["settings", "plan"]);
    if (typeof accountData[0].settings == 'undefined' || accountData[0].settings == false) {
      await Account.Write({ "user": req.headers.uID, "type": "Set", "parentKey": "settings", "data": Helper.Settings_Template }); 
    }
    return res.send({...accountData[0].settings, ...{"plan": {"max": accountData[0].plan.max, "used": accountData[0].plan.used}}})
  }
})

// ============ POST ============
// ============ POST ============
// ============ POST ============

Drive_Router.post('/search', Nord.Middle, async(req, res) => {
  const {body} = req;
  let searchResults = await Search.Find({"user": req.headers.uID, "input": body.input, "params": body})
  return res.send(searchResults)
})

Drive_Router.post('/create', Nord.Middle, async(req, res) => {
  const userID = req.headers.uID;
  let {path, type, parent, name, options} = req.body;
  const section = Helper.validateClient("section", req.body.section) ? req.body.section : "main";
  if (parent == '_MAIN_') parent = '_GENERAL_';

  if (type.match(/Item|Folder|File|Span/i)) {
    const written = await Node.Create(type,
      {userID, section, parent},
      {name, "isFi": false, options }
    );

    if (written) {
      return await Send.Read_Send_Contents( 
        { "user": userID,  "type":'ID',  "section":section,  "path":[path],  "contents":false },
        { "ConType":"HTTP",  "ConLink":res } );
    } else {
      return Send.Message(res, 403, {"status": 'Failed'})
    }
  } 
})

Drive_Router.post('/edit', Nord.Middle, async(req, res) => {
  const {section, path, action, id, data, to} = req.body;
  const userID = req.headers.uID;

  if (!Helper.validateUUID(id)) { return Send.Message(res, 400, {'message': 'Invalid Item ID'}); }

  const Edit = {
    "user": userID,
    "type": action,
    "section": Helper.validateClient("section", section) ? section : "main",
  };

  if (action == "DATA") { Edit.changeTo = data; }
  else if (action == "MOVE") { Edit.moveTo = to; }
  else if (action == "DELETE") { Edit.moveTo = 'bin'; }

  const EditItemIDs = Array.isArray(id) ? id : [id];
  let writeSuccess = true;
  // TRY CATCH HERE
  for (let i=0; i<EditItemIDs.length; i++) { // Iterate Through All Edited Items. If a bad write, break loop and send error.
    Edit.id = EditItemIDs[i];
    let write = await Node.Edit(Edit);
    if (!write || write.Error) { writeSuccess={"message": write.Error.message || 'Internal', "code": write.Error.code || 400}; break; }
  }

  if (writeSuccess === true) {
    if (action !== "DELETE") { Recent.Push({"user": userID, section, "id": EditItemIDs}) }

    if (path) { // Path states that we send back directory to User
      return await Send.Read_Send_Contents(
        { "user":userID,  "type":'ID',  "section":Edit.section,  "path":[path],  "contents":false },
        { "ConType":"HTTP",  "ConLink":res } );
    } else {
      return Send.Message(res, 200, {"status": `${action} successful`})
    }
  } else {
    return await Send.Error(
      { "Message": writeSuccess.message, "Code": writeSuccess.code },
      { "ConType":"HTTP",  "ConLink":res } );
  }
})

Drive_Router.post('/share', Nord.Middle, async(req, res) => {
  const {ACTION, oID, SECTION} = req.body;
  const userID = req.headers.uID;

  if (ACTION && oID && SECTION && userID) {
    if (ACTION == "LINK") {
      let linkID, file_name = uuidv3(oID, userID);

      let Called_Information = await Node.Read({"user": userID, "type": "SPECIFIC", "section": SECTION, "ids": [oID], "keys": ["share","type"]});

      if (Called_Information[oID]?.share?.link) {
        linkID = Called_Information[oID].share.link.url;
      } else if (Called_Information[oID]) {
        linkID = await Links.writeShareLink(nanoid(16), userID, {oID, file_name, 'mime': Called_Information[oID].type.mime})
        await Node.Edit({ "user": userID, "type": "DATA", "section": SECTION, "id": oID, "changeTo": {"share": {"link": {"url": linkID}}} })
      }
      return res.status(200).send({"link": `https://link.nanode.one/${linkID}`});
    }
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/download', Nord.Middle, async(req, res) => {
  const {FOR, NAME, ITEMS, SECTION} = req.body;
  
  if (FOR && NAME && ITEMS && SECTION) {
    try { return await Modify.ZipFile(res, req.headers.uID, req.body); }
    catch (error) {console.error(error);}
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/auth', Nord.Middle, async (req, res) => {
  // console.log("Have a key sent to the user that unlocks it for the session. Various Reasons...");
  const userID = req.headers.uID;
  const {oID, section, entries} = req.body;

  let access = await Security.Checker({"input":entries, userID, section, oID, "wanted":"Access"});
  if (access === true) {
    return await Send.Read_Send_Contents( 
      { "user":req.headers.uID,  "type":'ID', section,  "path":[oID],  "contents":false },
      { "ConType":"HTTP",  "ConLink":res } );
  }
  return res.status(200).send({"Error": "Invalid"});
})

Drive_Router.post('/upload', Nord.Middle, async (req, res, next) => {
  const userID = req.headers.uID;
  const {message, meta, chunk_info, file} = req.body;

  if (message) {
    if (message == "Queue_Empty" && ReadWrite.UploadCheck(userID)) { ReadWrite.UploadCheck(userID, 'reset'); return res.sendStatus(200);}
    if (message = "Cancelled") { console.log("Upload Cancelled, empty Tree and Remove file chunks?"); return res.sendStatus(200); }
  }

  const FileData = Buffer.from(file);
  const upload_chunk_size = Buffer.byteLength(FileData);

  let Allocation = await Security.Upload_Limit(userID, upload_chunk_size, chunk_info, meta); // Checks User Plan against the upload.
  if (Allocation.auth === false) { return Send.Message(res, 403, {"status": Allocation.msg}) }

  if (Allocation.auth === true && FileData) {
    
    // Encrypt File here
    let result = await ReadWrite.Upload({
      user: userID,
      id: meta.id,
      index: chunk_info.index,
      total: chunk_info.total_chunks,
      FileArray: FileData,
    });
    
    if (result.written) { // Entire File written, add to Upload_Tree and request next file.
      meta.size = Allocation.size;
      meta.type = result.file_type?.mime || meta.type;
      await ReadWrite.Write_To_User_File(userID, result.file_oID, meta);
      return Send.Message(res, 200, {"status": "Complete", "plan": Allocation.plan})
    }
    return Send.Message(res, 200, {"status": result})
   } else {
    return Send.Message(res, 403, {"status": "Incomplete"})
  }
})

module.exports = Drive_Router;