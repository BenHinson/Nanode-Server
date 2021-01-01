// ------ Storage Engine Rework ------ 15/12/2020
// ------ Nano Storage Engine ------

const Mongo_Connect = require('./Mongo_Connect.js');
const Nano_Coll = Mongo_Connect.getColl("nano");

const Helper = require('./helper.js');

const crpyto = require('crypto');
const { nanoid } = require('nanoid');
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');
const { MongoParseError } = require('mongodb');
const { move } = require('fs-extra');

// ===================================================

const Nano_Account = {
  "size": {
    "total": {},
  },
  "enc_key": "",
  "recent": {},
  "home": {
    "main": [],
  },
  "main": {}
};

const Nano_Item = {
  "id": "",
  "name": "",
  "parent": "",
  "contents": {},
  "type": {
    "file": ""
  },
  "size": "",
  "time": {
    "created": {
      "stamp": "",
      "who": ""
    }
  },
};
const Contents_Item = {
  "name": "",
  "mime": "",
  "size": "",
  "time": ""
};

// =====================  NANO  =====================

module.exports = {

  Write: async(Set, Mongo={}) => { // !CHECK SPAN NAME DOESNT ALREADY EXIST.
    const {user, type, section, parent, data} = Set;

    if (parent.match(/home|homepage/i)) { // Write to Sections Home
      type == "Span"
        ? Mongo.$set = { [`${section}.${data.id}`]: {"name": data.name, "contents": {}} }
        : Mongo.$set = { [`${section}.${data.id}`]: {...Nano_Item, ...data} }
      Mongo.$push = { [`home.${section}`]: data.id }
      Mongo.$inc = { [`size.total.${type == "Span" ? "SPAN" : Helper.BaseType(data.type.mime)}`] : data.size || 1 }
    } else if (type.match(/Item|Folder|File/i)) { // Write File OR Folder to Section
      Mongo.$set = {
        [`${section}.${data.id}`] : {...Nano_Item, ...data},
        [`${section}.${data.parent}.contents.${data.id}`]: Short_Contents(data),
      }
      Mongo.$push = { [`recent.${section}`]: {$each: [data.id], $slice: -8} }
      Mongo.$inc = { [`size.total.${Helper.BaseType(data.type.mime)}`]: data.size || 1 }
    } else {return false;}
    Nano_Set(user, Mongo);
  },

  Edit: async(uID) => {
    console.log("EDIT DATA HERE")
  },

  Read: async(Query, Project={}) => {
    const {user, type, section, ids, contents, keys, internal, CUSTOM} = Query;

    if (CUSTOM) {
      Project = CUSTOM;
    }
    else if (type == "HOME") {     // Returns Short-Nanodes of the specified sections homepage
      let Spans = await Nano_Get(user, {[`home.${section}`]: 1});
      Project = ID_Query(section, Spans[0]['home'][section]);
    }
    else if (type == "ID") {    // Returns either full nanode of specified or its contents
      Project = ID_Query(section, ids, contents);
    }
    else if (type == "RAW") {     // Returns the long-nanodes of items contents 
      let ID_Contents = await Nano_Get(user, ID_Query(section, ids, true));
      let List_Of_IDs = [];
      for (const item in ID_Contents[0][section]) {
        List_Of_IDs = List_Of_IDs.concat(Object.keys( ID_Contents[0][section][item].contents ))
      }
      Project = ID_Query(section, List_Of_IDs);
    } 
    else if (type == "SPECIFIC") {    // Returns Specific Values from Nanos
      ids.forEach(id => { Project[`${section}.${id}`] = Key_Query(keys) })
    }
    else if (type == "TREE") {    // Returns Array of Children IDs & Children Nanos from Object
      let Tree = {"Parent_Id": [], "Parent_Nano": {}, "Child_Id": [], "Child_Nano": {}}
      Tree = await Get_Nano_Children(ids[0], Tree);
      return Tree;

      async function Get_Nano_Children(id, Tree) {
        let Nano = await Nano_Get(user, ID_Query(section, [id], false));
        Nano = Nano[0][section][id];
        Tree.Parent_Id.length ? Tree.Child_Id.push(Nano.id) : Tree.Parent_Id.push(Nano.id);
        Object.keys(Tree.Parent_Nano).length === 0 ? Tree.Parent_Nano[Nano.id] = Nano : Tree.Child_Nano[Nano.id] = Nano;
        if (Nano.type.file === false) {
          let Children_IDs = Object.keys(Nano.contents);
          for (let c=0; c<Children_IDs.length; c++) {
            await Get_Nano_Children(Children_IDs[c], Tree);
          }
        }
        return Tree;
      }
    }

    let Result = await Nano_Get(user, Project);
    return Result[0][section] || Result[0];
  },

  Account_Setup: function(uID) {
    let check = Nano_Coll.find({uID: uID}, {$exists: true}).limit(1).toArray();
    if (check.length) {console.log("Nano_Account Already Exists"); return;}

    Nano_Account._id = uID;
    Nano_Account.enc_key = crpyto.randomBytes(32);

    return Nano_Coll.insertOne(Nano_Account)
      .then(async() => { return true; })
      .catch(err => {console.log(`Couldnt Create Nano Account: ${err}`); return false; })
  },
}

