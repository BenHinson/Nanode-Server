const parser = require('ua-parser-js');
const Nanode_Keys = require('./Keys.js');
const Nano = require('./Nano.js');

module.exports = {

  Base_Object: {
    "UUID":'',
    "Name":{},
    "Path":{},
    "Span":'',
    "Parent":'',
    "Contents":[],
    "Type":{},
    "Size":'',
    "Tags":{},
    "Share": {}
  },

  Settings_Template: {
    "LastAc": "",
    "Dir": "Homepage",
    "Bin": "5",
    "LockF": 2,
    "Date": 0,
    "TimeZ": "0",
    "Theme": 0,
    "ViewT": 1,
    // "HighL": "#8a97c5",
    "HighL": "#0bd9e5",
    "BGImg": "",
  },

  validateClient: function(variable, input) {
    switch (variable) {
      case("section"): 
        return input.match(/main|blocks|codex|bin/i) ? true : false; break;
      case("nanoID"):
      return input.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[1][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i) ? true : false; break;
    }
  },

  timeNow: function () { 
    return new Date(Date.now()).toISOString();
  },

  BaseType: function(mime) {
    return mime.split('/')[0];
  },
  
  capitalize: function (s) {
    return typeof s !== 'string' ? '' : s.charAt(0).toUpperCase() + s.slice(1)
  },

  convertSize: function (InputSize) {
    if (!InputSize) { return '-' }
    let fileSizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    for (let i=0; i<fileSizes.length; i++) {
      if (InputSize <= 1024) { return InputSize+" "+fileSizes[i] }
      else { InputSize = parseFloat(InputSize / 1024).toFixed(2) }
    }
    return InputSize;
  },

  dupeNameIncrement: function (parent_object, name, num = 0) {
    return typeof parent_object[num+"_"+name] == 'undefined' ? (num == 0 ? name : num+"_"+name) : module.exports.dupeNameIncrement(parent_object, name, num+1);
  },

  securityChecker: async({userID, Section, oID, Wanted, Input, Nano}) => {

    if (oID.match(/home|homepage/i)) { return false; }
    
    console.log("Security Checker Requires a section. Must check all calls to securityChecker"); return false;

    // let securityLookup = object ? object : await Nano_Reader.returnInformation(userID, "Information", Path, ["Security"]);
    let securityLookup = Nano ? Nano : await Nano.Read({"user": userID, "type": "SPECIFIC", "section": Section, "ids": [oID], "keys": ["security"]});
    
    console.log(securityLookup);

    if (!securityLookup[0]) { return false; }
  
    let level = 0;
    let Type = [];
  
    if (securityLookup[0].pass) { level++; Type.push("Password") }
    if (securityLookup[0].pin) { level++; Type.push("Pin") }
    // if (securityLookup[0].Time)
  
    if (Wanted == "Amount") { return level; }
    else if (Wanted == "Access") {
      if (!Input) {  return Type.length >= 1 ? Type : false; }
      return JSON.stringify(securityLookup[0]) === JSON.stringify(Input) ? true : false;
    }
    return false;
  },

  securityValue: function(item, secLevel = 0) { // Convert security options to a numerical value
    if (!item.security) {return secLevel;}
    for (let key in item.security) { if (item.security[key].length || item.security[key].length === undefined ) { secLevel++; }  }
    return secLevel;
  },

  truncate: function(string='', desired) {  // Shorten Length of String
    if (!string.length) {return string;}
    return (string.length > desired) ? string.substr(0, desired-1) : string;
  },

  Device_Info: function(Type, Connection) {
    let userAgent = (Type == "SOCKET" ? parser(Connection.request.headers['user-agent']) : parser(Connection.headers['user-agent']));
    return {
      "Device_Vendor": userAgent.device.vendor,
      "Device_Model": userAgent.device.model,
      "Device_Type": userAgent.device.type,
      "OS_Name": userAgent.os.name,
      "OS_Version": userAgent.os.version,
      "Browser_Name": userAgent.browser.name,
      "Brower_Major": userAgent.browser.major,
      "CPU": userAgent.cpu.architecture
    }
  },
  DeviceMatch: function(This, Registered) {
    let Device_Difference = 0;
    for (const [key, value] of Object.entries(This)) {
      if (Registered[key] != value) {Device_Difference++;}
    }
    return Device_Difference > 1 ? false : true;
  },
}