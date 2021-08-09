// ------ Storage Engine Rework ------ 15/12/2020 > 02/01/2021
// ------ Node Storage Engine ------
// ------ Typescript Conversion: 29/07/2021 ------

import {getColl} from '../Admin/mongo'
const Node_Coll = getColl("node");

import {timeNow, BaseType, truncate, validateClient, Node_Account, Node_Item, Short_Node} from '../helper';
import { removeShareLink } from '../Account/links';
import Account from '../Account/account';

const UploadDrive = 'F';

import crypto from 'crypto';
import {v1 as uuidv1} from 'uuid';
import {v3 as uuidv3} from 'uuid';

// =====================  NANO  =====================

const Write = async(Set:Node_Write, Mongo:MongoObject={}):Promise<number|0> => {
  const {user, type, section, parent, data} = Set;

  if (parent.match(/home|homepage/i)) { // Write to Sections Home
    type == "Span"
      ? Mongo.$set = { [`${section}.${data.id}`]: {"name": data.name, "contents": {}} }
      : Mongo.$set = { [`${section}.${data.id}`]: {...Node_Item, ...data} }
    Mongo.$push = { [`home.${section}`]: data.id }
    Mongo.$inc = { [`size.total.${type == "Span" ? "SPAN" : BaseType(data.type.mime)}`] : data.size || 1 }
  } else if (type.match(/Item|Folder|File/i)) { // Write File OR Folder to Section
    Mongo.$set = {
      [`${section}.${data.id}`] : {...Node_Item, ...data},
      [`${section}.${data.parent}.contents.${data.id}`]: Short_Contents(data),
    }
    if (type !== 'Folder') { Mongo.$push = { [`recent.${section}`]: {$each: [data.id], $slice: -8} } }
    Mongo.$inc = { [`size.total.${BaseType(data.type.mime)}`]: data.size || 1 }
  } else {return 0;}
  
  // return;
  let Written = await Node_Set(user, Mongo);
  return Written ? data.size || 1 : 0;
}

const Edit = async(Edit:Node_Edit, Mongo:MongoObject={}) => {
  const {user, type, section, id, changeTo={}, readCurrent=true, subSection} = Edit;
  let {moveTo} = Edit;

  changeTo.time = {"modified": {"stamp": timeNow(), "who": user}};
  ["id", "contents", "size", "security", "type"].forEach(Key => delete changeTo[Key]);
  
  let current;
  if (readCurrent) {current = await Read({user, "type": "ID", section, "ids": [id]}); current = current[id];}

  
  if (type === 'DATA' && changeTo) {
    changeTo.name ? Mongo.$push = { [`${section}.${id}.previous`]: {$each: [changeTo.name], $slice: -5} } : '';
    Mongo.$set = Key_Set({ "Pre": [`${section}.${id}`], "Change": changeTo })

    if (current.parent && !current.parent.match(/home|homepage/i)) {
      Mongo.$set[`${section}.${current.parent}.contents.${id}`] = Short_Contents(changeTo, current);
    }
  }
  else if (type === 'MOVE' && moveTo) {
    if (current.parent == moveTo) { return true; }

    Mongo.$set = {};
    const External = moveTo.match(/bin|main|codex|block/); // Don't use i tag: (_MAIN_ will match 'main' if not)
    if (moveTo == "homepage" && section == "main") { moveTo = "_GENERAL_" };

    const New_Parent = External ? ((moveTo == "main" // @ts-ignore  // moveTo can NOT be undefined at this point
      ? await Node_Get(user, {[`home.${moveTo}`]: 1}).then((res) => res[0]["home"][moveTo][0])
      : "homepage" )) : moveTo;

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
  else if (type === 'RESTORE') {
    let fromSection = current?.BIN_DATA?.section || 'main';
    let parentID = current?.BIN_DATA?.parent;

    let parentExists = await Read({user, 'type': 'EXISTS', section: fromSection, 'ids': [parentID]})
    const New_Parent = parentExists ? parentID : '_GENERAL_';

    Mongo = await External_Move({user, type, 'section': 'bin', id, changeTo, 'moveTo': fromSection, New_Parent}, current, Mongo);

    return (await Node_Set(user, Mongo) ? parentID : '');
  }
  else if (type === 'DELETE') { // Should only be called with section bin.
    let Contents_Tree = await Read({user, 'type': 'TREE', section, 'ids': [id], 'contents': false})
    Mongo.$unset = ID_Set(section, [...Contents_Tree.Parent_Id, ...Contents_Tree.Child_Id], Mongo.$unset);
    Mongo.$pull = { [`home.bin.${subSection}`]: id };

    const CombinedNodes = {...Contents_Tree.Parent_Node, ...Contents_Tree.Child_Node};

    let Total_Tree_Size = Key_Counter( CombinedNodes, "size");
    Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc);
    Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc);

    let sizeTotal = Object.values(Total_Tree_Size).reduce((a,b) => a+b, 0);
    Account.Write({user, type:'Increment', parentKey:'plan', 'childKey':'used', 'data': -Math.abs(sizeTotal || 0)});

    let Files = Key_Find( CombinedNodes, ['type', 'file'], true );
    Object.keys(Files).forEach(index => Files[index] = CombinedNodes[index].contents );

    let deleted = await Node_Set(user, Mongo);
    return deleted ? Files : false;
  }
  else if (type === 'BIN') {
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
      Mongo.$set = {};
      Mongo.$unset = {[`${section}.${current.parent}.contents.${id}`]: ''}
      Mongo = await External_Move({user, type, section, id, changeTo, moveTo, New_Parent}, current, Mongo);
    }
  }
  else { return; }

  // console.log(Mongo); return;
  return await Node_Set(user, Mongo);
}

