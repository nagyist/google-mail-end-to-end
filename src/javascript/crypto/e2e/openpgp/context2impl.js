/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Default implementation of Context2.
 */
goog.provide('e2e.openpgp.Context2Impl');

goog.require('e2e');
/** @suppress {extraRequire} force loading of all ciphers */
goog.require('e2e.cipher.all');
/** @suppress {extraRequire} force loading of all compression methods */
goog.require('e2e.compression.all');
/** @suppress {extraRequire} force loading of all hash functions */
goog.require('e2e.hash.all');
goog.require('e2e.openpgp.ClearSignMessage');
goog.require('e2e.openpgp.Context2');
goog.require('e2e.openpgp.KeyRingType');
goog.require('e2e.openpgp.asciiArmor');
goog.require('e2e.openpgp.block.EncryptedMessage');
goog.require('e2e.openpgp.block.LiteralMessage');
goog.require('e2e.openpgp.block.TransferablePublicKey');
goog.require('e2e.openpgp.block.factory');
goog.require('e2e.openpgp.error.InvalidArgumentsError');
goog.require('e2e.openpgp.error.ParseError');
goog.require('e2e.openpgp.error.UnsupportedError');
goog.require('e2e.openpgp.packet.SurrogateSecretKey');
/** @suppress {extraRequire} force loading of all signers */
goog.require('e2e.signer.all');
goog.require('goog.Promise');
goog.require('goog.array');
goog.require('goog.asserts');



/**
 * Implements a "context". Provides a high level API for key management,
 * encryption and signing. This context is used by external code, such as the
 * extension's user interface, to call the base OpenPGP library.
 * @constructor
 * @param {!e2e.openpgp.KeyManager} keyManager The Key Manager object.
 * @implements {e2e.openpgp.Context2}
 */
e2e.openpgp.Context2Impl = function(keyManager) {
  /**
   * Key Manager object.
   * @private {!e2e.openpgp.KeyManager}
   */
  this.keyManager_ = keyManager;
  /**
   * Should the output of the functions be ASCII-armored.
   * @private {boolean}
   */
  this.armorOutput_ = true;
  /**
   * List of headers to add to armored messages (Version, Comment, etc).
   * @type {!Object.<string>}
   * @private
   */
  this.armorHeaders_ = {};
};


/**
 * Deferred constructor.
 * @param {!goog.Thenable.<!e2e.openpgp.KeyManager>} keyManagerPromise The
 *     promise of the Key Manager instance.
 * @return {!goog.Thenable.<!e2e.openpgp.Context2Impl>} The Context2Impl
 *     promise, fulfilled when the object will initialize.
 */
e2e.openpgp.Context2Impl.launch = function(keyManagerPromise) {
  return keyManagerPromise.then(function(keyManager) {
    return new e2e.openpgp.Context2Impl(keyManager);
  });
};


/**
 * Message that can be encoded. Used internally in {@link #encryptSign}.
 * @typedef {!e2e.openpgp.block.Message|!e2e.openpgp.ClearSignMessage}
 * @private
 */
e2e.openpgp.Context2Impl.EncodableMessage_;


/**
 * Promise of a message that can be encoded. Used internally in
 * {@link #encryptSign}.
 * @typedef {!goog.Thenable<!e2e.openpgp.Context2Impl.EncodableMessage_>}
 * @private
 */
e2e.openpgp.Context2Impl.EncodableMessagePromise_;


