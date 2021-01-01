const helper = require('./helper.js');
const loadJsonFile = require('load-json-file');
const uuidv3 = require('uuid/v3');

const Mongo_Connect = require('./Mongo_Connect.js');
const Link_Coll = Mongo_Connect.getColl('link');
const Account_Coll = Mongo_Connect.getColl('account');
const Download_Coll = Mongo_Connect.getColl('download');

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

// Searching for a file: https://jsfiddle.net/FlimFlamboyant/we4r36tp/26/    https://stackoverflow.com/questions/60591623/how-to-perform-fast-search-on-json-file

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

module.exports = {

  Account_Get: async (userID, wanted) => {
    // wanted = ["username", "userID"]
    return Account_Coll.find({userID: userID}, {$exists: true})
    .toArray()
    .then(account => { 
      let data = {}; 
      for (let i=0; i<wanted.length; i++) {
        if (wanted[i] != "password") {data[wanted[i]] = account[0][wanted[i]]}
      }
      return data;
    })
    .catch((err) => { return false; })
  },

  readShareLink: async (linkID) => {
    return Link_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },
  
  readDownloadLink: async (linkID) => {
    return Download_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },

  usersLoad: async(UUID) => {
    return await loadJsonFile('F:\\Nanode\\UserJSON\\'+UUID+".json")
  },
  
  returnInformation: async (UUID, After, Path, Find) => {
  
    let usersJSONfile = await module.exports.usersLoad(UUID);
  
    let returnArray = []; let Children = []; let Contents = []; let InfoWanted = []
  
    if (After == "Main_Contents") {
  
      if (Path == "Homepage") {
        let Spans = usersJSONfile.Homepage.Spans;
        returnArray.push({"NanoID": "Homepage", "Name": "Homepage"})
        for (span in Spans) {
          Children = [];
          for (i=0; i<usersJSONfile.Homepage.Spans[span].Contents.length; i++) {
            Children.push(usersJSONfile.Homepage.Spans[span].Contents[i]);
          }
          Contents.push([span, Children])
        }
      } else {
        if (usersJSONfile.Files[Path] && !usersJSONfile.Files[Path].Type.isfi) {
          let objectInQuestion = usersJSONfile.Files[Path];
          returnArray.push({"NanoID": Path, "Name": objectInQuestion.Name.Cur, "Share": objectInQuestion.Share})
          Contents.push([Path, objectInQuestion.Contents])
        }
      }
    }
    else if (After == "Main_Children") {
      ItemsTrees = {}
      for (let i=0; i<Path.length; i++) {
        let ItemName = usersJSONfile.Files[Path[i]].Name.Cur;
        ItemsTrees[helper.dupeNameIncrement(ItemsTrees, ItemName)] = getFileChildren(Path[i], {}, true);
      }
      return ItemsTrees;
  
      function getFileChildren(OID, Tree = {}, folder = false) {
        let item = usersJSONfile.Files[OID];
        let itemName = helper.dupeNameIncrement(Tree, item.Name.Cur);
        if (item.Type.isFi) {
          folder ? 
          Tree = {"Name": item.Name.Cur, "Mime": item.Type.mimeT, "File_Name": uuidv3(item.UUID, UUID), "Size": item.Size}
          : Tree[itemName] = {"Name": item.Name.Cur, "Mime": item.Type.mimeT, "File_Name": uuidv3(item.UUID, UUID), "Size": item.Size};
        } else if (item.Contents) {
          Tree = Tree[itemName] = {};
          for ( var c=0; c<item.Contents.length; c++) {
            getFileChildren(item.Contents[c], Tree);
          }
        }
        return Tree;
      }
    }
    else if (After == "Information") {
      if (!usersJSONfile.Files[Path]) { return false; }
      let object = usersJSONfile.Files[ Path ];
      Find.forEach(function(key) {
        if (object == undefined) {return;}
        returnArray.push(object[key])
      })
      return returnArray;
    }
  
    
    
    else if (Path == "Codex") {
      if (usersJSONfile.Codex) {
        let contents = usersJSONfile.Codex[After][Find].Contents;
        for (i=0; i<contents.length; i++) {
          returnArray.push(usersJSONfile.Codex[After][contents[i]]);
        }
        return returnArray; /////////////////////
      }
    }
    else if (After == "Codex_Children") {
      let contents = usersJSONfile.Codex[Path][Find].Contents;
      for (var i=0; i<contents.length; i++) {
        getCodexChildren(contents[i])
      }
  
      function getCodexChildren(OID) {
        let item = usersJSONfile.Codex[Path][OID]
        if (item.Type !== "Folder") {
          returnArray.push( item );
        } else if (item.Contents) {
          let subContents = item.Contents;
          for ( var j=0; j<subContents.length; j++) {
            getCodexChildren(subContents[j])
          }
        }
      }
  
      return returnArray;
    }
    else if (After == "CodexInfo") {
      return usersJSONfile.Codex[Find[0]][Path][Find[1]];
    }
    
  
    else if (Path == "Bin") {
      let Bin = usersJSONfile.Bin[Find];
      for (Item in Bin) {
        InfoWanted = ([Bin[Item].UUID, Bin[Item].Name, Bin[Item].Type, Bin[Item].Time.DeleT, Bin[Item].Size]);
        returnArray.push(InfoWanted);
      }
      return returnArray; /////////////////////
    }
  
  
    // Contents if the UUID of the Item (For Directory); ["Homepage", [ "uuid", "uuid", "uuid" ]]
    let ContentsTrim = [];
    Contents.forEach(function(Parent, index) {
      let Parent_Contents = {};
      let Children = Parent[1];
      // InfoWanted = [];
      for (i=0; i<Children.length; i++) {
        let obj_data = usersJSONfile.Files[Children[i]];
        if (!obj_data) { console.log("Object Doesnt Exist. Are they all 36 Characters"); continue; }
        // InfoWanted.push([obj_data.Name.Cur, obj_data.Path.Cur, obj_data.Type, obj_data.Time.ModiT, obj_data.Size, obj_data.Tags, obj_data.UUID])
        Parent_Contents[Children[i]] = {"Name": obj_data.Name.Cur, "Path": obj_data.Path.Cur, "Type": obj_data.Type, "ModiT": obj_data.Time.ModiT, "Size": obj_data.Size, "Tags": obj_data.Tags, "OID": obj_data.UUID}
        if (obj_data.Type && obj_data.Type.isfi) {
          console.log("RETURN ENCRYPTED FILE LINK")
        }
      }
      // returnArray.push([Parent[0], InfoWanted])
      ContentsTrim.push({"Parent": Parent[0], "Contents": Parent_Contents})
      if (index == Contents.length - 1) { returnArray.push(ContentsTrim) }
    })
    return returnArray;
  },
}