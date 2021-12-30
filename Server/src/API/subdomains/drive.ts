import fs from 'fs-extra';
import express from 'express';
const Drive_Router = express.Router();

import csp from 'helmet-csp';
import cors from 'cors';
const corsOptions = {origin: 'https://drive.Nanode.one'}

import crypto from 'crypto';
import uuidv3 from 'uuid/v3';
import { nanoid } from 'nanoid';

import Nauth from '../../Middleware/Nauth';
import Node from '../../Node/node';
import ReadWrite from '../../Nano/ReadWrite';
import { Perm_Delete } from '../../Nano/ReadWrite';
import Modify from '../../Nano/modify';
import * as Search from '../../Node/Search';
import Security from '../../Node/security';
import Recent from '../../Node/recent';
import Account from '../../Account/account';
import Links from '../../Account/links';

import Nelp from '../../tools';
import {Settings_Template} from '../../templates';

import Send from '../send';

// import Encryptor from '../Encryptor.js';

const codexConverter = {1: "Text", 2: "Video", 3: "Audio"};

// ======================= TS ========================
import { Request, Response } from 'express';

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Drive_Router.use(express.urlencoded({extended: true}));
var parseJSON = express.json({ limit: '5mb' });
Drive_Router.use((req, res, next) => req.get('content-type')?.indexOf('multipart/form-data') !== 0 ? next() : parseJSON(req, res, next))
// Drive_Router.use(express.json({ limit: '5mb' }))


Drive_Router.use(cors(corsOptions))
Drive_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'nanode.one', '*.nanode.one', 'https://upload.nanode.one'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

// Drive_Router.use(Nauth.Middle); // Cannot set, as this then runs for every static item too. js/css files, images etc...

