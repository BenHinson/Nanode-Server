import parser from 'ua-parser-js'

// ======================= TS ========================
import { Request, Response } from 'express';

// =================================================== 

const validateUUID = (uuid:string=''): boolean => {
  if (Array.isArray(uuid)) uuid = uuid[0];
  try {
    return uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i) ? true : false;
  } catch(err) { console.error('Not a valid UUID'); return false }
}

const validateClient = (variable:string='', input:string='') => {
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
}

const timeNow = () => { 
  return new Date(Date.now()).toISOString();
}

const BaseType = (mime:string=''):string => {
  return typeof mime !== 'string' ? '' : mime.split('/')[0];
}

const capitalize = (s:string=''):string => {
  return typeof s !== 'string' ? '' : s.charAt(0).toUpperCase() + s.slice(1);
}

const convertSize = (InputSize:number=0):string => {
  if (!InputSize) { return '-' }
  let fileSizes:string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  for (let i=0; i<fileSizes.length; i++) {
    if (InputSize <= 1024) { return InputSize+" "+fileSizes[i] }
    else { InputSize = +(InputSize / 1024).toFixed(2); } // The +() is == parseFloat() . ts doesn't like parseFloat() it seems
  }
  return ""+InputSize;
}

const dupeNameIncrement = (parent_object:object | any, name:string='', num:number=0): string => {
  return typeof parent_object[num+"_"+name] == 'undefined' ? (num == 0 ? name : num+"_"+name) : dupeNameIncrement(parent_object, name, num+1);
}

const truncate = (string:string='', desired:number=0): string => {  // Shorten Length of String
  if (typeof string !== 'string' || typeof desired !== 'number' || !string.length) { return string }
  return (string.length > desired) ? string.substr(0, desired-1) : string;
}

const Device_Info = (Connection:Request) => {
  let userAgent = parser(Connection.headers['user-agent']);
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
}
const DeviceMatch = (This:object, Registered:any): boolean => {
  let Device_Difference = 0;
  for (const [key, value] of Object.entries(This)) {
    if (Registered[key] != value) {Device_Difference++;}
  }
  return Device_Difference > 1 ? false : true;
}

const ErrorPage = (res:Response | any) => {
  return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');
}

// ===================================================

const Settings_Template = {
  "accessed": "",
  "date": 0,
}

const Node_Account:Account_Base_Nodes = {
  _id: '',
  enc_key: '',
  "size": {
    "max": (10 * 1024 * 1024 * 1024), // 10 GB
    "total": {},
    "bin": {}
  },
  "recent": {},
  "home": {
    "main": [
      '_MAIN_',
      '_GENERAL_'
    ],
    "codex": [],
    "blocks": [],
    "bin": {
      "main": [],
      "codex": [],
      "blocks": []
    }
  },
  "main": {
    "_MAIN_": {
      "name": 'Main',
      "contents": {}
    },
    "_GENERAL_": {
      "name": 'General',
      "contents": {}
    }
  },
  "codex": {},
  "blocks": {},
  "bin": {
    "main": {},
    "codex": {},
    "blocks": {}
  }
};
const Node_Item:Node|any = {
  id: '',
  name: '',
  parent: '',
  size: 0,
  time: {
    created: {
      stamp: '',
      who: ''
    }
  },
  contents: {},
  type: {
    file: '',
    mime: ''
  },
};
const Short_Node:ShortNode = {
  name: '',
  type: {mime: ''},
  size: 0,
  color: ''
};

// ===================================================


export {
  Settings_Template,
  Node_Account,
  Node_Item,
  Short_Node,
  validateUUID,
  validateClient,
  timeNow,
  BaseType,
  capitalize,
  convertSize,
  dupeNameIncrement,
  truncate,
  Device_Info,
  DeviceMatch,
  ErrorPage,
}