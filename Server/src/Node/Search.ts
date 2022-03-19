// ------ Nova Search Engine ------ 28/02/2021

import {getColl} from '../Admin/mongo';
const Node_Coll = getColl('node');

import Node from './node';

import Nelp from '../tools';

// =====================================================================

export const Find = async(Query:SearchQuery, search:LooseObject={}) => {
  const {userId, input, inputTwo, params} = Query;
  
  search.input = input;
  search.section = "main";
  search = Options(search, input, inputTwo, params)
  let from = 0; // params.

  try {
    return await Match(userId, search, from, 50);
  } catch (error) {
    console.log(error);
    return [];
  }
}


const Match = async(userId:UserId, search:LooseObject, from=0, limit=5) => {
  let result = [], searchEnd = null;
  let userNodes:GroupNodes = await LoadNodes(userId, search.section, search.withinParent); // IMPORTANT: if loading from withinParent, check if its locked first. locked would require key. hmmm.

  if (from !== 0) { userNodes = Trim(userNodes, from); }

  for (const [id, data] of Object.entries(userNodes)) {
    if (result.length >= limit) { searchEnd = id; break;}

    // Filter out Unwanted Nodes
    if (!data.type) { continue; } // Remove Spans
    if (!search.forFiles && data.type.file == true) { continue; }
    if (!search.forFolders && data.type.file == false) { continue; }
    if (search.onlyShared && !data.share) { continue; }
    
    // Search Remaining Nodes    
    // Search For:
    if (search.color && data.color == search.color || search.color == '*' && data.color) {
      result.push( SafeForWeb(userNodes[id]) ); continue;
    } else if (search.type && data.type.mime == search.type) {
      result.push( SafeForWeb(userNodes[id]) ); continue;
    } else if (search.date) { // Uses modified atm, could add created / deleted later.
      let modifiedDate = new Date(data.time?.modified?.stamp);
      if (modifiedDate < new Date(search.date.max) && modifiedDate > new Date(search.date.min)) {
        result.push( SafeForWeb(userNodes[id]) ); continue;
      }
    }
    
    if (search.name && data.name.toLowerCase().includes(search.name.toLowerCase())) { result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (search.color && data.color == search.color || search.color == '*' && data.color) { result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (search.description && data?.description?.toLowerCase().includes(search.input.toLowerCase())) { result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (search.prevNames && data?.previous?.includes(search.input)) { result.push( SafeForWeb(userNodes[id]) ); continue; }

  }

  return {"Found": result, "Ended": searchEnd};
}

const Options = (search:LooseObject, input:any, inputTwo:any, params:SearchParams) => {
  const {color, type, date, size} = params;     // Search By
  const {forFolders, forFiles, onlyShared} = params;      // Search Only For
  const {withinParent} = params;                      // Search In
  const {description, prevNames} = params;      // Include in Search

  search.name = input;
  search.input = input;

  if (color) { search.color = input; }   // Can be true with a name input; IE: 'red' In name or as colour?  Could set input to color and use input for search
  if (type) { search.type = input }
  if (date) { search.date = { "max": input, "min": inputTwo || input }; delete search.name}    // Search for Date between two inputs.   Cannot have Name
  if (size) { search.size = { "max": input, "min": inputTwo || input }; delete search.name}    // Search For size between two inputs.   Cannot have Name

  if (forFolders) { search.forFolders = true }   // Ignore anything that isn't the following if true.
  if (forFiles || (!forFiles && !forFolders)) { search.forFiles = true }
  if (onlyShared) { search.onlyShared = true }
  
  if (withinParent && Nelp.validateUUID(withinParent)) { search.withinParent = withinParent }    // withinParent given as withinParent. input && inputTwo saved for the search values. Parent can be a span ID
  
  if (description) { search.description = true }    // Also checks descriptions and preNames if there are.
  if (prevNames) { search.prevNames = true }
  
  // search.size = { $lt: 80000, $gt: 50000 }  // parseInt(input);
  // search['time.modified.stamp'] = { $gt: new Date('2021-01-01') } // Doesn't quite work as stamps are saved in string form... Will return only Development folder as that is now date form

  return search
}

const LoadNodes = async(userId:UserId, section:Sections, withinParent:string) => { // Load User Nodes from Parent or Section
  if (withinParent && withinParent !== 'homepage') {
    // console.log("Loading Parent Tree...");
    let treeNodes = await Node.Read({userId, type: 'TREE', section, nodeIds: [withinParent]});
    return treeNodes.childNode;
  } else {
    // console.log("Loading Whole Section...");
    return await Node.Custom_Read({userId, "query": {[`${section}`]: 1}, section});
  }
}

const Trim = (nodes:GroupNodes|any, from:number) => { // 'Load More' has been Called. Remove Already Found Objects.
  // Wont be called nearly as often as general search. Saves on always converting to array.
  nodes = Object.entries(nodes).map((e) => ( { [e[0]]: e[1] } ));  // Convert to Array
  nodes.slice( nodes.indexOf( nodes[from] ) ); // Remove all already searched items.
  return Object.fromEntries(nodes);  // Convert back to Object
}

const Score = (node:Node) => { // Provide an ordering score based on params
  // Match - Max Score
  // Includes - Less Score
}

const SafeForWeb = (node:Node) => { // Remove any compromising data from the node
  return {
    "id": node.id,
    "name": node.name,
    "parent": node.parent,
    "size": node.size,
    "time": node.time,
    "type": node.type,
    "description": node.description,
    "color": node.color
  }
}

// Details of Search:
//      IF quick search (from dropdown) - Return Max 5 Items.
//            Send results in real time.
//      IF full search (full page) - Return Max 50 Items.
//            Save ID of last Item to continue on from, for next 50 items.