Drive_Router.get('/', Nauth.Middle, async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/drive.html', {extensions: ['html', 'htm']}) })

Drive_Router.use('/storage/:content', Nauth.Middle, async (req, res, next) => {
  let userID = req.headers.uID as User;
  
  let WantedURL = req.params.content;
  if (!Nelp.validateClient('nodeID', WantedURL)) {return Nelp.errorPage(res)};
  let imgHeight = (req.query.h == "null") ? null : parseInt(req.query.h as any || null);
  let imgWidth = (req.query.w == "null") ? null : parseInt(req.query.w as any || null);
  let section = Nelp.validateClient("section", req.query.s as Sections)? req.query.s as Sections : "main";

  let NodeData = (await Node.Read({"user": userID, "type": "SPECIFIC", section, "ids": [WantedURL], "keys": ['type', 'contents']}))[WantedURL];

  if (NodeData && NodeData?.type?.file) {
    if (!imgHeight && !imgWidth) { Recent.Push({userID, section, "id": WantedURL}) }
  
    let resize = NodeData.type.mime.includes('image') && !NodeData.type.mime.includes('svg') && (imgWidth || imgHeight)
      ? {"width": imgWidth || undefined, "height": imgHeight || undefined}
      : false;

    let thumbnail = (NodeData.contents?.thumbnail && resize && resize.height === 90 && resize.width === 120) ? NodeData.contents?.thumbnail : false;

    ReadWrite.Mass(res, {'fileID': NodeData.contents.file, 'userID':userID, 'nodeID': WantedURL, 'section': section, 'mimetype':NodeData.type.mime, 'resize':resize, 'thumbnail': thumbnail});
  } else { return Nelp.errorPage(res) }
})

Drive_Router.use('/user/:section?/:item?', Nauth.Middle, async (req, res, next) => {
  const section = Nelp.validateClient('section', req.params.section) ? req.params.section as Sections : 'main';
  const item = Nelp.validateClient('nodeID', req.params.item) ? req.params.item : undefined;

  if (req.headers.uID && section && item) {
    let node = await Node.Read({"user": req.headers.uID as User, "type": "ID", section, "ids": [item], "contents": false});
    
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
  return Nelp.errorPage(res);
})

Drive_Router.use('/folder/:oID', Nauth.Middle, async (req, res, next) => {
  let userID = req.headers.uID as User;
  let oID = req.params.oID;
  let section = Nelp.validateClient("section", req.query.s as Sections) ? req.query.s as Sections : "main";
  let subSection = Nelp.validateClient('subSection', req.query.sub as SubSections) ? req.query.sub as SubSections : undefined;

  if (userID && oID && section) {
    // let itemSecurity = await Security.Checker({userID, section, oID, "wanted": "Access"});
    // if (itemSecurity) { return res.send({"Auth": itemSecurity, "Item": oID}); return; }
    // else {
      return await Send.Read_Send_Contents({ userID, "type":'ID', section, subSection, "path":[oID],  "contents":false }, res);
    // }
  }
  return Nelp.errorPage(res);
})

Drive_Router.use('/activity/:action/:section?', Nauth.Middle, async (req, res, next) => {
  let userID = req.headers.uID as User;
  let section = Nelp.validateClient("section", req.params.section) ? req.params.section as Sections : 'main';
  let action = req.params.action;
  
  if (userID && action && section) {
    if (action == 'recent') {
      return res.status(200).send(await Recent.Fetch({userID, section}));
    }
  }
  return Nelp.errorPage(res);
})

Drive_Router.use('/account/:data?', Nauth.Middle, async (req, res, next) => {
  if (req.params.data == 'bin') {
    let size = await Node.Custom_Read({"user": req.headers.uID as User, "query": {'size.bin': 1}})
    return res.send({"size": size.size});
  }
  else if (req.params.data == 'settings') {
    let accountData = await Account.Get(req.headers.uID as User, ["settings", "plan"]);
    if (typeof accountData[0].settings == 'undefined' || accountData[0].settings == false) {
      await Account.Write({ "user": req.headers.uID as User, "type": "Set", "parentKey": "settings", "data": Settings_Template }); 
    }
    return res.send({...accountData[0].settings, ...{"plan": {"max": accountData[0].plan.max, "used": accountData[0].plan.used}}})
  }
})

// ============ POST ============
// ============ POST ============
// ============ POST ============

// === Bin ===
Drive_Router.post('/bin', Nauth.Middle, async(req, res) => {
  const {subSection, action, id} = req.body;
  const user = req.headers.uID as User;
  
  if (!Nelp.validateUUID(id)) { return Send.Message(res, 400, {'message': 'Invalid Item ID'}); }

  try {
    let newParentID: string = '';
    if (action == 'RESTORE') {
      // console.log(`restore: ${id} from bin: ${subSection}`);
      newParentID = await Node.Edit({user, 'type': 'RESTORE', section:'bin', id})
    }
    else if (action == 'DELETE') {
      // console.log(`delete: ${id} from bin: ${subSection}`);
      let FilesToDelete = await Node.Edit({user, 'type': 'DELETE', 'section': 'bin', subSection, id, 'readCurrent': false});
      await Perm_Delete(user, FilesToDelete, function(err) {
        if (err) { console.log(err); }
        else { console.log('All Files Deleted'); }
      });
    }
    console.log('Response Sent');
    return Send.Message(res, 200, {'status': `successful`, 'msg': `${action} success`, 'parent': newParentID});
  } catch(err) { console.log(err); return Send.Error({Message: `Failed to ${action}`, Code: 400}, res)}
})


Drive_Router.post('/search', Nauth.Middle, async(req, res) => {
  const {body} = req;
  let searchResults = await Search.Find({"user": req.headers.uID as User, "input": body.input, "params": body})
  return res.send(searchResults)
})

Drive_Router.post('/create', Nauth.Middle, async(req, res) => {
  const userID = req.headers.uID as User;
  let {path, type, parent, name, options} = req.body;
  const section = Nelp.validateClient("section", req.body.section) ? req.body.section : "main";

  if (parent == 'SEARCH') return Send.Error({'Message': 'Cannot Create a Folder within Search', 'Code': 405}, res)
  if (parent == '_MAIN_') parent = '_GENERAL_';

  if (type.match(/Item|Folder|File|Span/i)) {
    const written = await Node.Create(type,
      {userID, section, parent},
      {name, "isFi": false, options }
    );

    if (written) {
      return await Send.Read_Send_Contents({userID, "type":'ID', "section":section, "path":[path], "contents":false }, res);
    } else {
      return Send.Message(res, 403, {"status": 'Failed'})
    }
  } 
})

Drive_Router.post('/edit', Nauth.Middle, async(req, res) => {
  const {section, path, action, id, data, to} = req.body;
  const userID = req.headers.uID as User;

  const EditItemIDs = Array.isArray(id) ? id : [id];

  if (!Nelp.validateUUID(EditItemIDs[0])) { return Send.Message(res, 400, {'message': 'Invalid Item ID'}); }

  const Edit:Node_Edit = {
    "user": userID,
    "type": action,
    "section": Nelp.validateClient("section", section) ? section : "main",
    'id': ''
  };

  if (action == "DATA") { Edit.changeTo = data; }
  else if (action == "MOVE") { Edit.moveTo = to; }
  else if (action == "BIN") { Edit.moveTo = 'bin'; }

  let writeSuccess = true;
  let writeErr = {'Message': '', 'Code': 400}
  // TRY CATCH HERE
  for (let i=0; i<EditItemIDs.length; i++) { // Iterate Through All Edited Items. If a bad write, break loop and send error.
    Edit.id = EditItemIDs[i];
    let write = await Node.Edit(Edit);
    if (!write || write.Error) {
      return await Send.Error({'Message': write.Error.message || 'Internal', 'Code': write.Error.code || 400}, res)
    }
  }

  // ? TODO: Does Recent.Push set the recents array to these items only? and drop the others? Test by moving files in and out of a directory and seeing if the recents is only set to those items afterwards.
  if (action !== "BIN") { Recent.Push({userID, section, "id": EditItemIDs}) }

  if (path) { // Path states that we send the directory back to the User
    return await Send.Read_Send_Contents({userID, "type":'ID', "section":Edit.section, "path":[path], "contents":false },res);
  } else {
    return Send.Message(res, 200, {"status": 'successful', action})
  }
})

Drive_Router.post('/share', Nauth.Middle, async(req, res) => {
  const {action, oID, section} = req.body;
  const userID = req.headers.uID as User;

  if (action && oID && section && userID) {
    if (action == "LINK") {
      let linkID, file_name = uuidv3(oID, userID);

      let Called_Information = await Node.Read({"user": userID, "type": "SPECIFIC", section, "ids": [oID], "keys": ["share","type"]});

      if (Called_Information[oID]?.share?.link) {
        linkID = Called_Information[oID].share.link.url;
      } else if (Called_Information[oID]) {
        linkID = await Links.writeShareLink(nanoid(16), userID, {oID, file_name, 'mime': Called_Information[oID].type.mime})
        await Node.Edit({ "user": userID, "type": "DATA", section, "id": oID, "changeTo": {"share": {"link": {"url": linkID}}} })
      }
      return res.status(200).send({"link": `https://link.nanode.one/${linkID}`});
    }
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/download', Nauth.Middle, async(req, res) => {
  const {For, name, items, section} = req.body as ZipParams;
  
  if (For && name && items && section) {
    try { return await Modify.ZipFile(res, req.headers.uID as User, req.body); }
    catch (error) {console.error(error);}
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/auth', Nauth.Middle, async (req, res) => {
  // console.log("Have a key sent to the user that unlocks it for the session. Various Reasons...");
  const userID = req.headers.uID as User;
  const {oID, section, entries} = req.body;

  let access = await Security.Checker({userID, section, oID, "wanted":"Access", "input":entries,});
  if (access === true) {
    return await Send.Read_Send_Contents({userID, "type":'ID', section, "path":[oID],  "contents":false}, res);
  }
  return res.status(200).send({"Error": "Invalid"});
})

Drive_Router.post('/upload', Nauth.Middle, async (req, res) => {
  const userID = req.headers.uID as User;
  const {message='', meta, chunk_info, file} = req.body as POST_Upload;

  if (meta?.parent === 'SEARCH' || !meta?.parent) {
    return Send.Message(res, 405, {'status': 'Invalid', 'message': 'Not a valid upload destination'}); }

  if (message === "Queue_Empty" && ReadWrite.UploadCheck(userID, false)) {
    ReadWrite.UploadCheck(userID, true); return res.sendStatus(200); }

  if (message === "Cancelled") {
    console.log("Upload Cancelled, empty the Tree and Remove file chunks?"); return res.sendStatus(200); }


  const FileData = Buffer.from(file);
  const upload_chunk_size = Buffer.byteLength(FileData);

  let Allocation = await Security.Upload_Limit(userID, upload_chunk_size, chunk_info, meta); // Checks User Plan against the upload.

  if (Allocation.auth === true && FileData) {
    // Encrypt File here
    let result = await ReadWrite.Upload({
      user: userID,
      id: meta.id,
      index: chunk_info.index,
      total: chunk_info.total_chunks,
      FileArray: FileData,
    }); // :Chunk

    if (result.chunkWrite) {
      return Send.Message(res, 200, {"status": result.chunkWrite})
    } else if (result.written) { // Entire File written, add to Upload_Tree and request next file.
      meta.size = Allocation.size as number;
      meta.type = result.file_type?.mime || meta.type;
      await ReadWrite.Write_To_User_File(userID, result.file_oID as string, meta);
      return Send.Message(res, 200, {"status": "Complete", "plan": Allocation.plan})
    } else { // An unknown error has ocurred 
      return Send.Message(res, 200, {"status": 'unknown'})
    }
  } else if (Allocation.auth === false) { // The user does not have enough allocated space to upload the content.
    return Send.Message(res, 403, {"status": Allocation.msg})
  } else {
    return Send.Message(res, 403, {"status": "Incomplete"})
  }
})


module.exports = Drive_Router;