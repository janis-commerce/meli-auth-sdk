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
	 * @typedef {Object} MeliToken
	 * @property {string} accessToken - Mercadolibre access token
	 * @property {string} expiresIn - Token expiration date in ISO 8601 format
	 */

	/**
	 * Resolves the calls to ms meli-auth and decrypt the response
	 * @static
	 * @param {string} clientName Janis client name
	 * @param {string} sellerId Seller id of Meli
	 * @returns {MeliToken} Meli access token
	 */
	static async getAccessToken(clientName, sellerId) {
		if(!clientName)
			throw new MeliAuthSdkError('Invalid clientName', MeliAuthSdkError.codes.INVALID_CLIENT_NAME);

		if(!sellerId)
			throw new MeliAuthSdkError('Invalid sellerId', MeliAuthSdkError.codes.INVALID_SELLER_ID);

		const keyArn = this._getKmsArn();

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

		const kmsEncryption = new KmsEncryption({ keyArn });
		const decrypt = {};
		try {
			decrypt.result = await kmsEncryption.decrypt(msCall.response.body.credentials);
		} catch(kmsException) {
			decrypt.error = kmsException.message;
		}

		if(decrypt.error || !decrypt.result || !decrypt.result.accessToken) {
			throw new MeliAuthSdkError(`No token found for seller: ${sellerId}`,
				MeliAuthSdkError.codes.TOKEN_NOT_FOUND);
		}

		return {
			accessToken: decrypt.result.accessToken,
			expiresIn: msCall.response.body.expiresIn
		};
	}
}

module.exports = MeliAuthSdk;
