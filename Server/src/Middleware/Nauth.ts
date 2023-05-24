// Nauth - Node-Object-Record-Database

import CryptoJS from 'crypto-js';
import cookie from 'cookie';
import cookie_sign from 'cookie-signature';

import {nanoid} from 'nanoid';

const ROTATION_KEY = process.env.ROTATION_KEY!;
const SECRET_KEY = process.env.SECRET_KEY!;
const COOKIE_ENCRYPT_KEY = process.env.COOKIE_ENCRYPT_KEY!;

import Nelp from '../tools';
import Logger from './Logger';
import Account from '../Account/account';

import {getDB} from '../Admin/mongo';
const Nauth_DB = getDB('Nauth');

// ======================= TS ========================
import {NextFunction} from 'connect';
import {Request, Response} from 'express';

/////////////////////////////////////////////////////////

const Nauth = {
  Middle: (req: Request, res: Response, next: NextFunction) => {
    new Middle(req, res, next);
  },
  Create: (domain: string, cookieId: string, userId: string) => {
    // Create an entry within the Nauth Database
    return Nauth_DB.collection(domain)
      .insertOne({cookieId, userId, sessions: {}})
      .then((result: boolean) => {
        return true;
      })
      .catch((err: Error) => {
        console.error(`Couldn't create cookie data ${err}`);
        return false;
      });
  },
  Session: (
    res: Response,
    domain: string,
    cookieId: string,
    userId: string,
    sessionId: string,
    sessionCreated: number,
    deviceInfo: Device,
  ) => {
    // Set a cookie session into the Nauth Database
    return Nauth_DB.collection(domain)
      .updateOne(
        {cookieId},
        {
          $set: {
            [`sessions.${sessionId}`]: {
              added: sessionCreated,
              devAdded: Nelp.timeNowString(),
              devInfo: deviceInfo,
              locked: false,
            },
          },
        },
      )
      .then((result: boolean) => {
        return Nauth.MakeAndSet(
          res,
          domain,
          cookieId,
          userId,
          sessionId,
          sessionCreated,
        );
      })
      .catch((err: Error) => {
        console.error(`Couldn't write new session: ${err}`);
        return false;
      });
  },
  MakeAndSet: (
    res: Response,
    domain: string,
    cookieId: string,
    userId: string,
    sessionId: string,
    toc: number,
  ) => {
    // Creates and then sets the Nauth cookie for the client.
    let newCookie = CryptoJS.AES.encrypt(
      JSON.stringify({
        domain,
        cookieId,
        userId,
        sessionId,
        toc,
        rot: ROTATION_KEY,
      }),
      COOKIE_ENCRYPT_KEY,
    ).toString();
    return res.cookie('nauth', cookie_sign.sign(newCookie, SECRET_KEY), {
      domain: 'nanode.one',
      maxAge: Number(process.env.COOKIE_MAX_AGE!),
      httpOnly: true,
      secure: true,
    });
  },
};

class Middle {
  req: Request;
  res: Response;

  constructor(req: Request, res: Response, next: NextFunction) {
    this.req = req;
    this.res = res;

    this.Authenticate(next);
  }

  async Authenticate(next: NextFunction): Promise<void> {
    // ! DO NOT COMMIT THIS, this is for the react development in local host. @nocommit
    if (this.req.query?.host === 'true') {
      console.log('checking!');
      this.req.headers.userId = process.env.ADMIN_ID!;
      return next();
    }

    try {
      const NauthAccount: NauthAccount = await this.Validate(
        this.getCookie(this.req.cookies?.nauth),
      );

      Logger.ActivityLog(this.req, NauthAccount);

      if (
        NauthAccount.userId ||
        this.req.originalUrl.match(/\/settings|check/)
      ) {
        // @ts-ignore // trying to set req.headers.userId
        this.req.headers.userId = NauthAccount.userId || null;

        if (this.req.query?.details === 'true') {
          this.req.headers.accountDetails = (
            await Account.Get(NauthAccount.userId as string, [
              'username',
              'photo',
              'plan',
            ])
          )[0];
        }
        return next();
      }
      throw 'No Account userId needed for non: settings or check page'; // Runs the catch block
    } catch (error) {
      console.log('Nauth Middleware Error: ' + error);
      return this.res.redirect('https://account.nanode.one/login');
    }
  }