const Read = async(Query:Node_Read, Project:MongoObject={}) => {
  const {user, type, section, subSection='', ids=[], contents, keys, internal} = Query;

  if (type == "ID") {    // Returns either long-node of specified or its contents
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
    let List_Of_IDs:string[] = [];
    for (const item in ID_Contents[0][section]) {
      List_Of_IDs = List_Of_IDs.concat(Object.keys( ID_Contents[0][section][item].contents ))
    }
    Project = ID_Query({section, "query":List_Of_IDs});
  } 
  else if (type == "SPECIFIC") {    // Returns Specific Values from Nodes
    // EXAMPLE => let Type = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [WantedURL], "keys": ["type"]});

    ids.forEach(id => { Project[`${section}.${id}`] = Key_Query(keys as string[]) })
  }
  else if (type == "TREE") {    // Returns Array of Children IDs & Children Nodes from Object
    // https://youtu.be/GQlgR_69dmI?t=620  could this help speed up this code and reduce it maybe?
    return await Get_Node_Children(ids[0], {"Tree_Data": {'size': 0, 'count': 0}, "Parent_Id": [], "Parent_Node": {}, "Child_Id": [], "Child_Node": {}});

    async function Get_Node_Children(id:string, Tree:TreeNodes) {
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
  else if (type == 'EXISTS') {
    return Node_Exists(user, {section, id: ids[0]});
  }
  else { return {"Error": 'Failed to Request a valid Type'}; }

  // console.log(Project);
  let Result = await Node_Get(user, Project);
  if (Result[0] == "Empty Query") return Result[0];
  return section ? Result[0][section] : Result[0];
}

// ==============

const Custom_Read = async(Query:{user:User,query:any,section?:Sections}) => {
  let Result = await Node_Get(Query.user, Query.query);
  return Query.section ? Result[0][Query.section] : Result[0]
}

const Custom_Update = async(Update:Node_CustomUpdate, Mongo:MongoObject={}) => {
  const {user, action, key, CUSTOM} = Update;
  Mongo[action] = { [key]: CUSTOM }
  return await Node_Set(user, Mongo);
}

// ==============

const Create = async(Type:NodeTypes, Params:any, Data:any):Promise<number|0> => {
  const {userID, section, parent, oID} = Params;
  const {name, size, isFi, type, modified, options} = Data;

  // ===================================
  
  let node:Node|SpanNode = {
    "id": oID || uuidv1(),
    "name": truncate(name, 128)
  };
  
  if (Type != 'Span') { // @ts-ignore   // cba working this out... just.. cba
    node = {...node, ...{
      "parent": truncate(parent, 128),
      "size": size ?? 1,
      "time": {
        "created": {
          "stamp": timeNow(),
          "who": userID
        }
      },
      "type": {
        "file": isFi ?? false,
        "mime": isFi ? type || 'text' : 'FOLDER'
      }
    }}
  }
  if (options) {
    node = {...node, ...{
      "security": {
        "pass": truncate(options.pass, 256) || '', 
        "pin": truncate(options.pin, 256) || ''
      },
      "color": options.color || '',
      "description": truncate(options.description, 512) || '',
    }}
  }
  
  // ===================================
  // @ts-ignore node.time['modified'] could be undefined. THATS FINE MR TYPESCRIPT
  modified ? node.time['modified'] = {"stamp": new Date(modified).toISOString(), "who": userID} : '';
  isFi ? node['contents'] = {"drive": UploadDrive, "file": uuidv3(oID, userID)} : '';
  
  // ===================================
  
  return await Write({
    "user": userID,
    "type": Type,
    "section": validateClient("section", section) ? section : 'main',
    "parent": truncate(parent, 128),
    "data": node
  });
}

const Account_Setup = async(userID:string) => {
  let check = Node_Coll.find({uID: userID}, {$exists: true}).limit(1).toArray();
  if (check.length) {console.log("Node_Account Already Exists"); return;}

  Node_Account._id = userID;
  Node_Account.enc_key = crypto.randomBytes(32);

  let Account_Set = await Node_Account_Set(Node_Account);

  if (Account_Set) {
    ["Documents", "Games", "Media", "Music", "Notes"].forEach(async(folder) => {
      await Write({
        "user": userID,
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
                "stamp": timeNow(),
                "who": userID
              }
            },
        }
      })
    });
    return {"result": true};
  } else {return {"result": false, "message": "Failed to Create Account"}};
}

