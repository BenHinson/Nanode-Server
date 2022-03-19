import fs from 'fs-extra';
import express from 'express';
const Drive_Router = express.Router();

import csp from 'helmet-csp';
import cors from 'cors';
const corsOptions = {origin: ['https://drive.nanode.one', 'http://localhost:3000']}

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
// Drive_Router.use(express.json({ limit: '5mb' }))
const parseJSON = express.json({ limit: '5mb' });
Drive_Router.use((req, res, next) => req.get('content-type')?.indexOf('multipart/form-data') !== 0 ? next() : parseJSON(req, res, next))

Drive_Router.use(cors(corsOptions))
Drive_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'nanode.one', '*.nanode.one', 'https://upload.nanode.one', 'http://localhost:3000'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

// Drive_Router.use(Nauth.Middle); // Cannot set, as this then runs for every static item too. js/css files, images etc...

Drive_Router.get('/', Nauth.Middle, async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/drive.html', {extensions: ['html', 'htm']}) })

Drive_Router.use('/storage/:content', Nauth.Middle, async (req, res, next) => {
  let userId = req.headers.userId as UserId;
  
  let wantedURL = req.params.content;
  if (!Nelp.validateClient('nodeId', wantedURL)) {return Nelp.errorPage(res)};
  let imgHeight = (req.query.h == "null") ? null : parseInt(req.query.h as any || null);
  let imgWidth = (req.query.w == "null") ? null : parseInt(req.query.w as any || null);
  let section = Nelp.validateClient("section", req.query.s as Sections)? req.query.s as Sections : "main";

  let nodeData = (await Node.Read({userId, "type": "SPECIFIC", section, "nodeIds": [wantedURL], "keys": ['type', 'contents']}))[wantedURL];

  if (nodeData && nodeData?.type?.file) {
    if (!imgHeight && !imgWidth) { Recent.Push({userId, section, "nodeId": wantedURL}) }
  
    let resize = nodeData.type.mime.includes('image') && !nodeData.type.mime.includes('svg') && (imgWidth || imgHeight)
      ? {"width": imgWidth || undefined, "height": imgHeight || undefined}
      : false;

    let thumbnail = (nodeData.contents?.thumbnail && resize && resize.height === 90 && resize.width === 120) ? nodeData.contents?.thumbnail : false;

    ReadWrite.Mass(res, {'fileId': nodeData.contents.file, userId, 'nodeId': wantedURL, 'section': section, 'mimetype':nodeData.type.mime, 'resize':resize, 'thumbnail': thumbnail});
  } else { return Nelp.errorPage(res) }
})

Drive_Router.use('/user/:section?/:item?', Nauth.Middle, async (req, res, next) => {
  const section = Nelp.validateClient('section', req.params.section) ? req.params.section as Sections : 'main';
  const item = Nelp.validateClient('nodeId', req.params.item) ? req.params.item : undefined;

  const userId = req.headers.userId as UserId;

  if (userId && section && item) {
    let node = await Node.Read({userId, "type": "ID", section, "nodeIds": [item], "contents": false});
    
    if (node[item]) {
      if (section == 'bin') {
        node = await Send.FormatResponse('binInfo', node, {userId, section});
      } else {
        node[item].security = Security.Value(node[item]);
        node[item].contents = {};
      }
    }
    return res.status(200).send(node)
  } else { return res.status(400).send({"Error": "Invalid Request"}) }
  return Nelp.errorPage(res);
})

Drive_Router.use('/folder/:nodeId', Nauth.Middle, async (req, res, next) => {
  let userId = req.headers.userId as UserId;
  let nodeId = req.params.nodeId;
  let section = Nelp.validateClient("section", req.query.s as Sections) ? req.query.s as Sections : "main";
  let subSection = Nelp.validateClient('subSection', req.query.sub as SubSections) ? req.query.sub as SubSections : undefined;

  if (userId && nodeId && section) {
    // let itemSecurity = await Security.Checker({userId, section, nodeId, "wanted": "Access"});
    // if (itemSecurity) { return res.send({"Auth": itemSecurity, "Item": nodeId}); return; }
    // else {
      return await Send.Read_Send_Contents({userId, "type":'ID', section, subSection, "path":[nodeId],  "contents":false }, res);
    // }
  }
  return Nelp.errorPage(res);
})

Drive_Router.use('/activity/:action/:section?', Nauth.Middle, async (req, res, next) => {
  let userId = req.headers.userId as UserId;
  let section = Nelp.validateClient("section", req.params.section) ? req.params.section as Sections : 'main';
  let action = req.params.action;
  
  if (userId && action && section) {
    if (action == 'recent') {
      return res.status(200).send(await Recent.Fetch({userId, section}));
    }
  }
  return Nelp.errorPage(res);
})

Drive_Router.use('/account/:data?', Nauth.Middle, async (req, res, next) => {
  const userId = req.headers.userId as UserId;

  if (req.params.data == 'bin') {
    let size = await Node.Custom_Read({userId, "query": {'size.bin': 1}})
    return res.send({"size": size.size});
  }
  else if (req.params.data == 'settings') {
    let accountData = await Account.Get(userId, ["settings", "plan"]);
    if (typeof accountData[0].settings == 'undefined' || accountData[0].settings == false) {
      await Account.Write({userId, "type": "SET", "parentKey": "settings", "data": Settings_Template }); 
    }
    return res.send({...accountData[0].settings, ...{"plan": {"max": accountData[0].plan.max, "used": accountData[0].plan.used}}})
  }
})

// ============ POST ============
// ============ POST ============
// ============ POST ============

// === Bin ===
Drive_Router.post('/bin', Nauth.Middle, async(req, res) => {
  const {subSection, action, nodeId} = req.body;
  const userId = req.headers.userId as UserId;
  
  if (!Nelp.validateUUID(nodeId)) { return Send.Message(res, 400, {'message': 'Invalid Item ID'}); }

  try {
    let newParentId: string = '';
    if (action == 'RESTORE') {
      // console.log(`restore: ${id} from bin: ${subSection}`);
      newParentId = await Node.Edit({userId, 'type': 'RESTORE', section:'bin', nodeId})
    }
    else if (action == 'DELETE') {
      // console.log(`delete: ${id} from bin: ${subSection}`);
      let filesToDelete = await Node.Edit({userId, 'type': 'DELETE', 'section': 'bin', subSection, nodeId, 'readCurrent': false});
      await Perm_Delete(userId, filesToDelete, function(err) {
        if (err) { console.log(err); }
        else { console.log('All Files Deleted'); }
      });
    }
    console.log('Response Sent');
    return Send.Message(res, 200, {'status': `successful`, 'msg': `${action} success`, 'parent': newParentId});
  } catch(err) { console.log(err); return Send.Error({Message: `Failed to ${action}`, Code: 400}, res)}
})


Drive_Router.post('/search', Nauth.Middle, async(req, res) => {
  const {body} = req;
  const userId = req.headers.userId as UserId;

  let searchResults = await Search.Find({userId, "input": body.input, "params": body})
  return res.send(searchResults)
})

Drive_Router.post('/create', Nauth.Middle, async(req, res) => {
  const userId = req.headers.userId as UserId;
  let {path, type, parent, name, options} = req.body;
  const section = Nelp.validateClient("section", req.body.section) ? req.body.section : "main";

  if (parent == 'SEARCH') return Send.Error({'Message': 'Cannot Create a Folder within Search', 'Code': 405}, res)
  if (parent == '_MAIN_') parent = '_GENERAL_';

  if (type.match(/Item|Folder|File|Span/i)) {
    const written = await Node.Create(type,
      {userId, section, parent},
      {name, "isFi": false, options }
    );

    if (written) {
      return await Send.Read_Send_Contents({userId, "type":'ID', section, "path":[path], "contents":false }, res);
    } else {
      return Send.Message(res, 403, {"status": 'Failed'})
    }
  } 
})

Drive_Router.post('/edit', Nauth.Middle, async(req, res) => {
  const {section, path, action, id, data, to} = req.body;
  const userId = req.headers.userId as UserId;

  const editItemIDs = Array.isArray(id) ? id : [id];

  if (!Nelp.validateUUID(editItemIDs[0])) { return Send.Message(res, 400, {'message': 'Invalid Item ID'}); }

  const Edit:NodeEdit = {
    userId,
    "type": action,
    "section": Nelp.validateClient("section", section) ? section : "main",
    'nodeId': ''
  };

  if (action == "DATA") { Edit.changeTo = data; }
  else if (action == "MOVE") { Edit.moveTo = to; }
  else if (action == "BIN") { Edit.moveTo = 'bin'; }

  let writeSuccess = true;
  let writeErr = {'Message': '', 'Code': 400}
  // TRY CATCH HERE
  for (let i=0; i<editItemIDs.length; i++) { // Iterate Through All Edited Items. If a bad write, break loop and send error.
    Edit.nodeId = editItemIDs[i];
    let write = await Node.Edit(Edit);
    if (!write || write.error) {
      return await Send.Error({'Message': write.error.message || 'Internal', 'Code': write.error.code || 400}, res)
    }
  }

  // ? TODO: Does Recent.Push set the recents array to these items only? and drop the others? Test by moving files in and out of a directory and seeing if the recents is only set to those items afterwards.
  if (action !== "BIN") { Recent.Push({userId, section, "nodeId": editItemIDs}) }

  if (path) { // Path states that we send the directory back to the User
    return await Send.Read_Send_Contents({userId, "type":'ID', "section":Edit.section, "path":[path], "contents":false },res);
  } else {
    return Send.Message(res, 200, {"status": 'successful', action})
  }
})

Drive_Router.post('/share', Nauth.Middle, async(req, res) => {
  const {action, nodeId, section} = req.body;
  const userId = req.headers.userId as UserId;

  if (action && nodeId && section && userId) {
    if (action == "LINK") {
      let linkId, fileName = uuidv3(nodeId, userId);

      let calledInformation = await Node.Read({userId, "type": "SPECIFIC", section, "nodeIds": [nodeId], "keys": ["share","type"]});

      if (calledInformation[nodeId]?.share?.link) {
        linkId = calledInformation[nodeId].share.link.url;
      } else if (calledInformation[nodeId]) {
        linkId = await Links.writeShareLink(nanoid(16), userId, {nodeId, fileName, 'mime': calledInformation[nodeId].type.mime})
        await Node.Edit({userId, "type": "DATA", section, nodeId, "changeTo": {"share": {"link": {"url": linkId}}} })
      }
      return res.status(200).send({"link": `https://link.nanode.one/${linkId}`});
    }
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/download', Nauth.Middle, async(req, res) => {
  const {forUser, name, items, section} = req.body as ZipParams;
  
  if (forUser && name && items && section) {
    try { return await Modify.ZipFile(res, req.headers.userId as UserId, req.body); }
    catch (error) {console.error(error);}
  }
  return res.status(401).send({"Error": "Invalid"});
})

Drive_Router.post('/auth', Nauth.Middle, async (req, res) => {
  // console.log("Have a key sent to the user that unlocks it for the session. Various Reasons...");
  const userId = req.headers.userId as UserId;
  const {nodeId, section, entries} = req.body;

  let access = await Security.Checker({userId, section, nodeId, "wanted":"Access", "input":entries,});
  if (access === true) {
    return await Send.Read_Send_Contents({userId, "type":'ID', section, "path":[nodeId],  "contents":false}, res);
  }
  return res.status(200).send({"Error": "Invalid"});
})

Drive_Router.post('/upload', Nauth.Middle, async (req, res) => {
  const userId = req.headers.userId as UserId;
  const {message='', meta, chunkInfo, file} = req.body as POSTUpload;

  if (message === "Queue_Empty") {
    ReadWrite.UploadCheck(userId, true); return res.sendStatus(200); }
    
  if (message === "Cancelled") {
    console.log("Upload Cancelled, empty the Tree and Remove file chunks?"); return res.sendStatus(200); }
      
  if (meta?.parent === 'SEARCH' || !meta?.parent) {
    return Send.Message(res, 405, {'status': 'Invalid', 'message': 'Not a valid upload destination'}); }

  const fileData = Buffer.from(file);
  const uploadChunkSize = Buffer.byteLength(fileData);

  let allocation = await Security.Upload_Limit(userId, uploadChunkSize, chunkInfo, meta); // Checks User Plan against the upload.

  if (allocation.auth === true && fileData) {
    // Encrypt File here
    let result = await ReadWrite.Upload({
      userId,
      nodeId: meta.nodeId,
      index: chunkInfo.index,
      total: chunkInfo.totalChunks,
      fileArray: fileData,
    }); // :Chunk

    if (result.chunkWrite) {
      return Send.Message(res, 200, {"status": result.chunkWrite})
    } else if (result.written) { // Entire File written, add to Upload_Tree and request next file.
      meta.size = allocation.size as number;
      meta.type = result.fileType?.mime || meta.type;
      await ReadWrite.Write_To_User_File(userId, result.fileNodeId as string, meta);
      return Send.Message(res, 200, {"status": "Complete", "plan": allocation.plan})
    } else { // An unknown error has ocurred 
      return Send.Message(res, 200, {"status": 'unknown'})
    }
  } else if (allocation.auth === false) { // The user does not have enough allocated space to upload the content.
    return Send.Message(res, 403, {"status": allocation.msg})
  } else {
    return Send.Message(res, 403, {"status": "Incomplete"})
  }
})


module.exports = Drive_Router;