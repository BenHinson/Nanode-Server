// ------ Storage Engine Rework ------ 15/12/2020 > 02/01/2021
// ------ Nano Storage Engine ------

const Mongo_Connect = require('./Mongo_Connect.js');
const Nano_Coll = Mongo_Connect.getColl("nano");

const Helper = require('./helper.js');

const crypto = require('crypto');
const { nanoid } = require('nanoid');
const uuidv1 = require('uuid/v1');

// ===================================================

const Nano_Account = {
  "size": {
    "max": (10 * 1024 * 1024 * 1024), // 10 GB
    "total": {},
    "bin": {}
  },
  "enc_key": "",
  "recent": {},
  "home": {
    "main": [
      "_MAIN_",
      "_GENERAL_"
    ],
    "codex": [],
    "blocks": [],
    "bin": []
  },
  "main": {
    "_MAIN_": {
      "name": "Main",
      "contents": {}
    },
    "_GENERAL_": {
      "name": "General",
      "contents": {}
    }
  },
  "codex": {},
  "blocks": {},
  "bin": {}
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
  "time": "",
  "color": ""
};

// =====================  NANO  =====================

module.exports = {

  Write: async(Set, Mongo={}) => {
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
    
    let Written = await Nano_Set(user, Mongo);
    return Written ? data.size || 1 : false;
  },

  Edit: async(Edit, Mongo={}) => {
    const {user, type, section, id, changeTo} = Edit;
    let {moveTo} = Edit;
  
    changeTo.time = {"modified": {"stamp": Helper.timeNow(), "who": user}};

    ["id", "contents", "size", "security", "type"].forEach(Key => delete changeTo[Key]);
  
    let current = await module.exports.Read({"user": user, "type": "ID", "section": section, "ids": [id]})
    current = current[id];
    
    if (type == "DATA" && changeTo) {
      changeTo.name ? Mongo.$push = { [`${section}.${id}.previous`]: {$each: [changeTo.name], $slice: -5} } : '';
      Mongo.$set = Key_Set({ "Pre": [`${section}.${id}`], "Change": changeTo })

      if (!current.parent.match(/home|homepage/i)) {
        Mongo.$set[`${section}.${current.parent}.contents.${id}`] = Short_Contents(changeTo, current);
      }
    }
    else if (type == "MOVE" && moveTo) {
      Mongo.$set = {};
      const External = moveTo.match(/bin|main|codex|block/); // Dont use i tag: (_MAIN_ will match 'main' if not)
      if (moveTo == "bin") {return "Cannot Move to Bin"}
      if (moveTo == "homepage" && section == "main") { moveTo = "_GENERAL_" };
  
      const New_Parent = External ? (moveTo == "main" ? await Nano_Get(user, {[`home.${moveTo}`]: 1}).then((res) => res[0]["home"][moveTo][0]) : "homepage" ) : moveTo;

      current.parent.toLowerCase() == "homepage" // Remove From Parents
        ? Mongo.$pull = { [`home.${section}`]: id }
        : Mongo.$unset = {[`${section}.${current.parent}.contents.${id}`]: ''}
  
      New_Parent.toLowerCase() == "homepage" // Set to New Parents
        ? Mongo.$push = { [`home.${moveTo}`]: id }
        : Mongo.$set[ External ? `${moveTo}.${New_Parent}.contents.${id}` : `${section}.${moveTo}.contents.${id}` ] = Short_Contents(changeTo, current);
      
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
        Mongo.$set[`${section}.${id}.parent`] = moveTo;
      }
    }
    else { return; }

    // console.log(Mongo); return;
    let Complete = await Nano_Set(user, Mongo);
    return Complete;
  },

  Read: async(Query, Project={}) => {
    const {user, type, section, ids, contents, keys, internal, CUSTOM} = Query;

    if (CUSTOM) {
      Project = CUSTOM;
    }
    else if (type == "ID") {    // Returns either full nanode of specified or its contents
      if (ids[0].match(/home|homepage/i)) {
        let Spans = await Nano_Get(user, {[`home.${section}`]: 1});
        Project = ID_Query({"section":section, "query":Spans[0]['home'][section]});
      } else {
        Project = ID_Query({"section":section, "query":ids, "contents":contents});
      }
    }
    else if (type == "RAW") {     // Returns the long-nanodes of items contents 
      let ID_Contents = await Nano_Get(user, ID_Query({"section":section, "query":ids, "contents":true}));
      let List_Of_IDs = [];
      for (const item in ID_Contents[0][section]) {
        List_Of_IDs = List_Of_IDs.concat(Object.keys( ID_Contents[0][section][item].contents ))
      }
      Project = ID_Query({"section":section, "query":List_Of_IDs});
    } 
    else if (type == "SPECIFIC") {    // Returns Specific Values from Nanos
      ids.forEach(id => { Project[`${section}.${id}`] = Key_Query(keys) })
    }
    else if (type == "TREE") {    // Returns Array of Children IDs & Children Nanos from Object
      let Tree = {"Parent_Id": [], "Parent_Nano": {}, "Child_Id": [], "Child_Nano": {}}
      Tree = await Get_Nano_Children(ids[0], Tree);
      return Tree;

      async function Get_Nano_Children(id, Tree) {
        let Nano = await Nano_Get(user, ID_Query({"section":section, "query":[id], "contents":false}));
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

    // console.log(Project);
    let Result = await Nano_Get(user, Project);
    return Result[0][section] || Result[0];
  },

  // ==============

  Account_Setup: async(uID) => {
    let check = Nano_Coll.find({uID: uID}, {$exists: true}).limit(1).toArray();
    if (check.length) {console.log("Nano_Account Already Exists"); return;}

    Nano_Account._id = uID;
    Nano_Account.enc_key = crypto.randomBytes(32);

    let Account_Set = await Nano_Account_Set(Nano_Account);

    if (Account_Set) {
      ["Documents", "Games", "Media", "Music", "Notes"].forEach(async(folder) => {
        await module.exports.Write({
          "user": uID,
          "type": "Folder",
          "section": "main",
          "parent": "_MAIN_",
          "data": {
              "id": uuidv1(),
              "name": folder,
              "parent": "_MAIN_",
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
          }
        })
      });
      return {"result": true};
    } else {return {"result": false, "message": "Failed to Create Account"}};
  },
}

Short_Contents = function(fir={}, sec={}) {
  let ItemsType = fir.type || sec.type || {};
  return {...Contents_Item, ...{"name": fir.name || sec.name || "Unnamed", "mime": ItemsType.mime ||ItemsType.mime || "UNKNOWN", "size": fir.size || sec.size || 1, "color": fir.color || sec.color || '', "time": fir.time || sec.time || {"modified": {"stamp":Helper.timeNow()}} }};
}

ID_Query = function({section, query, contents, internal}, created={}) {
  query.forEach(item => { created[`${section}.${item}${contents ? ".contents" : ""}`] = 1; });
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
  for (let [key, value] of Object.entries(Change)) { 
    typeof value == "object"
      ? created[`${Pre}.${key+="."+Object.keys(value)[0]}`] = (Negative ? -Math.abs(value) : value[Object.keys(value)[0]])
      : created[`${Pre}.${key}`] = (Negative ? -Math.abs(value) : value)}
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
  return Object.keys(fetch).length == 0 
    ? ["Empty Query"] 
    : await Nano_Coll.aggregate([
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

Nano_Account_Set = async(Account_Data) => {
  return Nano_Coll.insertOne(Account_Data)
  .then(async() => { return true; })
  .catch(err => {console.log(`Couldnt Create Nano Account: ${err}`); return false; })
}

// module.exports.Account_Setup("56d0bc91-229e-4109-9fd5-d968386518a6");