export default { Write, Edit, Read, Custom_Read, Custom_Update, Create, Account_Setup }

// ==============

const External_Move = async(Edit:Node_Edit, Current:Node, Mongo:MongoObject={}):Promise<MongoObject> => {
  let {user, type, section, id, changeTo, moveTo, New_Parent, DONTSET=false} = Edit;

  let Contents_Tree = await Read({"user": user, "type": "TREE", "section": section, "ids": [id]});
  const CombinedNodes = {...Contents_Tree.Parent_Node, ...Contents_Tree.Child_Node}; // USE ONLY FOR NON CHANGING DATA. DO NOT CHANGE THIS.
  const ParentNodeID = id;

  CombinedNodes[ParentNodeID].parent = New_Parent;
  
  if (moveTo == "bin") { // Send to Bin
    Mongo.$pull = { [`recent.${section}`]: id }
    

    let Links = Key_Find(CombinedNodes, ['share', 'link', 'url']);
    if (Links) {
      Object.keys(Links).forEach(link => {delete CombinedNodes[link].share});
      removeShareLink(user, Object.values(Links));
    }
    
    if (Current.type.mime == "FOLDER" && !Contents_Tree.Child_Id.length) {
      DONTSET = true;
    } else {
      Mongo.$push = { [`home.bin.${section}`]: {$each: [id], $position: 0} };
      
      CombinedNodes[ParentNodeID]['BIN_DATA'] = { // Set Bin Data for Recovery
        "section": section,
        "parent": Current.parent,
        "deleted": {"stamp": timeNow(), "who": user}
      }
      
      let Total_Tree_Size = Key_Counter( CombinedNodes , "size");
      Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc)
      Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size }, Mongo.$inc)
    }
  } else if (section == "bin") { // Recover from Bin
    Mongo.$pull = { [`home.bin.${moveTo}`]: id } // Removes from bin parent array.
    Mongo.$push = { [`recent.${moveTo}`]: id } // Adds the parent to recent to make it easier to find.
    
    Current.parent = New_Parent; // Needed as Current parent is 'homepage' as it was in the bin. Thus needs changing back.
    
    Mongo.$set = {[`${moveTo}.${New_Parent}.contents.${id}`]: Short_Contents(changeTo, Current)};
    
    CombinedNodes[ParentNodeID].parent = CombinedNodes[ParentNodeID]?.BIN_DATA?.parent || 'homepage';
    delete CombinedNodes[ParentNodeID]['BIN_DATA'];
    
    let Total_Tree_Size = Key_Counter( CombinedNodes , "size");
    Mongo.$inc = Key_Set({ "Pre":'size.bin', "Change":Total_Tree_Size, "Negative":true }, Mongo.$inc);
    Mongo.$inc = Key_Set({ "Pre":'size.total', "Change":Total_Tree_Size }, Mongo.$inc);
  }

  Mongo.$unset = ID_Set(section, [...Contents_Tree.Parent_Id, ...Contents_Tree.Child_Id], Mongo.$unset);

  if (DONTSET) {
    delete Mongo.$set;
    delete Mongo.$push;
  } else {
    Mongo.$set = Key_Set({ "Pre":moveTo as Sections | "homepage" | "_GENERAL_", "Change":CombinedNodes, "Move":true }, Mongo.$set);
  }

  return Mongo;
}

