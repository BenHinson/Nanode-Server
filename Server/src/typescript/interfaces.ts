// global
interface LooseObject {
  [key: string]: any
}
interface Activity extends NordAccount {
  'action'?: string
  'reason'?: string
  'email'?: string
}

// mongo.ts
interface MDB_Databases {
  'nanode'?: any
  'nord'?: any
  'node'?: any
}
interface MDB_Collections {
  'account'?: any
  'link'?: any
  'download'?: any
  'node'?: any
}

// accounts.ts
interface Write_Params {
  user?: string
  type?: string
  parentKey?: string
  childKey?: string
  data?: any
}
interface MongoEdit {
  $inc?: any
  $set?: any
}

// links.ts
interface LinkData {
  'oID': string
  'file_name': string
  'mime': string
}

// nord.ts
interface Cookie {
  'uID': string
  'sID': string
  'domain': string
  'cID': string
  'toc': number
  'rot': string
}
interface NewSession {
  'Added'?: number
  'Dev_Added': string
  'Dev_Info': Device
  'Locked': boolean
}
interface NordAccount {
  'uID'?: string | boolean
  'err'?: string
  'req'?: {
    'type': string | 'HTTP'
    'url': string
  }
}
interface Device {
  "Device_Vendor": string
  "Device_Model": string
  "Device_Type": string
  "OS_Name": string
  "OS_Version": string | number
  "Browser_Name": string
  "Brower_Major": string
  "CPU": string
}