/** @override */
e2e.openpgp.Context2Impl.prototype.getTrustedKeys = function(purpose, email) {
  return this.keyManager_.getTrustedKeys(purpose, email);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getAllSecretKeys = function(opt_providerId) {
  return this.keyManager_.getAllKeys(e2e.openpgp.KeyRingType.SECRET,
      opt_providerId);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getAllPublicKeys = function(opt_providerId) {
  return this.keyManager_.getAllKeys(e2e.openpgp.KeyRingType.PUBLIC,
      opt_providerId);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getKeyByFingerprint = function(fingerprint,
    opt_providerId) {
  return this.keyManager_.getKeyByFingerprint(fingerprint, opt_providerId);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.setProviderCredentials = function(providerId,
    credentials) {
  return this.keyManager_.setProviderCredentials(providerId, credentials);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getAllKeyGenerateOptions = function() {
  return this.keyManager_.getAllKeyGenerateOptions();
};


/** @override */
e2e.openpgp.Context2Impl.prototype.generateKeyPair = function(userId,
    generateOptions) {
  return this.keyManager_.generateKeyPair(userId, generateOptions);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getKeyringExportOptions = function(
    keyringType) {
  return this.keyManager_.getKeyringExportOptions(keyringType);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.exportKeyring = function(keyringType,
    exportOptions) {
  return this.keyManager_.exportKeyring(keyringType, exportOptions);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.trustKeys = function(keys, email, purpose,
    opt_trustData) {
  return this.keyManager_.trustKeys(keys, email, purpose, opt_trustData);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.isKeyTrusted = function(key, email,
    purpose) {
  // TODO(koto): implement.
  return goog.Promise.resolve(true);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.unlockKey = function(key, unlockData) {
  return this.keyManager_.unlockKey(key, unlockData);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.setArmorOutput = function(shouldArmor) {
  this.armorOutput_ = shouldArmor;
  return goog.Promise.resolve(undefined);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.setArmorHeader = function(name, value) {
  this.armorHeaders_[name] = value;
  return goog.Promise.resolve(undefined);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.initializeKeyRing = function(
    passphraseCallback) {
  // TODO(koto): implement.
  return goog.Promise.resolve(undefined);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.changeKeyRingPassphrase = function(
    passphrase) {
  return goog.Promise.reject(new Error('Not implemented.'));
};


/** @override */
e2e.openpgp.Context2Impl.prototype.isKeyRingUnlocked = function() {
  // TODO(koto): implement.
  return goog.Promise.resolve(true);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.isKeyRingEncrypted = function() {
  // TODO(koto): implement.
  return goog.Promise.resolve(false);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getKeysDescription = function(
    keySerialization) {
  return goog.Promise.resolve(undefined).then(function() {
    if (typeof keySerialization == 'string') {
      keySerialization = this.extractByteArrayFromArmorText_(keySerialization);
    }
    var blocks = e2e.openpgp.block.factory.parseByteArrayAllTransferableKeys(
        keySerialization, true /* skip keys with errors */);
    if (blocks.length == 0) {
      throw new e2e.openpgp.error.ParseError('No valid key blocks found.');
    }
    return e2e.openpgp.block.factory.extractKeys(
        blocks, true /* skip keys with errors */);
  }, null, this);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.importKeys = function(keySerialization,
    passphraseCallback) {
  if (typeof keySerialization == 'string') {
    keySerialization = this.extractByteArrayFromArmorText_(keySerialization);
  }
  return this.keyManager_.importKeys(keySerialization, passphraseCallback);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.encryptSign = function(plaintext, options,
    encryptionKeys, passphrases, signatureKeys) {
  return this.createSurrogateSecretKeys_(signatureKeys)
      .then(goog.partial(this.doEncryptSignOperation_,
          plaintext,
          options,
          encryptionKeys,
          passphrases), null, this)
      .then(this.encodeMessage_, null, this);
};


/**
 * Selects the correct encrypt/sign operation and calls it, returning the
 *     results.
 * @param {!e2e.openpgp.Plaintext} plaintext The plaintext.
 * @param {!e2e.openpgp.EncryptOptions} options Metadata to add.
 * @param {!Array.<!e2e.openpgp.Key>} encryptionKeys The keys to
 *     encrypt the message with.
 * @param {!Array.<string>} passphrases Passphrases to use for symmetric
 *     key encryption of the message.
 * @param  {!Array.<!e2e.openpgp.packet.SurrogateSecretKey>} signKeys
 * @return {!goog.Thenable<!e2e.openpgp.Context2Impl.EncodableMessage_>}
 *     The encrypted and/or signed message, before encoding.
 * @private
 */
e2e.openpgp.Context2Impl.prototype.doEncryptSignOperation_ = function(
    plaintext, options, encryptionKeys, passphrases, signKeys) {
  if (signKeys.length > 1) {
    // TODO(koto): Support multiple signing keys.
    throw new e2e.openpgp.error.UnsupportedError(
        'Signing with multiple keys is unsupported.');
  }
  var needsEncryption = (encryptionKeys.length > 0 || passphrases.length > 0);
  var result;
  if (needsEncryption) {
    // Encryption required.
    result = this.encryptSign_(
        plaintext,
        options,
        encryptionKeys,
        passphrases,
        signKeys);
  } else {
    // No encryption required, just signing.
    if (signKeys.length == 0) {
      throw new e2e.openpgp.error.InvalidArgumentsError(
          'No signing keys provided.');
    }

    if (typeof plaintext == 'string') {
      // Clearsign messages support only single signature keys now.
      result = this.clearSign_(plaintext, signKeys[0]);
    } else {
      result = this.byteSign_(plaintext, signKeys);
    }
  }

  // Creating a type annotation here to satisfy the covariance/contravariance
  // problems of Thenables. Do NOT use this result object outside this class.
  return /** @type {!e2e.openpgp.Context2Impl.EncodableMessagePromise_} */ (
      result);
};


/**
 * Internal implementation of the encrypt/sign operation.
 * @param {!e2e.ByteArray|string} plaintext The plaintext.
 * @param {!e2e.openpgp.EncryptOptions} options Metadata to add.
 * @param {!e2e.openpgp.Keys} encryptionKeys The key handles to encrypt the
 *     message to.
 * @param {!Array.<string>} passphrases Passphrases to use for symmetric
 *     key encryption of the message.
 * @param {!Array.<!e2e.openpgp.packet.SurrogateSecretKey>} signatureKeys
 *     The keys to sign the message with.
 * @private
 * @return {!goog.Thenable<!e2e.openpgp.block.EncryptedMessage>} The encrypted
 *     message.
 */
e2e.openpgp.Context2Impl.prototype.encryptSign_ = function(
    plaintext, options, encryptionKeys, passphrases, signatureKeys) {
  var keys = goog.array.map(encryptionKeys, this.requirePublicKey_, this);
  var literal = e2e.openpgp.block.LiteralMessage.construct(plaintext);
  goog.asserts.assert(signatureKeys.length <= 1);
  return e2e.openpgp.block.EncryptedMessage.construct(
      literal,
      keys,
      passphrases,
      signatureKeys[0] || undefined);
};


/**
 * Converts a public key handle to a key block.
 * Throws an error when a key handle does not represent a public key or the
 * resulting key is invalid due to e.g. invalid/outdated signatures.
 * @param  {!e2e.openpgp.Key} key A key handle.
 * @return {!e2e.openpgp.block.TransferablePublicKey}
 * @private
 */
e2e.openpgp.Context2Impl.prototype.requirePublicKey_ = function(key) {
  goog.asserts.assert(!key.key.secret);
  var keyBlock = e2e.openpgp.block.factory.parseByteArrayTransferableKey(
      key.serialized);
  if (keyBlock instanceof e2e.openpgp.block.TransferablePublicKey) {
    keyBlock.processSignatures();
    return keyBlock;
  }
  throw new e2e.openpgp.error.InvalidArgumentsError('Invalid public key.');
};


/**
 * Creates surrogate keys with encryption/signing backed by the KeyProvider.
 * @param  {!e2e.openpgp.Keys} keys
 * @return {!goog.Thenable<!Array<!e2e.openpgp.packet.SurrogateSecretKey>>}
 *     The surrogate keys.
 * @private
 */
e2e.openpgp.Context2Impl.prototype.createSurrogateSecretKeys_ = function(keys) {
  return goog.Promise.all(goog.array.map(keys,
      this.createSurrogateSecretKey_, this));
};


/**
 * Creates surrogate keys with encryption/signing backed by the KeyProvider.
 * @param  {!e2e.openpgp.Key} key
 * @return {!goog.Thenable<!e2e.openpgp.packet.SurrogateSecretKey>} The
 *     surrogate key.
 * @private
 */
e2e.openpgp.Context2Impl.prototype.createSurrogateSecretKey_ = function(key) {
  return goog.Promise.resolve(key).then(function(key) {
    goog.asserts.assert(key.key.secret);
    return e2e.openpgp.packet.SurrogateSecretKey.constructSigningKey(
        key,
        goog.bind(this.keyManager_.sign, this.keyManager_));
  }, null, this);
};


/**
 * Internal implementation of the clear sign operation.
 * @param {string} plaintext The plaintext.
 * @param {!e2e.openpgp.packet.SurrogateSecretKey} key The key to sign the
 *     message with.
 * @private
 * @return {!goog.Thenable.<!e2e.openpgp.ClearSignMessage>}
 */
e2e.openpgp.Context2Impl.prototype.clearSign_ = function(
    plaintext, key) {
  return e2e.openpgp.ClearSignMessage.construct(plaintext, key);
};


/**
 * Internal implementation of the byte sign operation.
 * @param {!e2e.ByteArray|string} plaintext The plaintext.
 * @param {!Array<!e2e.openpgp.packet.SurrogateSecretKey>} sigKeys The keys to
 *     sign the message with.
 * @private
 * @return {!goog.Thenable<!e2e.openpgp.block.Message>}
 */
e2e.openpgp.Context2Impl.prototype.byteSign_ = function(
    plaintext, sigKeys) {
  var msg = e2e.openpgp.block.LiteralMessage.construct(plaintext);
  goog.asserts.assert(sigKeys.length <= 1);
  var sigKey = sigKeys[0];
  if (!sigKey) {
    throw new e2e.openpgp.error.InvalidArgumentsError('Invalid signing key.');
  }
  return msg.signWithOnePass(sigKey).then(function() {
    return msg;
  });
};


/**
 * Encodes the encrypted and/or signed message for output.
 * @param  {!e2e.openpgp.Context2Impl.EncodableMessage_} message
 *     The message to encode.
 * @return {!e2e.ByteArray|string} The message, optionally armored.
 * @private
 */
e2e.openpgp.Context2Impl.prototype.encodeMessage_ = function(message) {
  // Special encoding for clearsigned messages (they are not block.Message)
  if (message instanceof e2e.openpgp.ClearSignMessage) {
    if (this.armorOutput_) {
      return e2e.openpgp.asciiArmor.encodeClearSign(
          message, this.armorHeaders_);
    }
    // Convert to literal message to output a byte serialization.
    message = message.toLiteralMessage();
  }
  var bytes = message.serialize();
  if (this.armorOutput_) {
    return e2e.openpgp.asciiArmor.encode(
        'MESSAGE', goog.asserts.assertArray(bytes),
        this.armorHeaders_);
  }
  return bytes;
};


/** @override */
e2e.openpgp.Context2Impl.prototype.verifyDecrypt = function(encryptedMessage,
    passphraseCallback, opt_decryptionKeys, opt_verificationKeys) {
  // TODO(koto): implement.
  return goog.Promise.resolve(/** @type {!e2e.openpgp.VerifiedDecrypt} */ ({
    decrypt: {
      data: e2e.stringToByteArray('DUMMY DECRYPTION'),
      options: {filename: '', creationTime: 0, charset: 'utf-8'},
      wasEncrypted: false
    },
    verify: null
  }));
};


/** @override */
e2e.openpgp.Context2Impl.prototype.getAllKeysByEmail = function(email) {
  return this.keyManager_.getAllKeysByEmail(email);
};


/** @override */
e2e.openpgp.Context2Impl.prototype.removeKeys = function(keys) {
  return this.keyManager_.removeKeys(keys);
};


/**
 * @private
 * @param {string} text String with one or more armor messages.
 * @return {!e2e.ByteArray} Serialized keys
 */
e2e.openpgp.Context2Impl.prototype.extractByteArrayFromArmorText_ = function(
    text) {
  var messages = e2e.openpgp.asciiArmor.parseAll(text);
  var bytes = [];
  goog.array.forEach(messages, function(armor) {
    goog.array.extend(bytes, armor.data);
  });
  return bytes;
};