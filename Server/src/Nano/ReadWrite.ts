import fse from 'fs-extra'
import {v1 as uuidv1} from 'uuid';
import uuidv3 from 'uuid/v3';

import FileType from 'file-type';

import Nelp from '../tools';
import Modify from './modify';
import Node from '../Node/node';
import Account from '../Account/account';


const UploadLocation = 'F://Nanode/Files/';
const MassDirectory = `${UploadLocation}/Mass/`;
const ThumbnailDirectory = `${UploadLocation}/Thumbnails/`;
const Chunk_Storage = `${UploadLocation}/Chunks/`;
const End_Storage = `${UploadLocation}/Mass/`;

const Upload_Object_Tree:UploadObjectTree = {}; // Seperates Uploads by Account IDs


// ======================= TS ========================
import { Response } from 'express';

//////////////////////////////////////////////////////////////////////


const Mass = function(res:Response, readData:ReadData):Buffer|false {
  const fileName = readData.thumbnail ? readData.thumbnail : readData.fileID || uuidv3(readData.nodeID, readData.userID);
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


const UploadCheck = function(user:string, reset:boolean) {
  return reset ? Upload_Object_Tree[user] = [] : Upload_Object_Tree[user]
}

const Upload = async function(chunk:Chunk):Promise<UploadReturn> {
  const {user, id, index, total, FileArray} = chunk;
  
  const ThisChunkName = Chunk_Storage+["CHUNK", id, index].join('-');
  const PreviousChunkName = Chunk_Storage+["CHUNK", id, index-1].join('-');
  
  if (index > 0) { // Add to Previous
    await fse.promises.appendFile(PreviousChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
    await fse.promises.rename(PreviousChunkName, ThisChunkName).catch(err => {console.log(err); return "Failed"});
  } else {
    await fse.promises.writeFile(ThisChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
  }

  if (index >= total - 1) { // Finish Up by Moving File and Renaming
    let file_oID = uuidv1();
    let file_type = await FileType.fromFile(ThisChunkName);
    await fse.promises.rename(ThisChunkName, End_Storage+uuidv3(file_oID, user)).catch(err => {console.log(err); return "Failed"});
    return {"written": true, file_oID, file_type};
  }
  return {chunkWrite:"Success"};
}

const Write_To_User_File = async function(user:string, oID:string, meta:UploadMeta) {
  if (!Upload_Object_Tree[user]) { Upload_Object_Tree[user] = []; }
  let relative_path:string[] = meta.relative_path.split('/');
  let fID = await Create_Folders(relative_path.slice(0, -1), user, meta);
  await Create_New_Item(user, oID, fID ?? meta.parent, meta);
}

const Perm_Delete = async(userID:User, nodeData:LooseObject, callback:{(arg:Error|null):void}) => {
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


const Create_Folders = async(relative_path:string|string[], user:string, meta:UploadMeta) => {
  let previous_Folder;
  for (let i=0; i<relative_path.length; i++) {
    if (!relative_path[i]) { continue; }
    let found = Upload_Object_Tree[user].find((item:any) => item[relative_path[i]]);
  	if (found) {previous_Folder = found[relative_path[i]].id; continue; }
    let fID = uuidv1();
    Upload_Object_Tree[user].push( {[relative_path[i]]: {"id": fID}});
    await Create_New_Item(user, fID, previous_Folder ?? meta.parent, {...meta, ...{"section": meta.section, "name": relative_path[i]}});
    previous_Folder = fID;
  }
  return previous_Folder;

  // let lastFolder = Upload_Object_Tree[user].find(item => meta[relative_path.slice(-1)]); // I may be able to remove these and replace with the previous_Folder variable;
  // return relative_path.length ? lastFolder[relative_path.slice(-1)].id : null; // I may be able to remove these and replace with the previous_Folder variable;
}
const Create_New_Item = async(userID:string, oID:string, parent:string, meta:UploadMeta) => {
  const {section, name, size, isFi, type, modified} = meta;

  let written_size:number = await Node.Create('Item',
    {userID, section, parent, oID},
    {name, size, isFi, type, modified }
  );

  if (written_size) {
    await Account.Write({"user": userID, "type": "Increment", "parentKey": "plan", "childKey": "used", "data": written_size})
  }
}