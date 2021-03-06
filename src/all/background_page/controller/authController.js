/**
 * Authentication controller
 * Manages login steps and post login operations
 * Can be extended to add 2FA, etc. and avoid clutering the event worker
 *
 * @copyright (c) 2018 Passbolt SARL
 * @licence GNU Affero General Public License http://www.gnu.org/licenses/agpl-3.0.en.html
 */
const app = require('../app');
var Config = require('../model/config');
const GpgAuth = require('../model/gpgauth').GpgAuth;

const User = require('../model/user').User;
const __ = require('../sdk/l10n').get;
const Worker = require('../model/worker');

/**
 * Auth Controller constructor.
 * @constructor
 */
const AuthController = function (worker, requestId) {
  this.worker = worker;
  this.requestId = requestId;
  this.auth = new GpgAuth();
};

/**
 * Perform a GPGAuth verify
 *
 * @returns {Promise<void>}
 */
AuthController.prototype.verify = async function () {
  let msg;
  try {
    await this.auth.verify();
    msg = __('The server key is verified. The server can use it to sign and decrypt content.');
    this.worker.port.emit(this.requestId, 'SUCCESS', msg);
  } catch (error) {
    msg = __('Could not verify server key.') + ' ' + error.message;
    this.worker.port.emit(this.requestId, 'ERROR', msg);
  }
};

/**
 * Handle the click on the passbolt toolbar icon.
 *
 * @returns {Promise<void>}
 */
AuthController.prototype.login = async function (passphrase, remember, redirect) {
  const user = User.getInstance();

  try {
    this._beforeLogin();
    await user.retrieveAndStoreCsrfToken();
    await this.auth.login(passphrase);
    await this._checkMfaAuthentication();
    await this._syncUserSettings();
    if (remember) {
      user.storeMasterPasswordTemporarily(passphrase, remember);
    }
    this._handleLoginSuccess(redirect);
  } catch (error) {
    this._handleLoginError(error);
  }
};

/**
 * Before login hook
 */
AuthController.prototype._beforeLogin = function () {
  // If the worker at the origin of the login is the AuthForm.
  // Keep a reference of the tab id into this._tabId.
  // Request the Auth worker to display a processing feedback.
  if (this.worker.pageMod && this.worker.pageMod.args.name == "AuthForm") {
    this._tabId = this.worker.tab.id;
    Worker.get('Auth', this._tabId).port.emit('passbolt.auth.login-processing', __('Logging in'));
  }
};

/**
 * Check that no MFA Authentication is required.
 */
AuthController.prototype._checkMfaAuthentication = async function() {
  // @todo the quickaccess worker should have a pagemod too
  // If the requester is the Quick access worker, we need to check if a MFA Authentication is required.
  // The Auth Form MFA check is made by the API that redirects the user if required.
  if (!this.worker.pageMod) {
    const user = User.getInstance();
    await user.isLoggedIn();
  }
};

/**
 * Sync the user account settings.
 * @returns {Promise<void>}
 */
AuthController.prototype._syncUserSettings = async function () {
  const user = User.getInstance();
  try {
    await user.settings.sync()
  } catch (error) {
    console.error('User settings sync failed');
    console.error(error.message);
    user.settings.setDefaults();
  }
};

/**
 * Handle a login success
 * @param {string} redirect url (optional)
 * @param {Error} redirect The uri to redirect the user to after login.
 */
AuthController.prototype._handleLoginSuccess = async function (redirect) {
  await app.pageMods.PassboltApp.init();

  if (this.worker.pageMod && this.worker.pageMod.args.name == "AuthForm") {
    let url;
    const trustedDomain = Config.read('user.settings.trustedDomain');

    // The application authenticator requires the success to be sent on another worker (Auth).
    // It will notify the users and redirect them.
    if (!redirect || !(typeof redirect === 'string' || redirect instanceof String) || redirect.charAt(0) !== '/') {
      url = new URL(trustedDomain);
    } else {
      url = new URL(trustedDomain + redirect);
    }
    redirect = url.href;
    const msg = __('You are now logged in!');
    Worker.get('Auth', this._tabId).port.emit('passbolt.auth.login-success', msg, redirect);
  } else {
    this.worker.port.emit(this.requestId, "SUCCESS");
  }
};

/**
 * Handle a login failure
 * @param {Error} error The caught error
 */
AuthController.prototype._handleLoginError = function (error) {
  if (this.worker.pageMod && this.worker.pageMod.args.name == "AuthForm") {
    Worker.get('Auth', this._tabId).port.emit('passbolt.auth.login-failed', error.message);
  } else {
    this.worker.port.emit(this.requestId, "ERROR", this.worker.port.getEmitableError(error));
  }
};

// Exports the User object.
exports.AuthController = AuthController;
