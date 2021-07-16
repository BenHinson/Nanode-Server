const parser = require('ua-parser-js');


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
    "accessed": "",
    "date": 0,
  },

  validateUUID: (uuid='') => {
    if (Array.isArray(uuid)) uuid = uuid[0];
    try {
      return uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i) ? true : false;
    } catch(err) { console.error('Not a valid UUID'); return false }
  },

  validateClient: function(variable='', input='') {
    if (!input) { return null; }
    if (Array.isArray(input)) input = input[0];
    try {
      switch (variable) {
        case("section"): 
          return input.match(/main|blocks|codex|bin/i) ? input : false; break;
        case('subSection'):
          return input.match(/main|blocks|codex/) ? input : false; break;
        case("nodeID"):
          return input.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[1][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i) ? input : false; break;
      }
    } catch(err) { return false; }
  },

  timeNow: () => { 
    return new Date(Date.now()).toISOString();
  },

  BaseType: (mime='') => {
    return typeof mime !== 'string' ? '' : mime.split('/')[0];
  },
  
  capitalize: (s='') => {
    return typeof s !== 'string' ? '' : s.charAt(0).toUpperCase() + s.slice(1);
  },

  convertSize: (InputSize=0) => {
    if (!InputSize || typeof InputSize !== 'number') { return '-' }
    let fileSizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    for (let i=0; i<fileSizes.length; i++) {
      if (InputSize <= 1024) { return InputSize+" "+fileSizes[i] }
      else { InputSize = parseFloat(InputSize / 1024).toFixed(2) }
    }
    return InputSize;
  },

  dupeNameIncrement: (parent_object, name='', num=0) => {
    return typeof parent_object[num+"_"+name] == 'undefined' ? (num == 0 ? name : num+"_"+name) : module.exports.dupeNameIncrement(parent_object, name, num+1);
  },

  truncate: function(string='', desired=0) {  // Shorten Length of String
    if (typeof string !== 'string' || typeof desired !== 'number' || !string.length) {return string;}
    return (string.length > desired) ? string.substr(0, desired-1) : string;
  },

  Device_Info: function(Type, Connection) {
    let userAgent = (Type == "SOCKET" ? parser(Connection.request.headers['user-agent']) : parser(Connection.headers['user-agent']));
    return {
      "Device_Vendor": userAgent?.device?.vendor || '',
      "Device_Model": userAgent?.device?.model || '',
      "Device_Type": userAgent?.device?.type || '',
      "OS_Name": userAgent?.os?.name || '',
      "OS_Version": userAgent?.os?.version || '',
      "Browser_Name": userAgent?.browser?.name || '',
      "Brower_Major": userAgent?.browser?.major || '',
      "CPU": userAgent?.cpu?.architecture || ''
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