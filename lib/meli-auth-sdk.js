'use strict';

const MicroServiceCall = require('@janiscommerce/microservice-call');
const KmsEncryption = require('@janiscommerce/kms-encryption');
const Settings = require('@janiscommerce/settings');
const MeliAuthSdkError = require('./meli-auth-sdk-error');

const KMS_ARN = 'kmsArn';

class MeliAuthSdk {

	static get kmsArnField() {
		return KMS_ARN;
	}

	/**
	 * Gets the KMS ARN from config file
	 * @returns {string} The kms arn
	 */
	static _getKmsArn() {
		const keyArn = Settings.get(MeliAuthSdk.kmsArnField);
		if(!keyArn) {
			throw new MeliAuthSdkError(
				`Missing kms config setting '${MeliAuthSdk.kmsArnField}'`,
				MeliAuthSdkError.codes.ARN_NOT_FOUND
			);
		}
		return keyArn;
	}

	/**
	 * @typedef {Object} MeliAuthCredentials
	 * @property {string} accessToken - Mercadolibre access token
	 * @property {string} refreshToken - Token used to get new access token
	 */

	/**
	 * @typedef {Object} MeliAuthResponse
	 * @property {number} seller - Mercadolibre seller id
	 * @property {string} credentials - Kms encrypted data
	 * @property {expiresIn} credentials - Token expiration date in ISO 8601 format
	 */

	/**
	 * Decrypts credentials string returned by ms meli-auth
	 * @static
	 * @param {string} keyArn KMS key used to decrypt
	 * @param {MeliAuthResponse} meliAuthResponse Response from ms meli-auth
	 * @returns {MeliAuthCredentials} Decrypted Mercadolibre credentials
	 */
	static async _kmsDecrypt(keyArn, meliAuthResponse) {
		const kmsEncryption = new KmsEncryption({ keyArn });
		const decrypt = {};
		try {
			decrypt.result = await kmsEncryption.decrypt(meliAuthResponse.credentials);
		} catch(kmsException) {
			decrypt.error = kmsException.message;
		}

		if(decrypt.error || !decrypt.result || !decrypt.result.accessToken) {
			throw new MeliAuthSdkError(`No token found for seller: ${meliAuthResponse.seller.toString()}`,
				MeliAuthSdkError.codes.TOKEN_NOT_FOUND);
		}

		return decrypt.result;
	}

	/**
	 * Requester to ms meli-auth
	 * @static
	 * @param {string} clientName Janis client name
	 * @param {string} sellerId Seller id of Mercadolibre
	 * @returns {MeliAuthResponse} Decrypted Mercadolibre credentials
	 */
	static async _msMeliAuthCall(clientName, sellerId) {
		const headers = {
			'janis-client': clientName
		};

		const service = new MicroServiceCall();
		const msCall = {};
		try {
			msCall.response = await service.get('meli-auth', 'credential', 'get', null, headers, { seller: sellerId });
		} catch(msException) {
			msCall.error = msException.message;
		}

		if(msCall.error || !msCall.response.body || msCall.response.statusCode !== 200) {
			throw new MeliAuthSdkError('Remote request to Mercadolibre authorization service failed -> ' + msCall.error,
				MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL);
		}
		if(!msCall.response.body.credentials) {
			throw new MeliAuthSdkError(`No credentials found for seller: ${sellerId}`,
				MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND);
		}

		if(!msCall.response.body.expiresIn) {
			throw new MeliAuthSdkError('Malformed response from Mercadolibre authorization service',
				MeliAuthSdkError.codes.MALFORMED_RESPONSE);
		}

		return msCall.response.body;
	}

	/**
	 * @typedef {Object} MeliToken
	 * @property {string} accessToken - Mercadolibre access token
	 * @property {string} expiresIn - Token expiration date in ISO 8601 format
	 */

	/**
	 * Resolves the calls to ms meli-auth and decrypt the response
	 * @static
	 * @param {string} clientName Janis client name
	 * @param {string} sellerId Seller id of Mercadolibre
	 * @returns {MeliToken} Mercadolibre access token
	 */
	static async getAccessToken(clientName, sellerId) {
		if(!clientName)
			throw new MeliAuthSdkError('Invalid clientName', MeliAuthSdkError.codes.INVALID_CLIENT_NAME);

		if(!sellerId)
			throw new MeliAuthSdkError('Invalid sellerId', MeliAuthSdkError.codes.INVALID_SELLER_ID);

		const keyArn = this._getKmsArn();

		const msCall = await this._msMeliAuthCall(clientName, sellerId);

		const decryptedCredentials = await this._kmsDecrypt(keyArn, msCall);

		return {
			accessToken: decryptedCredentials.accessToken,
			expiresIn: msCall.expiresIn
		};
	}
}

module.exports = MeliAuthSdk;
