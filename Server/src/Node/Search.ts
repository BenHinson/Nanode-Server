// ------ Nova Search Engine ------ 28/02/2021

import {getColl} from '../Admin/mongo';
const Node_Coll = getColl('node');

import Node from './node';

import Nelp from '../tools';

// =====================================================================

export const Find = async(Query:SearchQuery, Search:LooseObject={}) => {
  const {user, input, inputTwo, params} = Query;
  
  Search.input = input;
  Search.section = "main";
  Search = Options(Search, input, inputTwo, params)
  let From = 0; // params.

  try {
    return await Match(user, Search, From, 50);
  } catch (error) {
    console.log(error);
    return [];
  }
}


const Match = async(user:User, Search:LooseObject, from=0, limit=5) => {
  let Result = [], searchEnd = null;
  let userNodes:GroupNodes = await LoadNodes(user, Search.section, Search.withinParent); // IMPORTANT: if loading from withinParent, check if its locked first. locked would require key. hmmm.

  if (from !== 0) { userNodes = Trim(userNodes, from); }

  for (const [id, data] of Object.entries(userNodes)) {
    if (Result.length >= limit) { searchEnd = id; break;}

    // Filter out Unwanted Nodes
    if (!data.type) { continue; } // Remove Spans
    if (!Search.forFiles && data.type.file == true) { continue; }
    if (!Search.forFolders && data.type.file == false) { continue; }
    if (Search.onlyShared && !data.share) { continue; }
    
    // Search Remaining Nodes    
    // Search For:
    if (Search.color && data.color == Search.color || Search.color == '*' && data.color) {
      Result.push( SafeForWeb(userNodes[id]) ); continue;
    } else if (Search.type && data.type.mime == Search.type) {
      Result.push( SafeForWeb(userNodes[id]) ); continue;
    } else if (Search.date) { // Uses modified atm, could add created / deleted later.
      let modifiedDate = new Date(data.time?.modified?.stamp);
      if (modifiedDate < new Date(Search.date.max) && modifiedDate > new Date(Search.date.min)) {
        Result.push( SafeForWeb(userNodes[id]) ); continue;
      }
    }
    
    if (Search.name && data.name.toLowerCase().includes(Search.name.toLowerCase())) { Result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (Search.color && data.color == Search.color || Search.color == '*' && data.color) { Result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (Search.description && data?.description?.toLowerCase().includes(Search.input.toLowerCase())) { Result.push( SafeForWeb(userNodes[id]) ); continue; }
    if (Search.prevNames && data?.previous?.includes(Search.input)) { Result.push( SafeForWeb(userNodes[id]) ); continue; }

  }

  return {"Found": Result, "Ended": searchEnd};
}

const Options = (Search:LooseObject, input:any, inputTwo:any, params:SearchParams) => {
  const {color, type, date, size} = params;     // Search By
  const {forFolders, forFiles, onlyShared} = params;      // Search Only For
  const {withinParent} = params;                      // Search In
  const {description, prevNames} = params;      // Include in Search

  Search.name = input;
  Search.input = input;

  if (color) { Search.color = input; }   // Can be true with a name input; IE: 'red' In name or as colour?  Could set input to color and use input for search
  if (type) { Search.type = input }
  if (date) { Search.date = { "max": input, "min": inputTwo || input }; delete Search.name}    // Search for Date between two inputs.   Cannot have Name
  if (size) { Search.size = { "max": input, "min": inputTwo || input }; delete Search.name}    // Search For size between two inputs.   Cannot have Name

  if (forFolders) { Search.forFolders = true }   // Ignore anything that isn't the following if true.
  if (forFiles || (!forFiles && !forFolders)) { Search.forFiles = true }
  if (onlyShared) { Search.onlyShared = true }
  
  if (withinParent && Nelp.validateUUID(withinParent)) { Search.withinParent = withinParent }    // withinParent given as withinParent. input && inputTwo saved for the search values. Parent can be a span ID
  
  if (description) { Search.description = true }    // Also checks descriptions and preNames if there are.
  if (prevNames) { Search.prevNames = true }
  
  // Search.size = { $lt: 80000, $gt: 50000 }  // parseInt(input);
  // Search['time.modified.stamp'] = { $gt: new Date('2021-01-01') } // Doesn't quite work as stamps are saved in string form... Will return only Development folder as that is now date form

  return Search
}

const LoadNodes = async(user:User, section:Sections, withinParent:string) => { // Load User Nodes from Parent or Section
  if (withinParent && withinParent !== 'homepage') {
    // console.log("Loading Parent Tree...");
    let treeNodes = await Node.Read({user, type: 'TREE', section, ids: [withinParent]});
    return treeNodes.Child_Node;
  } else {
    // console.log("Loading Whole Section...");
    return await Node.Custom_Read({user, "query": {[`${section}`]: 1}, section});
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