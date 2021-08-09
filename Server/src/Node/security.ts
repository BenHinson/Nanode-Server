import Node from '../Node/node'
import Account from '../Account/account';

const Upload_File_Tree:LooseObject = {}; // Holds data about uploaded files to protect against files too large or edited file sizes.

// ===================================================

const Checker = async({userID, section, oID, wanted, input}:SecurityCheck) => {
  if (oID.match(/home|homepage/i)) { return false; }
  if (!section) { console.log("Security Checker Requires a section. Must check all calls to securityChecker"); return false; }

  let securityLookup = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [oID], "keys": ["security"]});
  if (!securityLookup[oID]?.security) { return false; }
  let NodeSecurity = securityLookup[oID].security;
  
  let level = 0;
  let Type:Array<'Password'|'Pin'> = [];
  
  if (NodeSecurity.pass) { level++; Type.push("Password") }
  if (NodeSecurity.pin) { level++; Type.push("Pin") }
  // if (NodeSecurity.time)

  if (wanted == "Amount") { return level; }
  else if (wanted == "Access") {
    if (!input) { return Type.length >= 1 ? Type : false; }
    Object.keys(NodeSecurity).forEach(k => (!NodeSecurity[k] && NodeSecurity[k] !== undefined) && delete NodeSecurity[k]);
    Object.keys(input).forEach(k => (!input[k] && input[k] !== undefined) && delete input[k]);
    return JSON.stringify(NodeSecurity) === JSON.stringify(input) ? true : false;
  }
  return false;
}

const Value = function(item:SecurityValue, secLevel = 0) { // Convert security options to a numerical value
  if (!item.security) {return secLevel;}
  for (let key in item.security) { // @ts-ignore // item.security[key] causes issues? Likely the SecurityValue interface
    if (item.security[key].length || item.security[key].length === undefined) { secLevel++; }  }
  return secLevel;
}

const Upload_Limit = async(userID:User, chunkSize:number, chunkInfo:ChunkInfo, meta:UploadMeta) => {
  // Create User Plan Tree
    // Get the users plan: 'max' and 'used' and save for reference.
  if (!Upload_File_Tree[userID]) {
    Upload_File_Tree[userID] = {};
    const userPlan = await Account.Get(userID, ["plan"]);
    Upload_File_Tree[userID] = {"plan": userPlan[0].plan, "files": {}}
  };

  let uploadName = meta.name+'-'+meta.id;

  // Check if the client states size will exceed their plan
  if (Upload_File_Tree[userID].plan.used > Upload_File_Tree[userID].plan.max) { // Checks if used > max
    return {"auth": false, "msg": "Limit"}
  } else { // Sets
    Upload_File_Tree[userID].plan.used += chunkSize;
    Upload_File_Tree[userID].files[uploadName] = Upload_File_Tree[userID].files[uploadName] + chunkSize || chunkSize;
  }

  // Last chunk of file. Remove from the Upload Tree.
  if (chunkInfo.index >= chunkInfo.total_chunks - 1) {
    chunkSize = Upload_File_Tree[userID].files[uploadName];
    delete Upload_File_Tree[userID].files[uploadName];
  }
  
  return {"auth": true, "size": chunkSize, "plan": Upload_File_Tree[userID].plan};
}


export default { Checker, Value, Upload_Limit }