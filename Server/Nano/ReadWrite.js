var fs = require('fs-extra');
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');
const FileType = require('file-type');

const Helper = require('../helper.js');
const Modify = require('./modify.js');
const Node = require('../Node/node.js');
const Account = require('../Account/account.js');


const UploadLocation = 'F://Nanode/Files/';
const MassDirectory = `${UploadLocation}/Mass/`;
const Chunk_Storage = `${UploadLocation}/Chunks/`;
const End_Storage = `${UploadLocation}/Mass/`;

Upload_Object_Tree = {}; // Seperates Uploads by Account IDs

//////////////////////////////////////////////////////////////////////

module.exports = {
  Mass: function(res, id, mimetype, resize) {
    // console.log(MassDirectory+id);
    fs.readFile(MassDirectory+id, async(err, data) => {
      if (err) {
        console.log("File Not Found");
        return Helper.ErrorPage(res);
      } else {
        res.setHeader("Content-Type", mimetype);
        res.writeHead(200);

        if (resize) {
          Modify.Resize(res, data, resize.width, resize.height);
        } else {
          res.end(data);
        }
      }
    })
    return;
  },

  UploadCheck: function(user, reset) {
    return reset ? Upload_Object_Tree[user] = [] : Upload_Object_Tree[user]
  },

  Upload: async function(chunk) {
    const {user, id, index, total, FileArray} = chunk;
    
    const ThisChunkName = Chunk_Storage+["CHUNK", id, index].join('-');
    const PreviousChunkName = Chunk_Storage+["CHUNK", id, index-1].join('-');
    
    if (index > 0) { // Add to Previous
      await fs.promises.appendFile(PreviousChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
      await fs.promises.rename(PreviousChunkName, ThisChunkName).catch(err => {console.log(err); return "Failed"});
    } else {
      await fs.promises.writeFile(ThisChunkName, FileArray).catch(err => {console.log(err); return "Failed"});
    }

    if (index >= total - 1) { // Finish Up by Moving File and Renaming
      let file_oID = uuidv1();
      let file_type = await FileType.fromFile(ThisChunkName);
      await fs.promises.rename(ThisChunkName, End_Storage+uuidv3(file_oID, user)).catch(err => {console.log(err); return "Failed"});
      return {"written": true, file_oID, file_type};
    }
    return "Success";
  },

  Write_To_User_File: async function(user, oID, meta) {
    if (!Upload_Object_Tree[user]) { Upload_Object_Tree[user] = []; }
    let relative_path = meta.relative_path.split('/');
    let fID = await Create_Folders(relative_path.slice(0, -1), user, meta);
    await Create_New_Item(user, oID, fID ?? meta.parent, meta);
  },
}

Create_Folders = async(relative_path, user, meta) => {
  let previous_Folder;
  for (let i=0; i<relative_path.length; i++) {
    if (!relative_path[i]) { continue; }
    let found = Upload_Object_Tree[user].find(item => item[relative_path[i]]);
  	if (found) {previous_Folder = found[relative_path[i]].id; continue; }
    let fID = uuidv1();
    Upload_Object_Tree[user].push( {[relative_path[i]]: {"id": fID}});
    await Create_New_Item(user, fID, previous_Folder ?? meta.parent, {"section": meta.section, "name": relative_path[i]});
    previous_Folder = fID;
  }
  return previous_Folder;

  // let lastFolder = Upload_Object_Tree[user].find(item => meta[relative_path.slice(-1)]); // I may be able to remove these and replace with the previous_Folder variable;
  // return relative_path.length ? lastFolder[relative_path.slice(-1)].id : null; // I may be able to remove these and replace with the previous_Folder variable;
}
Create_New_Item = async(userID, oID, parent, meta) => {
  const {section, name, size, isFi, type, modified} = meta;

  let written_size = await Node.Create('Item',
    {userID, section, parent, oID},
    {name, size, isFi, type, modified }
  );

  if (written_size) {
    await Account.Write({"user": userID, "type": "Increment", "parentKey": "plan", "childKey": "used", "data": written_size})
  }
}