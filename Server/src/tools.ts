import parser from 'ua-parser-js';

// ======================= TS ========================
import {Request, Response} from 'express';
// ===================================================

const Nelp = {
  // Validation
  validateUUID: (uuid: string = ''): boolean => {
    if (Array.isArray(uuid)) uuid = uuid[0];
    try {
      return uuid.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
        ? true
        : false;
    } catch (err) {
      console.error('Not a valid UUID');
      return false;
    }
  },
  validateClient: (
    variable: 'section' | 'subSection' | 'nodeId',
    input: string = '',
  ) => {
    if (!input) {
      return null;
    }
    if (Array.isArray(input)) input = input[0];
    try {
      switch (variable) {
        case 'section':
          return input.match(/main|blocks|codex|bin/i) ? input : false;
          break;
        case 'subSection':
          return input.match(/main|blocks|codex/) ? input : false;
          break;
        case 'nodeId':
          return input.match(
            /^[0-9A-F]{8}-[0-9A-F]{4}-[1][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
          )
            ? input
            : false;
          break;
      }
    } catch (err) {
      return false;
    }
  },

  // Transform
  capitalize: (s: string = ''): string => {
    return typeof s !== 'string' ? '' : s.charAt(0).toUpperCase() + s.slice(1);
  },
  convertSize: (inputSize: number = 0): string => {
    if (!inputSize) {
      return '-';
    }
    let fileSizes: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    for (let i = 0; i < fileSizes.length; i++) {
      if (inputSize <= 1024) {
        return inputSize + ' ' + fileSizes[i];
      } else {
        inputSize = +(inputSize / 1024).toFixed(2);
      } // The +() is == parseFloat() . ts doesn't like parseFloat() it seems
    }
    return '' + inputSize;
  },
  truncate: (string: string = '', desired: number = 0): string => {
    // Shorten Length of String
    if (
      typeof string !== 'string' ||
      typeof desired !== 'number' ||
      !string.length
    ) {
      return string;
    }
    return string.length > desired ? string.substr(0, desired - 1) : string;
  },
  baseMimeType: (mime: string = ''): string => {
    return typeof mime !== 'string' ? '' : mime.split('/')[0];
  },

  // Data
  timeNowString: () => {
    return new Date(Date.now()).toISOString();
  },
  dupeNameIncrement: (
    parentObject: object | any,
    name: string = '',
    num: number = 0,
  ): string => {
    return typeof parentObject[num + '_' + name] == 'undefined'
      ? num == 0
        ? name
        : num + '_' + name
      : Nelp.dupeNameIncrement(parentObject, name, num + 1);
  },

  // Device Data
  deviceInfo: (Connection: Request) => {
    let userAgent = parser(Connection.headers['user-agent']);
    return {
      deviceVendor: userAgent?.device?.vendor || '',
      deviceModel: userAgent?.device?.model || '',
      deviceType: userAgent?.device?.type || '',
      OSName: userAgent?.os?.name || '',
      OSVersion: userAgent?.os?.version || '',
      browserName: userAgent?.browser?.name || '',
      browserMajor: userAgent?.browser?.major || '',
      CPU: userAgent?.cpu?.architecture || '',
    };
  },
  deviceMatch: (thisDevice: object, registered: any): boolean => {
    let deviceDifference = 0;
    for (const [key, value] of Object.entries(thisDevice)) {
      if (registered[key] != value) {
        deviceDifference++;
      }
    }
    return deviceDifference > 3 ? false : true;
  },

  errorPage: (res: Response | any) => {
    return res
      .status(404)
      .sendFile('F:\\Nanode\\Nanode Client\\views\\misc\\Error.html');
  },
};

export default Nelp;
