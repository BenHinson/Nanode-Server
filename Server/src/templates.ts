const Settings_Template = {
  accessed: '',
  date: 0,
};

const Node_Account: AccountBaseNodes = {
  _id: '',
  enc_key: '',
  size: {
    max: Number(process.env.MAX_FREE_PLAN_STORAGE), // 10 GB
    total: {},
    bin: {},
  },
  recent: {},
  home: {
    main: ['_MAIN_', '_GENERAL_'],
    codex: [],
    blocks: [],
    bin: {
      main: [],
      codex: [],
      blocks: [],
    },
  },
  main: {
    _MAIN_: {
      name: 'Main',
      contents: {},
    },
    _GENERAL_: {
      name: 'General',
      contents: {},
    },
  },
  codex: {},
  blocks: {},
  bin: {
    main: {},
    codex: {},
    blocks: {},
  },
};
const Node_Item: Node | any = {
  id: '',
  name: '',
  parent: '',
  size: 0,
  time: {
    created: {
      stamp: '',
      who: '',
    },
  },
  contents: {},
  type: {
    file: '',
    mime: '',
  },
};
const Short_Node: ShortNode = {
  name: '',
  type: {mime: ''},
  size: 0,
  color: '',
};

// ===================================================

export {Settings_Template, Node_Account, Node_Item, Short_Node};
