// ------ Storage Engine Rework ------ 15/12/2020 > 02/01/2021
// ------ Node Storage Engine ------

const Mongo = require('../Admin/mongo');
const Node_Coll = Mongo.getColl("node");

const Helper = require('../helper.js');

const UploadDrive = 'F';

const crypto = require('crypto');
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');

// ===================================================

const Node_Account = {
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
    "bin": {
      "main": [],
      "codex": [],
      "blocks": []
    }
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
  "bin": {
    "main": {},
    "codex": {},
    "blocks": {}
  }
};
const Node_Item = {
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
        : Mongo.$set = { [`${section}.${data.id}`]: {...Node_Item, ...data} }
      Mongo.$push = { [`home.${section}`]: data.id }
      Mongo.$inc = { [`size.total.${type == "Span" ? "SPAN" : Helper.BaseType(data.type.mime)}`] : data.size || 1 }
    } else if (type.match(/Item|Folder|File/i)) { // Write File OR Folder to Section
      Mongo.$set = {
        [`${section}.${data.id}`] : {...Node_Item, ...data},
        [`${section}.${data.parent}.contents.${data.id}`]: Short_Contents(data),
      }
      if (type !== 'Folder') { Mongo.$push = { [`recent.${section}`]: {$each: [data.id], $slice: -8} } }
      Mongo.$inc = { [`size.total.${Helper.BaseType(data.type.mime)}`]: data.size || 1 }
    } else {return false;}
    
    // return;
    let Written = await Node_Set(user, Mongo);
    return Written ? data.size || 1 : false;
  },

  Edit: async(Edit, Mongo={}) => {
    const {user, type, section, id, changeTo={}} = Edit;
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
      if (current.parent == moveTo) { return true; }

      Mongo.$set = {};
      const External = moveTo.match(/bin|main|codex|block/); // Dont use i tag: (_MAIN_ will match 'main' if not)
      if (moveTo == "homepage" && section == "main") { moveTo = "_GENERAL_" };
  
      const New_Parent = External ? (moveTo == "main" ? await Node_Get(user, {[`home.${moveTo}`]: 1}).then((res) => res[0]["home"][moveTo][0]) : "homepage" ) : moveTo;

      current.parent.toLowerCase() == "homepage" // Remove From Parents
        ? Mongo.$pull = { [`home.${section}`]: id }
        : Mongo.$unset = {[`${section}.${current.parent}.contents.${id}`]: ''}
  
      New_Parent.toLowerCase() == "homepage" // Set to New Parents
        ? Mongo.$push = { [`home.${moveTo}`]: id }
        : Mongo.$set[ External ? `${moveTo}.${New_Parent}.contents.${id}` : `${section}.${moveTo}.contents.${id}` ] = Short_Contents(changeTo, current);
      
      if (External) { // Move between sections.
        Mongo = await External_Move({user, type, section, id, changeTo, moveTo, New_Parent}, current, Mongo);
      } else {
        Mongo.$set[`${section}.${id}.parent`] = moveTo;
      }
    }
    else if (type == 'DELETE') {
      Mongo.$set = {};

      if (!current.parent) { // Is Span
        if (Object.keys(current.contents).length) {
          return ['Span is not empty']
        } else {
          Mongo.$pull = { [`home.${section}`]: id }
          Mongo.$unset = { [`${section}.${id}`]: '' }
          delete Mongo.$set;
        }
      } else {
        const New_Parent = 'homepage';
        Mongo.$unset = {[`${section}.${current.parent}.contents.${id}`]: ''}
        Mongo = await External_Move({user, type, section, id, changeTo, moveTo, New_Parent}, current, Mongo);
      }
    }
    else { return; }

    // console.log(Mongo); return;
    let Complete = await Node_Set(user, Mongo);
    return Complete;
  },

  Read: async(Query, Project={}) => {
    const {user, type, section, subSection, ids=[], contents, keys, internal, CUSTOM} = Query;

    if (CUSTOM) {
      Project = CUSTOM;
    }
    else if (type == "ID") {    // Returns either long-node of specified or its contents
      if (ids[0].match(/home|homepage/i)) {
        let Spans = await Node_Get(user, {[`home.${section}`]: 1});
        let ProjectQuery = (Spans[0]['home'][section][subSection] || Spans[0]['home'][section])
        Project = ID_Query({section, "query": ProjectQuery});
      } else {
        Project = ID_Query({section, "query": ids, contents});
      }
    }
    else if (type == "RAW") {     // Returns the long-node of items contents 
      let ID_Contents = await Node_Get(user, ID_Query({section, "query":ids, "contents":true}));
      let List_Of_IDs = [];
      for (const item in ID_Contents[0][section]) {
        List_Of_IDs = List_Of_IDs.concat(Object.keys( ID_Contents[0][section][item].contents ))
      }
      Project = ID_Query({section, "query":List_Of_IDs});
    } 
    else if (type == "SPECIFIC") {    // Returns Specific Values from Nodes
      // EXAMPLE => let Type = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [WantedURL], "keys": ["type"]});

      ids.forEach(id => { Project[`${section}.${id}`] = Key_Query(keys) })
    }
    else if (type == "TREE") {    // Returns Array of Children IDs & Children Nodes from Object
      // https://youtu.be/GQlgR_69dmI?t=620  could this help speed up this code and reduce it maybe?
      return await Get_Node_Children(ids[0], {"Tree_Data": {'size': 0, 'count': 0}, "Parent_Id": [], "Parent_Node": {}, "Child_Id": [], "Child_Node": {}});

      async function Get_Node_Children(id, Tree) {
        let Node = await Node_Get(user, ID_Query({section, "query":[id], "contents":false}));
        Node = Node[0][section][id];
        if (!Node) { return Tree }
        Tree.Tree_Data.size += Node.size || 1;
        Tree.Tree_Data.count += 1;
        Tree.Parent_Id.length ? Tree.Child_Id.push(Node.id) : Tree.Parent_Id.push(Node.id);
        Object.keys(Tree.Parent_Node).length === 0 ? Tree.Parent_Node[Node.id] = Node : Tree.Child_Node[Node.id] = Node;
        if (Node.type.file === false || Node.type.file == "FOLDER") {
          let Children_IDs = Object.keys(Node.contents);
          for (let c=0; c<Children_IDs.length; c++) {
            await Get_Node_Children(Children_IDs[c], Tree);
          }
        }
        return Tree;
      }
    }
    else { return {"Error": 'Failed to Request a valid Type'}; }

    // console.log(Project);
    let Result = await Node_Get(user, Project);
    return Result[0][section] || Result[0];
  },

  // ==============

  Custom_Update: async(Update, Mongo={}) => {
    const {user, ACTION, KEY, CUSTOM} = Update;
    Mongo[ACTION] = { [KEY]: CUSTOM }
    return await Node_Set(user, Mongo);
  },

  // ==============

  Create: async(Type, Params, Data) => {
    const {userID, section, parent, oID} = Params;
    const {name, size, isFi, type, modified, options} = Data;
  
    // ===================================
    
    let node = {
      "id": oID || uuidv1(),
      "name": Helper.truncate(name, 128)
    };
    
    if (Type != 'Span') {
      node = {...node, ...{
        "parent": Helper.truncate(parent, 128),
        "size": size ?? 1,
        "type": {
          "file": isFi ?? false,
          "mime": isFi ? type || 'text' : 'FOLDER'
        },
        "time": {
          "created": {
            "stamp": Helper.timeNow(),
            "who": userID
          }
        }
      }}
    }
    if (options) {
      node = {...node, ...{
        "security": {
          "pass": Helper.truncate(options.pass, 256) || '', 
          "pin": Helper.truncate(options.pin, 256) || ''
        },
        "color": options.color || '',
        "description": Helper.truncate(options.description, 512) || '',
      }}
    }
    
    // ===================================
    
    modified ? node.time['modified'] = {"stamp": new Date(modified).toISOString(), "who": userID} : '';
    isFi ? node['contents'] = {"drive": UploadDrive, "file": uuidv3(oID, userID)} : '';
    
    // ===================================
    
    return await module.exports.Write({
      "user": userID,
      "type": Type,
      "section": Helper.validateClient("section", section) ? section : 'main',
      "parent": Helper.truncate(parent, 128),
      "data": node
    });
  },

  Account_Setup: async(uID) => {
    let check = Node_Coll.find({uID: uID}, {$exists: true}).limit(1).toArray();
    if (check.length) {console.log("Node_Account Already Exists"); return;}

    Node_Account._id = uID;
    Node_Account.enc_key = crypto.randomBytes(32);

    let Account_Set = await Node_Account_Set(Node_Account);

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

External_Move = async(Edit, Current, Mongo) => {
  let {user, type, section, id, changeTo, moveTo, New_Parent} = Edit;
  let DONTSET = false;

  let Contents_Tree = await module.exports.Read({"user": user, "type": "TREE", "section": section, "ids": [id]});
  let Total_Tree_Size = Key_Counter( {...Contents_Tree.Parent_Node, ...Contents_Tree.Child_Node} , "size");
  
  Mongo.$unset = ID_Set(section, [...Contents_Tree.Parent_Id, ...Contents_Tree.Child_Id], Mongo.$unset);

  Contents_Tree.Parent_Node[id].parent = New_Parent;
  
  if (moveTo == "bin") { // Send to Bin
    Mongo.$pull = { [`recent.${section}`]: id }

    if (Current.type.mime == "FOLDER" && !Contents_Tree.Child_Id.length) { DONTSET = true; } 
    else {
      Mongo.$push = { [`home.bin.${section}`]: {$each: [id], $position: 0} };

      Contents_Tree.Parent_Node[id]['BIN_DATA'] = { // Set Bin Data for Recovery
        "section": section,
        "parent": Current.parent,
        "deleted": {"stamp": Helper.timeNow(), "who": user}
      }
      Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc)
      Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size }, Mongo.$inc)
    }
  } else if (section == "bin") { // Recover from Bin
    // Remove from Bin. and home.bin.SECTION. Read BIN_DATA to place back to parent. Check Previous Spot still avaliable. else go to homepage || _GENERAL_

    Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc);
    Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size }, Mongo.$inc);
  }

  if (DONTSET)
    { delete Mongo.$set; delete Mongo.$push }
  else
    { Mongo.$set = Key_Set({ "Pre":moveTo, "Change":{...Contents_Tree.Parent_Node, ...Contents_Tree.Child_Node}, "Move":true }, Mongo.$set); }

  return Mongo;
}

