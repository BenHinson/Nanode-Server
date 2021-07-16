const Node = require('../Node/node.js');
const Account = require('../Account/account.js');

const Upload_File_Tree = {}; // Holds data about uploaded files to protect against files too large or edited file sizes.

module.exports = {
  Checker: async({userID, section, oID, wanted, input}) => {
    if (oID.match(/home|homepage/i)) { return false; }
    if (!section) { console.log("Security Checker Requires a section. Must check all calls to securityChecker"); return false; }

    let securityLookup = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": [oID], "keys": ["security"]});
    if (!securityLookup[oID]?.security) { return false; }
    let NodeSecu = securityLookup[oID].security;
    
    let level = 0;
    let Type = [];
    
    if (NodeSecu.pass) { level++; Type.push("Password") }
    if (NodeSecu.pin) { level++; Type.push("Pin") }
    // if (NodeSecu.time)
  
    if (wanted == "Amount") { return level; }
    else if (wanted == "Access") {
      if (!input) { return Type.length >= 1 ? Type : false; }
      Object.keys(NodeSecu).forEach(k => (!NodeSecu[k] && NodeSecu[k] !== undefined) && delete NodeSecu[k]);
      Object.keys(input).forEach(k => (!input[k] && input[k] !== undefined) && delete input[k]);
      return JSON.stringify(NodeSecu) === JSON.stringify(input) ? true : false;
    }
    return false;
  },

  Value: function(item, secLevel = 0) { // Convert security options to a numerical value
    if (!item.security) {return secLevel;}
    for (let key in item.security) { if (item.security[key].length || item.security[key].length === undefined ) { secLevel++; }  }
    return secLevel;
  },

  Upload_Limit: async(userID, chunkSize, chunkInfo, meta) => {
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
}