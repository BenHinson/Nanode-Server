// global
type Sections = 'main' | 'codex' | 'blocks' | 'block' | 'bin'
type SubSections = string | undefined
type NodeTypes = 'Span' | 'Item'
type User = string
type NodeID = string

interface LooseObject {
  [key: string]: any
}
interface Activity extends NordAccount {
  'action'?: string
  'reason'?: string
  'email'?: string
  'Zipper'?: string
  'page'?: string
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
  user?: User
  type?: 'Increment' | 'Set' | 'Unset'
  parentKey?: 'settings' | 'plan' | 'share_links' | 'download_links'
  childKey?: string | string[] | 'used'
  data?: any
  multi?: boolean
}
interface MongoEdit {
  $inc?: any
  $set?: any
  $unset?: any
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

// link
interface LinkTemplate {
  url: string
  owner: string
  object?: string
  file: string
  mime: string
}
interface DownloadLinkTemplate extends LinkTemplate {
  for: 'SHARE'|'SELF'
  title: string
  size: number
  contents: number[]
  count: number
  preview?: any
  scanned?: boolean
}

// modify.ts > ZipFile
interface ZipParams {
  For: 'SELF'|'SHARE'
  name: string
  items: string | string[]
  section: Sections
}
interface ZipData {
  size: number
  contents: any[]
  title: string | 'Nanode_Collection'
}

// Node.ts > NODES
interface Account_Base_Nodes { // Account_Data. VIA: Account_Setup
  _id: string
  enc_key: Buffer | string
  "size": {
    "max": number // 10 GB
    "total": any
    "bin": any
  }
  "recent": {}
  "home": {
    'main': string[]
    'codex': string[]
    'blocks': string[]
    "bin": {[key in 'main'|'codex'|'blocks']: string[]}
  }
  "main": { [key:string]: Node | {name:string, contents:{}} }
  "codex": { [key:string]: Node | {name:string, contents:{}} }
  "blocks": { [key:string]: Node | {name:string, contents:{}} }
  "bin": {[key in 'main'|'codex'|'blocks']: { [key:string]: Node }}
}


interface Node extends SecurityValue {
  id: string
  name: string
  parent: string
  size: number
  time: {[key in 'modified'|'created'|'deleted']: NodeTime}
  contents: { // shh dont tell typescript this can be ShortNode[] | SpanNode[]
    file: string
    drive: string | 'F'
  }
  type: {
    file: any
    mime: string
  }
  share?: {
    link?: {
      url: string
    }
  }
  description?: string
  color?: string
  previous?: string[]
}
interface ShortNode {
  name?: string
  size?: number
  type?: {mime: string}
  mime?: ''
  time?: {[key in 'modified']: {}}
  color?: string
}
interface SpanNode {
  id: string
  name: string
  contents?: {}
  previous?: string[]
  time?: {[key in 'modified'|'created']: NodeTime}
}
interface PublicNode {
  [key: string]: {
    name: string
    size: number
    time: any
    type: {
      file: boolean | 'FOLDER'
      mime: string
    }
    color?: string
    BIN_DATA: {
      parent: string
      deleted: any | Date
      section: Sections
    }
  }
}


interface TreeNodes {
  'Tree_Data': {size: number, count: number}
  'Parent_Id': string[]
  'Parent_Node': {[key: string]: Node}
  'Child_Id': string[]
  'Child_Node': {[key: string]: Node}
}
interface Total_Tree_Size {
  [key:string]: number
}
interface GroupNodes {
  [key: string]: Node
}
interface NodeTime {
  stamp: string | Date
  who: string
}

// Node.ts Functions
interface ID_Query {
  section: Sections
  query: string[]
  contents?: boolean
}
interface Key_Set {
  Pre: string[] | string
  Change: Total_Tree_Size | number | {}
  Move?: boolean
  Negative?: boolean
}

// Node.ts > WRITE EDIT READ

type MongoObject  = {[key in '$pull' | '$set' | '$unset' | '$push' | '$inc' | string]: any}

interface Node_Write {
  user: string
  type: 'Span' | 'Folder' | 'Item' | 'File'
  section: Sections
  parent: string | 'home' | 'homepage'
  data: Node | SpanNode | any
}
interface Node_Edit {
  user: User
  type: 'DATA' | 'MOVE' | 'BIN' | 'DELETE' | 'RESTORE'
  section: Sections
  subSection?: SubSections
  id: string
  changeTo?: any
  moveTo?: Sections | 'homepage' | '_GENERAL_' | 'RESTORE'
  New_Parent?: any
  readCurrent?: boolean
  DONTSET?: boolean
}
interface Node_Read {
  user: User
  type: 'ID' | 'RAW' | 'SPECIFIC' | 'TREE' | 'CUSTOM' | 'EXISTS'
  section: Sections
  subSection?: SubSections
  ids: string[] | ['home'] | ['homepage']
  contents?: boolean
  keys?: string[]
  internal?: boolean
}


interface Node_CustomUpdate {
  user: string
  action: string
  key: string
  CUSTOM: any
}


// Security.ts
interface SecurityCheck {
  'section': Sections
  userID: User
  oID: string | 'home' | 'homepage'
  wanted: 'Amount' | 'Access'
  input?: any
}
interface SecurityValue {
  security: {
    'pass'?: string | undefined
    'pin'?: string | undefined
  }
}


// Search.ts
interface SearchQuery {
  user: User
  input: any
  inputTwo?: any
  params: SearchParams
}
interface SearchParams {
  color?: boolean
  type?: boolean
  date?: boolean
  size?: boolean

  forFolders?: boolean
  forFiles?: boolean
  onlyShared?: boolean

  withinParent?: string

  description?: boolean
  prevNames?: boolean
}

// Send.ts
interface ReadSendData {
  userID: User,
  type: "ID" | "RAW" | "SPECIFIC" | "TREE" | "CUSTOM",
  section:Sections,
  subSection?: SubSections,
  contents: boolean,
  path: string[]
}
type SendMessage = string | { [key: string]: any }


// Drive.ts
interface POST_Upload {
  message?: 'Queue_Empty' | 'Cancelled'
  meta: UploadMeta
  chunk_info: ChunkInfo
  file: any | Buffer
}


// ReadWrite.ts
interface UploadObjectTree {
  [key: string]: any
}
interface UploadReturn {
  'written'?: boolean
  'file_oID'?: string,
  'file_type'?: any | undefined // core.FileTypeResult
  'chunkWrite'?: 'Success'
}

// Upload
interface UploadMeta {
  section: Sections
  id: string
  name: string
  isFi: boolean
  type: string
  parent: string
  relative_path: string
  size: number
  modified: Date
}
interface Chunk {
  user: User
  id: string
  index: number
  total: number
  FileArray: Buffer
}
interface ChunkInfo {
  index: number
  total_chunks: number
}