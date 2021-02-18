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
        Result = ExternalFormat(Result);
        // Result = {};
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
  }
}


function ExternalFormat(Result) {
  for (const [id, data] of Object.entries(Result)) {
    Result[id] = {
      'name': data.name,
      'size': data.size,
      'type': data.type,
      'deleted': data.BIN_DATA.deleted
    };
  }
  return Result;
}