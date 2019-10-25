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
	 * Resolves the calls to ms meli-auth and decrypt the response
	 * @static
	 * @param {*} clientName Janis client name
	 * @param {*} sellerId Seller id of Meli
	 * @returns {string} Meli access token
	 */
	static async getAccessToken(clientName, sellerId) {
		const keyArn = this._getKmsArn();

		const headers = {
			'janis-client': clientName
		};

		const service = new MicroServiceCall();
		const response = await service.get('meli-auth', 'credential', 'get', null, headers, { seller: sellerId });

		if(!response.body || response.statusCode !== 200) {
			throw new MeliAuthSdkError('Remote request to Mercadolibre authorization service failed',
				MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL);
		}
		if(!response.body.credentials) {
			throw new MeliAuthSdkError(`No credentials found for seller: ${sellerId}`,
				MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND);
		}

		const kmsEncryption = new KmsEncryption({ keyArn });
		const decrypt = await kmsEncryption.decrypt(response.body.credentials);

		if(!decrypt || !decrypt.accessToken) {
			throw new MeliAuthSdkError(`No token found for seller: ${sellerId}`,
				MeliAuthSdkError.codes.TOKEN_NOT_FOUND);
		}

		return decrypt.accessToken;
	}
}

module.exports = MeliAuthSdk;
