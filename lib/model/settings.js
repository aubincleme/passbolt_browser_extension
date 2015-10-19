var __ = require("sdk/l10n").get;
var Config = require('./config');
var Validator = require('../vendors/validator');

/**
 * The class that deals with users settings
 */
var Settings = function() {};

/**
 * Sanity check on user settings
 * @return
 */
Settings.prototype.isValid = function() {
    try {
        this.getSecurityToken();
        this.getDomain();
    } catch(e) {
        return false;
    }
    return true;
};

/**
 * Validate a security token
 * @param token
 * @returns {boolean} true if successfull
 * @throw Error on validation failure
 * @private
 */
Settings.prototype.__validateToken = function (token) {
    if( (typeof token === 'undefined')) {
        throw Error(__('A token cannot be empty'));
    }

    if (typeof token.color === 'undefined') {
        throw Error(__('A token color cannot be empty'));
    }

    if (typeof token.code === 'undefined') {
        throw Error(__('A token code cannot be empty'));
    }

    if (typeof token.textcolor === 'undefined') {
        throw Error(__('A token text color cannot be empty'));
    }

    if(!Validator.isHexColor(token.color)) {
        throw Error(__('This is not a valid token color: ' + token.color));
    }

    if(!Validator.isHexColor(token.textcolor)) {
        throw Error(__('This is not a valid token text color: ' + token.textcolor));
    }
    return true;
};

/**
 * Validate a domain
 * @param token
 * @returns {boolean} true if successfull
 * @throw Error on validation failure
 * @private
 */
Settings.prototype.__validateDomain = function (domain) {
    if((typeof domain === 'undefined')) {
        throw new Error(__('A domain cannot be empty'));
    }
    if(!Validator.isURL(domain)) {
        throw new Error(__('The trusted domain url is not valid'));
    }
    return true;
};

/**
 * Return the user security token
 * @param token
 * @throw Error when security token is not set
 */
Settings.prototype.getSecurityToken = function() {
    var token = {};
    token.code = Config.read('securityToken.code');
    token.color = Config.read('securityToken.color');
    token.textcolor = Config.read('securityToken.textColor');

    if( (typeof token.code === 'undefined') ||
        (typeof token.color === 'undefined') ||
        (typeof token.textcolor === 'undefined'))
    {
        throw new Error(__('Security token is not set'));
    }
    return token;
};

/**
 * Set the user security token
 * @param token
 * @throw Error when security token does not validate
 */
Settings.prototype.setSecurityToken = function(token) {
    this.__validateToken(token);
    Config.write('securityToken.code', token.code);
    Config.write('securityToken.color', token.color);
    Config.write('securityToken.textColor', token.textcolor);
    return true;
};

/**
 * Set a domain (url, ip, etc) that the plugin can trust
 * @param domain
 * @throw Error when domain is not a valid url or is empty
 */
Settings.prototype.setDomain = function(domain) {
    this.__validateDomain(domain);
    return Config.write('trustedDomain', domain);
};

/**
 * The url of the domain the passbolt plugin can trust
 * @returns {undefined|string}
 */
Settings.prototype.getDomain = function() {
    var domain = Config.read('trustedDomain');

    if(typeof domain === 'undefined') {
        if ( !Config.isDebug()) {
            throw new Error(__('Trusted domain is not set'));
        } else {
            domain = Config.read('baseUrl');
            if(typeof domain === 'undefined') {
                throw new Error(__('Base url not found in config'));
            }
        }
    }
    return domain;
};

/**
 * Flush the user settings
 */
Settings.prototype.flush = function () {
    Config.flush();
};

exports.Settings = Settings;