// ==========================================

const Short_Contents = function(fir:ShortNode={}, sec:ShortNode={}):ShortNode|{} {
  return {
    ...Short_Node,
    ...{
      "name": fir.name || sec.name || "Unnamed",
      "mime": fir?.type?.mime || sec?.type?.mime || 'UNKNOWN',
      "size": fir.size || sec.size || 1,
      "color": fir.color || sec.color || '',
      "time": fir.time || sec.time || {"modified": {"stamp":timeNow()}} 
    }
  };
}

const ID_Query = function({section, query, contents}:ID_Query, created:LooseObject={}):MongoObject {
  if (query.length) {
    query.forEach(item => { item ? created[`${section}.${item}${contents ? '.contents' : ''}`] = 1 : '' });
  }
  return created;
}

const ID_Set = function(section:Sections, Query:string[], created:LooseObject={}) {
  Query.forEach(item => created[`${section}.${item}`] = '')
  return created;
}

const Key_Query = function(Keys:string[], created:LooseObject={}) {
  Keys.map(key => created[key] = 1);
  return created;
}

const Key_Set = function(Set:Key_Set, created:LooseObject={}) {
  const {Pre, Change, Move, Negative} = Set;
  for (let [key, value] of Object.entries(Change)) { 
    if (Move) {
      created[`${Pre}.${key}`] = value;
    } else {
      typeof value == "object" // @ts-ignore
        ? created[`${Pre}.${key+="."+Object.keys(value)[0]}`] = (Negative ? -Math.abs(value) : value[Object.keys(value)[0]])
        : created[`${Pre}.${key}`] = (Negative ? -Math.abs(value) : value)}
    }
  return created;
}

const Key_Counter = function(Node_List:{[key:string]:Node}, wanted:'size', counter:LooseObject={}):Total_Tree_Size {
  for (const [key, node] of Object.entries(Node_List)) {
    let type = wanted == "size" ? BaseType(node.type.mime) : wanted;
    isNaN(counter?.[type]) ? counter[type] = ~~(node[wanted]) : counter[type] += ~~(node[wanted])
  }
  return counter;
}

const Key_Find = function(Node_List:{[key:string]:Node}, path: string[], match?: string|boolean|number) { // ex: ['share', 'link', 'url']
  let counter:LooseObject={}

  for (const [key, node] of Object.entries(Node_List)) {
    let foundValue = path.reduce((a:any,b:any) => a?.[b], node);
    // ? Example:  ['share', 'link', 'url'].reduce((a,b)=>a[b], node);

    if (foundValue) {
      if (typeof match == 'undefined') counter[key] = foundValue;
      else if (foundValue === match) counter[key] = foundValue;
    }
  }
  return counter;
}

// ==========================================

const Node_Exists = async(uID:string, check:{section:Sections, id:string}) => {
  const {section, id} = check;
  return await Node_Coll.findOne({
    "_id": uID,
    [`${section}.${id}`]: {$exists: true}
  }).then((items:any) => { return items ? true : false })
}

const Node_Get = async(uID:string, fetch:LooseObject) => {
  return Object.keys(fetch).length == 0 
    ? ["Empty Query"] 
    : await Node_Coll.aggregate([
      { $match: { '_id': uID } },
      { $project: fetch}
    ]).toArray();
};

const Node_Set = async(uID:string, set:MongoObject) => {
  return Node_Coll.updateOne(
    {"_id": uID},
    set
  )
};

const Node_Account_Set = async(Account_Data:Account_Base_Nodes) => {
  return Node_Coll.insertOne(Account_Data)
  .then(async() => { return true; })
  .catch((err:any) => {console.log(`Couldn\'t Create Node Account: ${err}`); return false; })
}