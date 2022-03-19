// global
type Sections = 'main' | 'codex' | 'blocks' | 'block' | 'bin'
type SubSections = string | undefined
type NodeTypes = 'Span' | 'Item'
type UserId = string
type NodeId = string

interface LooseObject {
  [key: string]: any
}
interface Activity extends NauthAccount {
  'action'?: string
  'reason'?: string
  'email'?: string
  'zipper'?: string
  'page'?: string
}


// mongo.ts
interface MDBDatabases {
  'nanode'?: any
  'Nauth'?: any
  'node'?: any
}
interface MDBCollections {
  'account'?: any
  'link'?: any
  'download'?: any
  'node'?: any
}

// accounts.ts
interface WriteParams {
  userId?: UserId
  type?: 'INCREMENT' | 'SET' | 'UNSET'
  parentKey?: 'settings' | 'plan' | 'shareLinks' | 'downloadLinks'
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
  'nodeId': string
  'fileName': string
  'mime': string
}

// Nauth.ts
interface Cookie {
  'userId': string
  'sessionId': string
  'domain': string
  'cookieId': string
  'toc': number
  'rot': string
}
interface NewSession {
  'added': number
  'devAdded': string
  'devInfo': Device
  'locked': boolean
}
interface NauthAccount {
  'userId'?: UserId | boolean
  'err'?: string
  'req'?: {
    'type'?: string | 'HTTP'
    'url'?: string
  }
}
interface Device {
  "deviceVendor": string
  "deviceModel": string
  "deviceType": string
  "OSName": string
  "OSVersion": string | number
  "browserName": string
  "browserMajor": string
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
  forUser: 'SELF'|'SHARE'
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
interface AccountBaseNodes { // Account_Data. VIA: Account_Setup
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
  'treeData': {size: number, count: number}
  'parentId': string[]
  'parentNode': {[key: string]: Node}
  'childId': string[]
  'childNode': {[key: string]: Node}
}
interface TotalTreeSize {
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
interface IdQuery {
  section: Sections
  query: string[]
  contents?: boolean
}
interface KeySet {
  pre: string[] | string
  change: TotalTreeSize | number | {}
  move?: boolean
  negative?: boolean
}

// Node.ts > WRITE EDIT READ

type MongoObject  = {[key in '$pull' | '$set' | '$unset' | '$push' | '$inc' | string]: any}

interface NodeWrite {
  userId: UserId
  type: 'Span' | 'Folder' | 'Item' | 'File'
  section: Sections
  parent: string | 'home' | 'homepage'
  data: Node | SpanNode | any
}
interface NodeEdit {
  userId: UserId
  type: 'DATA' | 'MOVE' | 'BIN' | 'DELETE' | 'RESTORE'
  section: Sections
  subSection?: SubSections
  nodeId: string
  changeTo?: any
  moveTo?: Sections | 'homepage' | '_GENERAL_' | 'RESTORE'
  newParent?: any
  readCurrent?: boolean
  bypass?: boolean
  doNotSet?: boolean
}
interface NodeRead {
  userId: UserId
  type: 'ID' | 'RAW' | 'SPECIFIC' | 'TREE' | 'CUSTOM' | 'EXISTS'
  section: Sections
  subSection?: SubSections
  nodeIds: string[] | ['home'] | ['homepage']
  contents?: boolean
  keys?: string[]
  internal?: boolean
}


interface NodeCustomUpdate {
  userId: UserId
  action: string
  key: string
  CUSTOM: any
}


// Security.ts
interface SecurityCheck {
  section: Sections
  userId: UserId
  nodeId: string | 'home' | 'homepage'
  wanted: 'Amount' | 'Access'
  input?: any
}
interface SecurityValue {
  security: {
    'pass'?: string
    'pin'?: string
  }
}


// Search.ts
interface SearchQuery {
  userId: UserId
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
  userId: UserId,
  type: "ID" | "RAW" | "SPECIFIC" | "TREE" | "CUSTOM",
  section:Sections,
  subSection?: SubSections,
  contents: boolean,
  path: string[]
}
type SendMessage = string | { [key: string]: any }


// Drive.ts
interface POSTUpload {
  message?: 'Queue_Empty' | 'Cancelled'
  meta: UploadMeta
  chunkInfo: ChunkInfo
  file: any | Buffer
}


// ReadWrite.ts
interface UploadObjectTree {
  [key: string]: any
}
interface UploadReturn {
  'written'?: boolean
  'fileNodeId'?: string,
  'fileType'?: any | undefined // core.FileTypeResult
  'chunkWrite'?: 'Success'
}
interface ReadData {
  userId?:string,
  nodeId?:string,
  section?: Sections,
  fileId?:string,
  mimetype:string,
  thumbnail?:string
  resize?:false|{width:number|undefined,height:number|undefined}
}

// Upload
interface UploadMeta {
  section: Sections
  nodeId: string
  name: string
  isFi: boolean
  type: string
  parent: string
  relativePath: string
  size: number
  modified: Date
}
interface Chunk {
  userId: UserId
  nodeId: string
  index: number
  total: number
  fileArray: Buffer
}
interface ChunkInfo {
  index: number
  totalChunks: number
}