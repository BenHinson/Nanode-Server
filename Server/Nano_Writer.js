var fs = require('fs-extra');
var path = require('path');

const Nano_Reader = require('./Nano_Reader');
const Helper = require('./helper.js');
// const Encryptor = require('./Encryptor');

const writeJsonFile = require('write-json-file');

const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');
var sanitize = require("sanitize-filename");

const Mongo_Connect = require('./Mongo_Connect.js');
const Link_Coll = Mongo_Connect.getColl('link');
const Account_Coll = Mongo_Connect.getColl('account');
const Download_Coll = Mongo_Connect.getColl('download');

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

module.exports = {
  createUserJSON: function(userID) {
    baseObjects = {"Homepage": {"Spans": {}}, "Files": {}}
    writeJsonFile.sync('F:\\Nanode\\UserJSON\\'+userID+".json", baseObjects);
  },

  setUpDrive: async(userID) => {
    writeJSONObject(userID, "New", "Homepage", "Span", {"Name": {"Cur":"General"}})
  
    let StartingFolders = ["Documents", "Games", "Media", "Music", "Notes"];
    for (let i=0; i<StartingFolders.length; i++) {
      await writeJSONObject(userID, "New", "Homepage", "Folder", {"UUID": uuidv1(),"Name":{"Cur":StartingFolders[i]},"Span":"Main","Parent":"Main","Type":{"isFi": false}, "Time": {"ModiT":new Date(Date.now())}});
    }
  },

  Account_Write: async (userID, writeTo, data) => {
    // writeTo = "settings"
    // data = {"reviews": {"username": "zen", "comment": "traaaash"} }
    // Load current data. if blank, write new, else merge the new with it and write.
    let newData = {}
    let current = await Nano_Reader.Account_Get(userID, [writeTo]);
    if (typeof current[writeTo] != 'undefined') { newData[writeTo] = {...current[writeTo], ...data};
    } else { newData[writeTo] = data; }

    return Account_Coll.updateOne({userID: userID}, {$set: newData}, {upsert: true})
    .then(result => { return true })
    .catch(err => {console.error(`Couldn't update account info:  ${err}`); return false; })
  },
  
  writeShareLink: async(linkID, userID, objectID, file, mime) => {
    return Link_Coll.insertOne({url: linkID, owner: userID, object: objectID, file: file, mime: mime})
    .then(result => {
      module.exports.Account_Write(userID, "share_links", {linkID: {"file": file}});
      return true;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },

  writeDownloadLink: async(linkID, For, userID, Size, Contents, Title) => {
    let Preview = [];
    for (i=0; i<Contents.length; i++) { if ( (/image|video|text/g).test(Contents[i].Mime) ) {Preview.push({"File":Contents[i].File_Name, "Mime": Contents[i].Mime})} };
    Contents = Contents.map(obj => ({Name: obj.Name, Mime: obj.Mime}))
    return Download_Coll.insertOne({url: linkID, for: For, owner: userID, title: Title, size: Size, contents: Contents, preview: Preview})
    .then(result => {
      if (For == "SHARE") {module.exports.Account_Write(userID, "download_links", {linkID: {"title": Title, "size": Size, "items": Contents.length}});}
      return true;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

const writeJSONObject = async (UUID, Action, Path, Type, Data) => {

  let usersJSONfile = await Nano_Reader.usersLoad(UUID);

  if (Action == "New") {
    let Name = Data.Name.Cur ? sanitize(Data.Name.Cur) : "New"+Type;

    if (Type == "Span") {
      if (!usersJSONfile.Homepage.Spans[ Name ]) {
        usersJSONfile.Homepage.Spans[ Name ] = {"Contents": []};
        writeJsonFile.sync('F:\\Nanode\\UserJSON\\'+UUID+".json", usersJSONfile);
      }
      return;
    }

    if (Path == "Homepage") {
      if (!usersJSONfile.Homepage.Spans[ Data.Span ]) {
        usersJSONfile.Homepage.Spans[ Data.Span ] = {"Contents": []};
      }
      usersJSONfile.Homepage.Spans[ Data.Span ].Contents.push( Data.UUID );
    } else { usersJSONfile.Files[ Path ].Contents.push( Data.UUID ); }

    let Combined = {...Helper.Base_Object, ...Data};
    if (Type == "File") { Combined.Contents = Data.UUID }
    usersJSONfile.Files[ Data.UUID ] = Combined;
  }
  
  else if (Action == "Edit") {

    if (Path == "Homepage" && Type == "Span") { // Change the Name of a Span on the Homepage.
      if (usersJSONfile.Homepage.Spans[ Data.OldSpanName ] && Data.OldSpanName != "General" && Data.OldSpanName != "Uploads") {
        SpanContents = usersJSONfile.Homepage.Spans[ Data.OldSpanName ]['Contents'];
        SpanContents.forEach(function(item) {
          usersJSONfile.Files[ item ]['Span'] = Data.NewSpanName;
        })
        usersJSONfile.Homepage.Spans[Data.NewSpanName] = usersJSONfile.Homepage.Spans[Data.OldSpanName];
        delete usersJSONfile.Homepage.Spans[Data.OldSpanName]
      }
      return;
    }

    if ( usersJSONfile.Files[ Path ] ) {
      var objectInQuestion = usersJSONfile.Files[ Path ];
      objectInQuestion.Time.ModiT = new Date(Date.now())

      if (Type == "Move") {
        
        if (objectInQuestion.Span && usersJSONfile.Homepage.Spans[ objectInQuestion.Span ]) { // Removes from Span if Span
          usersJSONfile.Homepage.Spans[ objectInQuestion.Span ].Contents = usersJSONfile.Homepage.Spans[ objectInQuestion.Span ].Contents.filter(item => item !== Path);
        } else if (objectInQuestion.Parent && usersJSONfile.Files[ objectInQuestion.Parent ]) { // Removes from Parent if Parent
          usersJSONfile.Files[ objectInQuestion.Parent ].Contents = usersJSONfile.Files[ objectInQuestion.Parent ].Contents.filter(item => item !== Path)
        }

        if (Data.ToType == "Span") {
          usersJSONfile.Homepage.Spans[ Data.To ].Contents.push( Path );
          objectInQuestion.Span = Data.To; objectInQuestion.Parent = Data.To;
        } else if (Data.ToType == "Folder") {
          usersJSONfile.Files[ Data.To ].Contents.push( Path );
          objectInQuestion.Span = ""; objectInQuestion.Parent = Data.To;
        }
      }
      else {
        for (var keyVal in Data) {
          if (Data.hasOwnProperty(keyVal)) {
            if (keyVal != "Size" && keyVal != "Security" && keyVal != "Type" && keyVal != "Contents" && keyVal != "UUID") {
              if (typeof Data[keyVal] == "object") {
                for (var key in Data[keyVal]) {
                  if (Data[keyVal].hasOwnProperty(key)) {
                    if (key == "Cur") { objectInQuestion[ keyVal ]['Pre'] = objectInQuestion[ keyVal ]['Cur'] }
                    objectInQuestion[ keyVal ][ key ] = Data[keyVal][key];
                  }
                }
              } else {
                objectInQuestion[ keyVal ] = Data[keyVal];
              }
            }
          }
        }
      }
      usersJSONfile.Files[ Path ] = objectInQuestion;
    }
  }

  else if (Action == "Delete") {
    let userBin = [];

    // Make Duplication of the Element in Memory, Delete Original and Remove Pointers.
    if (Path == 'Codex' && usersJSONfile.Codex[Type][Data] != null) {
      Object_Dupe = usersJSONfile.Codex[Type][Data]; 
      delete usersJSONfile.Codex[Type][Data];
      usersJSONfile.Codex[Type][Object_Dupe.Parent].Contents = usersJSONfile.Codex[Type][Object_Dupe.Parent].Contents.filter(item => item !== Data)
    }
    else if (Type == 'Span' && usersJSONfile.Homepage.Spans[Data] != null) {
      Object_Dupe = usersJSONfile.Homepage.Spans[Data]; 
      delete usersJSONfile.Homepage.Spans[Data];
      usersJSONfile.Homepage.Spans[Object_Dupe.Parent].Contents = usersJSONfile.Homepage.Spans[Object_Dupe.Parent].Contents.filter(item => item !== Data)
    }
    else {
      Object_Dupe = usersJSONfile.Files[Data]; 
      delete usersJSONfile.Files[Data];
      if (Object_Dupe.Span) { usersJSONfile.Homepage.Spans[Object_Dupe.Span].Contents = usersJSONfile.Homepage.Spans[Object_Dupe.Span].Contents.filter(item => item !== Data) }
      else {usersJSONfile.Files[Object_Dupe.Parent].Contents = usersJSONfile.Files[Object_Dupe.Parent].Contents.filter(item => item !== Data)}
    }

    // Read Type, Contents, Sub Contents and Delete Files
    OD_Type = (typeof Object_Dupe.Type == "object") ? Object_Dupe.Type.isFi == true ? "File" : "Folder" : Object_Dupe.Type == "Folder" ? "Folder" : "File";
    console.log(OD_Type)

    let dateNow = new Date(Date.now())
    
    if (OD_Type == "File") {
      userBin.push(Object_Dupe);
    } else {
      removeChildren(Object_Dupe);

      function removeChildren(Object_Dupe) {
        for (i=0; i < Object_Dupe.Contents.length; i++) {

          let itemType = (Path == "Codex") ? (usersJSONfile.Codex[Type][ Object_Dupe.Contents[i] ].Contents != null) ? "Folder" : "File" : (usersJSONfile.Files[ Object_Dupe.Contents[i] ].Type.isFi == true) ? "File" : "Folder";

          console.log(itemType)

          if (itemType == "File") {
            let Delete_File = uuidv3(Object_Dupe.Contents[i], UUID);
            fs.unlink('F:\\Nanode\\UsersContent\\'+Delete_File, (err) => {
              if (err) console.log(err);
              Path == "Codex"? delete usersJSONfile.Codex[Codex][ Object_Dupe.Contents[i] ] : delete usersJSONfile.Files[ Object_Dupe.Contents[i] ];
            })
          } else {
            let childObject = Path == "Codex" ? usersJSONfile.Codex[Codex][ Object_Dupe.Contents[i] ] : usersJSONfile.Files[ Object_Dupe.Contents[i] ]
            removeChildren(childObject)
          }
        }
        Path == "Codex" ? delete usersJSONfile.Codex[Codex][ Object_Dupe.UUID ] : delete usersJSONfile.Files[ Object_Dupe.UUID ];
      }
    }


    // Move userBin Objects to Bin
    if (userBin.length) {
      if (!usersJSONfile["Bin"]) { usersJSONfile.Bin = {"Main": {}, "Codex": {}} }
      for (i=0; i<userBin.length; i++) {
        userBin[i].Time.DeleT = dateNow;
        if (Path == "Codex") { usersJSONfile.Bin.Codex[userBin[i].UUID] = userBin[i] }
        else { usersJSONfile.Bin.Main[userBin[i].UUID] = userBin[i]; }
      }
    }

  }
  
  else if (Action == "Codex") {
    if (usersJSONfile.Codex) {
      let CodexParent = Data.Parent;
      dateNow = new Date(Date.now())

      if (Type == "Move") { // Moving Files from Dir
        usersJSONfile.Codex[Path][CodexParent].Contents = usersJSONfile.Codex[Path][CodexParent].Contents.filter(item => item !== Data.OID)
        usersJSONfile.Codex[Path][Data.To].Contents.push(Data.OID)

        usersJSONfile.Codex[Path][Data.OID].Time.ModiT = dateNow;
        usersJSONfile.Codex[Path][Data.OID].Parent = Data.To;
      } 
      else { // Making Files in Dir
        let CodexObjectUUID = uuidv1();
        let CodexName = sanitize(Data.Name);

        if (Type == "Make") { // Folder
          CodexObject = {"UUID": CodexObjectUUID, "Name": CodexName, "Codex": Path, "Parent": CodexParent,  "Type": "Folder", "Contents": []}
        } else {
          if (Path == "Audio") { CodexObject = {"UUID":CodexObjectUUID,"Name":CodexName, "Codex": Path, "Parent": CodexParent, "Duration":Data.Duration,"Size":Data.Size,"Type":Data.Type,"Time":{"ModiT": dateNow}}; }
          else { CodexObject = {"UUID":CodexObjectUUID,"Name":CodexName, "Codex": Path, "Parent": CodexParent, "F100C":Data.F100C,"Size":Data.Size,"Type":Data.Type,"Time":{"ModiT":dateNow}}; 
        }
    
          let FileName = uuidv3(CodexObjectUUID, userID)
          fs.writeFileSync('F:\\Nanode\\UsersContent\\' + FileName, Data.Data);
        }
        if (CodexParent == "Home") {usersJSONfile.Codex[Path]["Home"].Contents.push(CodexObjectUUID)}
        else { usersJSONfile.Codex[Path][CodexParent].Contents.push(CodexObjectUUID) }
        usersJSONfile.Codex[Path][CodexObjectUUID] = CodexObject;
      }

    } else {
      usersJSONfile.Codex = {"Text": {"Home": []}, "Video": {"Home": []}, "Audio": {"Home": []}}
    }
  }

  else if (Action == "Bin") {
    if (Data == "Rescue") {

      if (usersJSONfile.Bin[Type][Path]) {var objectInQuestion = usersJSONfile.Bin[Type][Path]} else { return };

      if (objectInQuestion.Span &&  (Type == "Main" ? usersJSONfile.Homepage.Spans[ objectInQuestion.Span ] : usersJSONfile.Codex[ objectInQuestion.Codex ].Spans[ objectInQuestion.Span ])  ) {
        // Parent Span still Exists
        Type == "Main" ? usersJSONfile.Homepage.Spans[ objectInQuestion.Span ].Contents.push( Path )
         : usersJSONfile.Codex[ objectInQuestion.Codex ].Spans [ objectInQuestion.Span ].Contents.push(Path)
      } else if (Type == "Main" ? usersJSONfile.Files[ objectInQuestion.Parent ] : usersJSONfile.Codex[ objectInQuestion.Codex ][ objectInQuestion.Parent ] ) {
        // Parent still Exists
        Type == "Main" ? usersJSONfile.Files[ objectInQuestion.Parent ].Contents.push( Path )
         : usersJSONfile.Codex[ objectInQuestion.Codex ][ objectInQuestion.Parent ].Contents.push( Path )
      } else {
        // Span and/or Parent was deleted. Setting Parents to Fixed "General" or "Home"
        if (Type == "Main") {
          usersJSONfile.Homepage.Spans[ "General" ].Contents.push(Path)
          Object.assign( objectInQuestion, {Span: "General", Parent: "General"})
          objectInQuestion.Path.Cur = "General";
        } else if (Type == "Codex") {
          usersJSONfile.Codex[ objectInQuestion.Codex ][ "Home" ].Contents.push(Path)
          Object.assign( objectInQuestion, {Parent: "Home"})
        }
      }
      objectInQuestion.Time.RecovT = new Date(Date.now());
      Type == "Main" ?  usersJSONfile.Files[ Path ] = objectInQuestion : usersJSONfile.Codex[ objectInQuestion.Codex ][ Path ] = objectInQuestion
      delete usersJSONfile.Bin[Type][Path];
    } 
    else if (Data == "Delete") {
      if (!usersJSONfile.Bin[Type][Path].Contents) return;
      let Delete_File = uuidv3(usersJSONfile.Bin[Type][Path].Contents, UUID);
      fs.unlink('F:\\Nanode\\UsersContent\\'+Delete_File, (err) => {
        if (err) console.log(err);
        delete usersJSONfile.Bin[Type][Path];
      })
    }
  }

  await writeJsonFile('F:\\Nanode\\UserJSON\\'+UUID+".json", usersJSONfile);

  return true;
}

module.exports.writeJSONObject = writeJSONObject;



// let New_Item = {
//   "Name": {"Cur":'Holiday Photos'},
//   "Span": 'Photos',
//   "Path": {"Cur":"/Photos/"},
//   "Parent": 'Photos',
//   "Type": {"isFi": false},
//   "Security": {"Pass": 'password', "Time": {"Start":'16:00', "End": '18:00'}, "Pin": '123'},
//   "Description": 'Some normal arbitary description',
//   "Tags": {"Color": 'i like red'}
// };