// ==============

Short_Contents = function(fir={}, sec={}) {
  let ItemsType = fir.type || sec.type || {};
  return {...Contents_Item, ...{"name": fir.name || sec.name || "Unnamed", "mime": ItemsType.mime ||ItemsType.mime || "UNKNOWN", "size": fir.size || sec.size || 1, "color": fir.color || sec.color || '', "time": fir.time || sec.time || {"modified": {"stamp":Helper.timeNow()}} }};
}

ID_Query = function({section, query, contents, internal}, created={}) {
  if (query.length) {
    query.forEach(item => { item ? created[`${section}.${item}${contents ? ".contents" : ""}`] = 1 : '' });
  }
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
  const {Pre, Change, Move, Negative} = Set;
  for (let [key, value] of Object.entries(Change)) { 
    if (Move) {
      created[`${Pre}.${key}`] = value;
    } else {
      typeof value == "object"
        ? created[`${Pre}.${key+="."+Object.keys(value)[0]}`] = (Negative ? -Math.abs(value) : value[Object.keys(value)[0]])
        : created[`${Pre}.${key}`] = (Negative ? -Math.abs(value) : value)}
    }
  return created;
}

Key_Counter = function(Node_List, wanted, counter={}) {
  Array.isArray(Node_List) ? '' : Node_List = Object.keys(Node_List).map((key) => Node_List[key]);
  Node_List.forEach(node => { 
    let type = wanted == "size" ? Helper.BaseType(node.type.mime) : wanted;
    typeof counter[type] == 'number' ? '' : counter[type] = 0;
    counter[type] += ~~(node[wanted]) })
  return counter;
}

////// =============== =========== ======== === =

Node_Exists = async(uID, check) => {
  const {section, id} = check;
  return await Node_Coll.findOne({
    "_id": uID,
    [`${section}.${id}`]: {$exists: true}
  }).then(items => { return items ? true : false })
}

Node_Get = async(uID, fetch) => {
  return Object.keys(fetch).length == 0 
    ? ["Empty Query"] 
    : await Node_Coll.aggregate([
      { $match: { '_id': uID } },
      { $project: fetch}
    ]).toArray();
};

Node_Set = async(uID, set) => {
  return Node_Coll.updateOne(
    {"_id": uID},
    set
  )
};

Node_Account_Set = async(Account_Data) => {
  return Node_Coll.insertOne(Account_Data)
  .then(async() => { return true; })
  .catch(err => {console.log(`Couldnt Create Node Account: ${err}`); return false; })
}

// module.exports.Account_Setup("56d0bc91-229e-4109-9fd5-d968386518a6");