Short_Contents = function(fir, sec) {
  !fir.type ? fir.type = {} : fir.type;
  return {...Contents_Item, ...{"name": fir.name || sec.name, "mime": fir.type.mime || sec.type.mime, "size": fir.size || sec.size, "time": fir.time || sec.time}}
}

ID_Query = function(section, Query, contents, created={}) {
  Query.forEach(item => { created[`${section}.${item}${contents ? ".contents" : ""}`] = 1 });
  return created;
}

ID_Set = function(section, Query, created={}) {
  Query.forEach(item => created[`${section}.${item}`] = '')
  return created;
}

Key_Query = function(Keys, created={}) {
  Keys.forEach(key => { created[key] = 1 });
  return created;
}

Key_Set = function(Set, created={}) {
  const {Pre, Change, Negative} = Set;
  for (const [key, value] of Object.entries(Change)) { created[`${Pre}.${key}`] = (Negative ? -Math.abs(value) : value) };
  return created;
}

Key_Counter = function(Nano_List, wanted, counter={}) {
  Array.isArray(Nano_List) ? '' : Nano_List = Object.keys(Nano_List).map((key) => Nano_List[key]);
  Nano_List.forEach(nano => { 
    let type = wanted == "size" ? Helper.BaseType(nano.type.mime) : wanted;
    typeof counter[type] == 'number' ? '' : counter[type] = 0;
    counter[type] += ~~(nano[wanted]) })
  return counter;
}

////// =============== =========== ======== === =

Nano_Exists = async(uID, check) => {
  const {section, id} = check;
  return await Nano_Coll.findOne({
    "_id": uID,
    [`${section}.${id}`]: {$exists: true}
  }).then(items => { return items ? true : false })
}

Nano_Get = async(uID, fetch) => {
  return await Nano_Coll.aggregate([
    { $match: { '_id': uID } },
    { $project: fetch}
  ]).toArray();
};

Nano_Set = async(uID, set) => {
  return Nano_Coll.updateOne(
    {"_id": uID},
    set
  )
};

// =====================  CMDS  =====================

let uID = "56d0bc91-229e-4109-9fd5-d968386518a6";
// let uID = "41feb20c-ad74-4b57-abbb-a695334c3569";

;(async() => {

  // ------------------- READ -------------------
  // const {user, type, section, ids, contents, internal, CUSTOM} = Query;

  // console.log(await module.exports.Read({ // Read the RAW contents of IDs
  //   "user": uID,
  //   "type": "RAW", // String: Replace with ID to Read Short-Contents or Whole Item
  //   "section": "main", // String: main || codex || blocks
  //   "ids": ["SPAN_MAIN_ID","a41NjIfCtTHoB4glgNzyf"],  // Array: _+SpanName AND/OR itemID
  //   "contents": true,  // Boolean: List Short-Contents or Long. Defaults to True if RAW
  //   "internal": false, // Boolean: Specifies whether to remove certain data from result.
  //   "CUSTOM": false, // false OR the Mongo Query. Sets $project to this input.
  // }))

  // console.log(await module.exports.Read({ // Read the Home Nanos or Spans
  //   "user": uID,
  //   "type": "HOME",  // String: Returns Starting Dir / Spans of section
  //   "section": "main", // String: main || codex || blocks
  // }))
  
  // await module.exports.Read({"user": uID, "type": "SPECIFIC", section: section, "ids": [id], "keys": ["parent", "name", "size", "type", "time"]});

  // ------------------- WRITE -------------------
  // const {user, type, section, parent, data} = Set;

  
  // Create an Account in Nano
  // await module.exports.Account_Setup(uID);
  
  let TEST_ITEM_ID = uuidv1();
  let WRITTEN_FOLDER = {
    "id": TEST_ITEM_ID,
    "name": "Holiday Photos: 2017",
    "parent": "homepage",
    "type": {
      "file": false,
      "mime": "FOLDER"
    },
    "time": {
      "created": {
        "stamp": Helper.timeNow(),
        "who": uID
      }
    },
    "description": "Photos taken on holiday 2017"
  }
  let WRITTEN_FILE = {
    "id": TEST_ITEM_ID,
    "name": "Photo - Me: 2017",
    "parent": "c7ced0a0-4395-11eb-b6fd-5f5e172bee5c",
    "contents": {
      "drive": "F",
      "file": uuidv3(TEST_ITEM_ID, uID)
    },
    "type": {
      "file": true,
      "mime": "image/png"
    },
    "size": 6781213,
    "time": {
      "created": {
        "stamp": Helper.timeNow(),
        "who": uID
      }
    },
  }

  // await Nano_Exists(uID, {"section": "main", "id": "Uploads"})
  // console.log(await module.exports.Write({
  //   "user": uID,
  //   "type": "Span",
  //   "section": "main",
  //   "parent": "homepage",
  //   "data": {"name": "Uploads"}
  // }))

  // console.log(await module.exports.Write({
  //   "user": uID,
  //   "type": "FOLDER",
  //   "section": "main",
  //   "parent": "SPAN_MAIN_ID",
  //   "data": WRITTEN_FOLDER
  // }))

  // console.log(await module.exports.Write({
  //   "user": uID,
  //   "type": "File",
  //   "section": "codex",
  //   "parent": "c7ced0a0-4395-11eb-b6fd-5f5e172bee5c",
  //   "data": WRITTEN_FILE
  // }))


  // ------------------- EDIT -------------------
  // Move , Delete / Rescue
  // Restricted Edits - : "Size" "Security" "Type" "UUID"
  // Write previous names to an items 'previous' section. This gets searched. cap array at 5 names

  // console.log(await Edit({
  //   "user": uID,
  //   "type": "DATA",
  //   "section": "codex",
  //   "id": "69405df0-439b-11eb-86ec-bb7a7247d54a",
  //   "changeTo": {
  //     "name": "A different photo",
  //     "description": "This is my new Description.",
  //     "type": {"mime": "image/png"}
  //   }
  // }))

  console.log(await Edit({
    "user": uID,
    "type": "MOVE",
    "section": "codex",
    "id": "c7ced0a0-4395-11eb-b6fd-5f5e172bee5c", // 69405df0-439b-11eb-86ec-bb7a7247d54a
    "moveTo": "bin",
  }))

})();

