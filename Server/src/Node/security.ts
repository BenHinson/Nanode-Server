import Node from '../Node/node';
import Account from '../Account/account';

const uploadFileTree: LooseObject = {}; // Holds data about uploaded files to protect against files too large or edited file sizes.

// ===================================================

const Checker = async ({
  userId,
  section,
  nodeId,
  wanted,
  input,
}: SecurityCheck) => {
  if (nodeId.match(/home|homepage/i)) {
    return false;
  }
  if (!section) {
    console.log(
      'Security Checker Requires a section. Must check all calls to securityChecker',
    );
    return false;
  }

  let securityLookup = await Node.Read({
    userId,
    type: 'SPECIFIC',
    section: section,
    nodeIds: [nodeId],
    keys: ['security'],
  });
  if (!securityLookup[nodeId]?.security) {
    return false;
  }
  let nodeSecurity = securityLookup[nodeId].security;

  let level = 0;
  let type: Array<'Password' | 'Pin'> = [];

  if (nodeSecurity.pass) {
    level++;
    type.push('Password');
  }
  if (nodeSecurity.pin) {
    level++;
    type.push('Pin');
  }
  // if (NodeSecurity.time)

  if (wanted == 'Amount') {
    return level;
  } else if (wanted == 'Access') {
    if (!input) {
      return type.length >= 1 ? type : false;
    }
    Object.keys(nodeSecurity).forEach(
      k =>
        !nodeSecurity[k] &&
        nodeSecurity[k] !== undefined &&
        delete nodeSecurity[k],
    );
    Object.keys(input).forEach(
      k => !input[k] && input[k] !== undefined && delete input[k],
    );
    return JSON.stringify(nodeSecurity) === JSON.stringify(input)
      ? true
      : false;
  }
  return false;
};

const Value = function (item: SecurityValue, secLevel = 0) {
  // Convert security options to a numerical value
  if (!item.security) {
    return secLevel;
  }
  for (let key in item.security) {
    // @ts-ignore // item.security[key] causes issues? Likely the SecurityValue interface
    if (item.security[key].length || item.security[key].length === undefined) {
      secLevel++;
    }
  }
  return secLevel;
};

const Upload_Limit = async (
  userId: UserId,
  chunkSize: number,
  chunkInfo: ChunkInfo,
  meta: UploadMeta,
) => {
  // Create User Plan Tree
  // Get the users plan: 'max' and 'used' and save for reference.
  if (!uploadFileTree[userId]) {
    uploadFileTree[userId] = {};
    const userPlan = await Account.Get(userId, ['plan']);
    uploadFileTree[userId] = {plan: userPlan[0].plan, files: {}};
  }

  let uploadName = meta.name + '-' + meta.nodeId;

  // Check if the client states size will exceed their plan
  if (uploadFileTree[userId].plan.used > uploadFileTree[userId].plan.max) {
    // Checks if used > max
    return {auth: false, msg: 'Limit'};
  } else {
    // Sets
    uploadFileTree[userId].plan.used += chunkSize;
    uploadFileTree[userId].files[uploadName] =
      uploadFileTree[userId].files[uploadName] + chunkSize || chunkSize;
  }

  // Last chunk of file. Remove from the Upload Tree.
  if (chunkInfo.index >= chunkInfo.totalChunks - 1) {
    chunkSize = uploadFileTree[userId].files[uploadName];
    delete uploadFileTree[userId].files[uploadName];
  }

  return {auth: true, size: chunkSize, plan: uploadFileTree[userId].plan};
};

export default {Checker, Value, Upload_Limit};