  async Validate(nauthCookie: Cookie | false): Promise<NauthAccount> {
    let trustedCookie = this.completeCookie(nauthCookie);
    if (!trustedCookie) {
      return this.cookieError('Incomplete Nauth');
    }

    nauthCookie = nauthCookie as Cookie;

    let Accepted_Cookie = this.checkCookie(nauthCookie);
    if (Accepted_Cookie) {
      return this.cookieSuccess(nauthCookie);
    }

    // The session has ran out and needs to be validated.
    const {domain, cookieId, userId, sessionId} = nauthCookie;

    let record = await this.Nauth_Read(domain, cookieId);
    if (!record || record.userId !== userId) {
      return this.cookieError('No Match: User ID');
    }

    let nauthSession = record.sessions[sessionId];
    if (!nauthSession || nauthSession.locked === true) {
      return this.cookieError('No Such Session or Locked');
    }

    let deviceMatch = Nelp.deviceMatch(
      Nelp.deviceInfo(this.req),
      nauthSession?.devInfo,
    );
    if (!deviceMatch) {
      return this.cookieError('Different Device');
    }

    // Set a New Session and Return that.

    let newSession: NewSession = {
      added: new Date().getTime(),
      devAdded: nauthSession?.devAdded,
      devInfo: Nelp.deviceInfo(this.req),
      locked: nauthSession.locked,
    };

    let newSessionId = await this.Nauth_Update(
      domain,
      record._id,
      sessionId,
      nanoid(),
      newSession,
    );
    if (!newSessionId) {
      return this.cookieError('Failed creating new Session');
    }

    Nauth.MakeAndSet(
      this.res,
      domain,
      cookieId,
      userId,
      newSessionId,
      newSession.added,
    );

    return this.cookieSuccess(nauthCookie);
  }

  // ===================================

  getCookie(encryptedCookie: string): Cookie | false {
    return encryptedCookie
      ? JSON.parse(
          CryptoJS.AES.decrypt(
            decodeURIComponent(cookie_sign.unsign(encryptedCookie, SECRET_KEY)),
            COOKIE_ENCRYPT_KEY,
          ).toString(CryptoJS.enc.Utf8),
        )
      : false;
  }
  completeCookie(cookie: Cookie | false): boolean {
    return cookie &&
      cookie.domain &&
      cookie.sessionId &&
      cookie.cookieId &&
      cookie.toc &&
      cookie.rot &&
      cookie.userId
      ? true
      : false;
  }
  checkCookie(nauthCookie: Cookie): boolean {
    return (
      nauthCookie.toc + Number(process.env.NAUTH_MAX_VALID_AGE!) >
        new Date().getTime() && nauthCookie.rot === ROTATION_KEY
    );
  }

  // ===================================

  async Nauth_Read(
    domain: string,
    cookieId: string,
  ): Promise<LooseObject | false> {
    return Nauth_DB.collection(domain)
      .find({cookieId}, {$exists: true})
      .toArray()
      .then((items: any) => {
        return items.length ? items[0] : false;
      })
      .catch((err: Error) => {
        console.error(`Error finding cID: ${err}`);
        return false;
      });
  }

  async Nauth_Update(
    domain: string,
    ObjId: string,
    currentSessionId: string,
    newSessionId: string,
    newSession: NewSession,
  ) {
    return Nauth_DB.collection(domain)
      .updateOne(
        {_id: ObjId},
        {
          $set: {[`sessions.${newSessionId}`]: newSession},
          $unset: {[`sessions.${currentSessionId}`]: 1},
        },
      )
      .then((result: boolean) => {
        return newSessionId;
      })
      .catch((err: Error) => {
        console.error(`Couldn't update session:  ${err}`);
        return false;
      });
  }

  // ===================================

  cookieError(errMessage: string) {
    return {
      userId: false,
      err: errMessage,
      req: {type: 'HTTP', url: this.req.originalUrl},
    };
  }
  cookieSuccess(nordCookie: Cookie) {
    return {
      userId: nordCookie.userId,
      req: {type: 'HTTP', url: this.req.originalUrl},
    };
  }
}

/////////////////////////////////////////////////////////

export default Nauth;
