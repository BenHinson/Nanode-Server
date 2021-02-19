const Nano = require('./Nano.js');
const Helper = require('./helper.js');

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

module.exports = {
  Read_Send_Contents: async(NanoData, Connection) => {
    const {user, type, section, subSection, contents, path} = NanoData;
    const {ConType, ConLink} = Connection;
  
    let Result = await Nano.Read({"user": user, "type": type, "section": section, "subSection": subSection, "ids": path, "contents": contents || false});
    if (Result) {
      Result = Result[path] || Result;

      if (section.match(/bin/)) {
        Result = await module.exports.FormatResponse(section, Result, NanoData);
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

  FormatResponse: async(Format, Result, NanoData) => {
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
            fileTree = await Nano.Read({"user": NanoData.user, "type": 'TREE', "section": NanoData.section, "ids": [id], "contents": false});
          }
          let itemParent = await Nano.Read({"user": NanoData.user, "type": 'SPECIFIC', 'section': data.BIN_DATA.section, "ids": [data.BIN_DATA.parent], "keys": ["name", "description"]});

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