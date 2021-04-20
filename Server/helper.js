const parser = require('ua-parser-js');
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

  ActivityLog: function(req, data) {
    if (req.get('host') == 'drive.nanode.one' && req.originalUrl !== '/') { return; }

    const log = {
      "path": req.protocol + '://' + req.get('host') + req.originalUrl,
      "location": req.get('cf-ipcountry'),
      "ip": req.headers['x-forwarded-for'] || req.connection.remoteAddres,
      ...data,
      "time": new Date().toLocaleString(),
    }
    console.log(log)
  },
  CustomActivityLog: function(data) {
    console.log({
      ...data,
      "time": new Date().toLocaleString(),
    });
  },

  validateClient: function(variable, input) {
    if (!input) { return null; }
    switch (variable) {
      case("section"): 
        return input.match(/main|blocks|codex|bin/i) ? true : false; break;
      case('subSection'):
        return input.match(/main|blocks|codex/) ? true : false; break;
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

  ErrorPage: function(res) {
    return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');
  },
}