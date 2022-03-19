import fse from 'fs-extra'
import {v1 as uuidv1} from 'uuid';
import uuidv3 from 'uuid/v3';

import FileType from 'file-type';

import Nelp from '../tools';
import Modify from './modify';
import Node from '../Node/node';
import Account from '../Account/account';


const MassDirectory = process.env.MASS_DIRECTORY!;
const ThumbnailDirectory = process.env.THUMBNAIL_DIRECTORY!;
const EndStorage = process.env.END_STORAGE!;
const ChunkStorage = process.env.CHUNK_STORAGE!;

const uploadObjectTree:UploadObjectTree = {}; // Separates Uploads by Account IDs


// ======================= TS ========================
import { Response } from 'express';

//////////////////////////////////////////////////////////////////////


const Mass = function(res:Response, readData:ReadData):Buffer|false {
  const fileName = readData.thumbnail ? readData.thumbnail : readData.fileId || uuidv3(readData.nodeId, readData.userId);
  const fileDirectory = readData.thumbnail ? ThumbnailDirectory+fileName : MassDirectory+fileName;

  fse.readFile(fileDirectory, async(err, data) => {
    if (err) {
      console.log((readData.thumbnail ? 'Failed to read thumbnail: ' : 'Failed to read file: ') + fileName);
      return Nelp.errorPage(res);
    } else {
      res.setHeader("Content-Type", readData.mimetype);
      res.writeHead(200);

      !readData.thumbnail && readData.resize
        ? Modify.Resize(res, data, readData)
        : res.end(data);
    }
  })
  return false;
}

const WriteThumbnail = async function(fileName:string, data:Buffer):Promise<Boolean> {
  await fse.promises.writeFile(ThumbnailDirectory+fileName, data).then(() => {
    // console.log('Wrote Thumbnail: '+fileName);
    return true;
  }).catch(err => {
    console.log(err);
    return false;
  })
  return true;
}


const UploadCheck = function(userId:UserId, reset:boolean) {
  return reset ? uploadObjectTree[userId] = [] : uploadObjectTree[userId]
}

const Upload = async function(chunk:Chunk):Promise<UploadReturn> {
  const {userId, nodeId, index, total, fileArray} = chunk;
  
  const ThisChunkName = ChunkStorage+["CHUNK", nodeId, index].join('-');
  const PreviousChunkName = ChunkStorage+["CHUNK", nodeId, index-1].join('-');
  
  if (index > 0) { // Add to Previous
    await fse.promises.appendFile(PreviousChunkName, fileArray).catch(err => {console.log(err); return "Failed"});
    await fse.promises.rename(PreviousChunkName, ThisChunkName).catch(err => {console.log(err); return "Failed"});
  } else {
    await fse.promises.writeFile(ThisChunkName, fileArray).catch(err => {console.log(err); return "Failed"});
  }

  if (index >= total - 1) { // Finish Up by Moving File and Renaming
    let fileNodeId = uuidv1();
    let fileType = await FileType.fromFile(ThisChunkName);
    await fse.promises.rename(ThisChunkName, EndStorage+uuidv3(fileNodeId, userId)).catch(err => {console.log(err); return "Failed"});
    return {"written": true, fileNodeId, fileType};
  }
  return {'chunkWrite':"Success"};
}

const Write_To_User_File = async function(userId:UserId, nodeId:string, meta:UploadMeta) {
  if (!uploadObjectTree[userId]) { uploadObjectTree[userId] = []; }
  let relativePath:string[] = meta.relativePath.split('/');
  let fID = await Create_Folders(relativePath.slice(0, -1), userId, meta);
  await Create_New_Item(userId, nodeId, fID ?? meta.parent, meta);
}

const Perm_Delete = async(userId:UserId, nodeData:LooseObject, callback:{(arg:Error|null):void}) => {
  let count = Object.keys(nodeData).length - 1;
  for (const [key, val] of Object.entries(nodeData)) {
    fse.unlink(`${val.drive}://Nanode/Files/Mass/${val.file}`, (err) => {
      if (err) {callback(err)}
      else if (count-- <= 0) {callback(null)}
    })
  }
}

export { WriteThumbnail, Perm_Delete }
export default { Mass, UploadCheck, Upload, Write_To_User_File }


const Create_Folders = async(relativePath:string|string[], userId:UserId, meta:UploadMeta) => {
  let previousFolder;
  for (let i=0; i<relativePath.length; i++) {
    if (!relativePath[i]) { continue; }
    let found = uploadObjectTree[userId].find((item:any) => item[relativePath[i]]);
  	if (found) {previousFolder = found[relativePath[i]].id; continue; }
    let fID = uuidv1();
    uploadObjectTree[userId].push( {[relativePath[i]]: {"id": fID}});
    await Create_New_Item(userId, fID, previousFolder ?? meta.parent, {...meta, ...{"section": meta.section, "name": relativePath[i]}});
    previousFolder = fID;
  }
  return previousFolder;

  // let lastFolder = Upload_Object_Tree[user].find(item => meta[relative_path.slice(-1)]); // I may be able to remove these and replace with the previous_Folder variable;
  // return relative_path.length ? lastFolder[relative_path.slice(-1)].id : null; // I may be able to remove these and replace with the previous_Folder variable;
}
const Create_New_Item = async(userId:UserId, nodeId:string, parent:string, meta:UploadMeta) => {
  const {section, name, size, isFi, type, modified} = meta;

  let writtenSize:number = await Node.Create('Item',
    {userId, section, parent, nodeId},
    {name, size, isFi, type, modified }
  );

  if (writtenSize) {
    await Account.Write({userId, "type": "INCREMENT", "parentKey": "plan", "childKey": "used", "data": writtenSize})
  }
}