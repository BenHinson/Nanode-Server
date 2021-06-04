const Node = require('../Node/node.js');

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

module.exports = {
  Read_Send_Contents: async(NodeData, Connection) => {
    const {user, type, section, subSection, contents, path} = NodeData;
    const {ConType, ConLink} = Connection;
  
    let Result = await Node.Read({"user": user, "type": type, "section": section, "subSection": subSection, "ids": path, "contents": contents || false});
    if (Result) {
      Result = Result[path] || Result;

      if (section.match(/bin/)) {
        Result = await module.exports.FormatResponse(section, Result, NodeData);
      }
      
      let Result_Formatted = {
        "Parent": {"name": Result.name || "homepage", "id": Result.id || "homepage"},
        "Contents": Result.id
          ? { [Result.id]: { "name": Result.name, "contents": Result.contents } } // For Folders
          : Result // For Homepage
      }

      if (ConType == "HTTP") {
        return ConLink.send(Result_Formatted);
      } else if (ConType == "SOCKET") {
        return ConLink.emit('Directory', Result_Formatted) 
      }
    }
  },

  Message: async(Connection, status=200, msg) => {
    return Connection.status(status).json(msg);
  },

  Error: async(Error, Connection) => {
    if (ConType == "HTTP") {
      return ConLink.status(Error.Code || 400).send(Error.Message || 'Internal Error');
    } else if (ConType == "SOCKET") {
      return ConLink.emit('Error', Error) 
    }
  },

  FormatResponse: async(Format, Result, NodeData) => {
    if (Result != 'Empty Query') {
      let fileTree;

      for (const [id, data] of Object.entries(Result)) {
  
        if (Format == 'bin') {
          Result[id] = {
            'name': data.name,
            'size': data.size,
            'type': data.type,
            'deleted': data.BIN_DATA.deleted
          };
        }
        else if (Format == 'binInfo') {
          if (!data.type.file) {
            fileTree = await Node.Read({"user": NodeData.user, "type": 'TREE', "section": NodeData.section, "ids": [id], "contents": false});
          }
          let itemParent = await Node.Read({"user": NodeData.user, "type": 'SPECIFIC', 'section': data.BIN_DATA.section, "ids": [data.BIN_DATA.parent], "keys": ["name", "description"]});

          Result[id] = {
            'name': data.name,
            'parent': itemParent[data.BIN_DATA.parent] || 'Deleted',
            'size': fileTree?.Tree_Data.size || data.size,
            'type': data.type,
            'time': data.time,
            'deleted': data.BIN_DATA.deleted,
            'count': fileTree?.Tree_Data.count || 1,
          }
        }
      }
    }
    return Result;
  }
}