// Codex Into Sections: Video, Music, Audio
// Blocks Structure: Blocks = [ Block: [ WEB: {}, IMG: {}, TXT: {}, FILES: {}, ... ], ... ]


async function Edit(Edit, Mongo={}) {  
  const {user, type, section, id, changeTo={}, moveTo} = Edit;

  changeTo.time = {"modified": {"stamp": Helper.timeNow(), "who": user}};

  let current = await module.exports.Read({"user": user, "type": "ID", "section": section, "ids": [id]})
  current = current[id];

  if (type == "SPAN" && changeTo) {
    Mongo.$addFields = { [`${section}.${id}`]: changeTo };
  } 
  else if (type == "DATA" && changeTo) {
    Mongo.$addFields = {  [`${section}.${id}`]: changeTo };
    Mongo.$set = { [`${section}.${current.parent}.contents.${id}`]: Short_Contents(changeTo, current) };
  }
  else if (type == "MOVE" && moveTo) {
    const External = moveTo.match(/bin|main|codex|block/i);

    const New_Parent = External ? (moveTo == "main" ? await Nano_Get(user, {[`home.${moveTo}`]: 1}).then((res) => res[0]["home"][moveTo][0]) : "homepage" ) : moveTo;
    console.log(New_Parent);

    (current.parent).toLowerCase() == "homepage" // Remove From Parents
      ? Mongo.$pull = { [`home.${section}`]: id }
      : Mongo.$unset = [`${section}.${current.parent}.contents.${id}`]

    New_Parent.toLowerCase() == "homepage" // Set to New Parents
      ? Mongo.$push = { [`home.${moveTo}`]: id }
      : Mongo.$set = { [ External ? `${moveTo}.${New_Parent}.contents.${id}` : `${section}.${moveTo}.contents.${id}` ]: Short_Contents(changeTo, current) }
    
    if (External) {
      let Contents_Tree = await module.exports.Read({"user": user, "type": "TREE", "section": section, "ids": [id]});
      Mongo.$unset = ID_Set(section, [...Contents_Tree.Parent_Id, ...Contents_Tree.Child_Id]);

      Contents_Tree.Parent_Nano[id].parent = New_Parent;

      if (moveTo == "bin") {
        Contents_Tree.Parent_Nano[id].time['deleted'] = {"stamp": Helper.timeNow(), "who": user};
        let Total_Tree_Size = Key_Counter( {...Contents_Tree.Parent_Nano, ...Contents_Tree.Child_Nano} , "size");
        Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size, "Negative":true })
        Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size }, Mongo.$inc)
      } else if (section == "bin") {
        Contents_Tree.Parent_Nano[id].time['recovered'] = {"stamp": Helper.timeNow(), "who": user};
      }

      Mongo.$set = Key_Set({ "Pre":moveTo, "Change":{...Contents_Tree.Parent_Nano, ...Contents_Tree.Child_Nano} }, Mongo.$set)
    } 
    else {
      Mongo.$set = {  [`${section}.${id}.parent`]: moveTo }
    }
  }
  else { return; }

  console.dir(Mongo);
  // Nano_Set(user, Mongo);
}