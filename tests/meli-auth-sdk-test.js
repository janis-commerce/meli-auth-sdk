'use strict';

const Settings = require('@janiscommerce/settings');
const MicroServiceCall = require('@janiscommerce/microservice-call');
const KmsEncryption = require('@janiscommerce/kms-encryption');
const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const MeliAuthSdk = require('./../lib/meli-auth-sdk');
const MeliAuthSdkError = require('./../lib/meli-auth-sdk-error');

describe('MeliAuthSdk', () => {

	beforeEach(() => {
		this.keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		this.stubSettingsGet = sandbox.stub(Settings, 'get').returns(this.keyArn);
		this.stubMscallGet = sandbox.stub(MicroServiceCall.prototype, 'get');
		this.stubKms = sandbox.stub(KmsEncryption.prototype, 'decrypt');
		this.getAccessToken = async () => MeliAuthSdk.getAccessToken('test', '12345');
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('Should throw error for invalid clientName', () => {
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.INVALID_CLIENT_NAME
		});
	});

	it('Should throw error for invalid sellerId', () => {
		assert.rejects(MeliAuthSdk.getAccessToken('test'), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.INVALID_SELLER_ID
		});
	});

	it('Should get keyArn from settings', () => {
		// eslint-disable-next-line no-underscore-dangle
		assert.deepStrictEqual(MeliAuthSdk._getKmsArn(), this.keyArn);
	});

	it('Should get an error when keyArn not exists in settings', () => {
		this.stubSettingsGet.returns(null);
		// eslint-disable-next-line no-underscore-dangle
		assert.throws(() => { MeliAuthSdk._getKmsArn(); }, {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.ARN_NOT_FOUND
		});
	});

	it('Should return a token string', async () => {
		const msResponse = {
			statusCode: 200,
			body: {
				credentials: 'validcredentialencrypted-xxxsefweijio',
				expiresIn: '01-01-2019'
			}
		};
		const kmsResponse = {
			accessToken: 'testresulttoken'
		};

		const response = {
			accessToken: kmsResponse.accessToken,
			expiresIn: msResponse.body.expiresIn
		};

		this.stubMscallGet.resolves(msResponse);
		this.stubKms.resolves(kmsResponse);

		assert.deepEqual(await this.getAccessToken(), response);
	});

	it('Should fail ms request when status code is 200 and no response body', async () => {
		const msResponse = {
			statusCode: 200
		};

		this.stubMscallGet.resolves(msResponse);
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});
	});

	it('Should fail ms request when status code not 200', async () => {
		const msResponse = {
			statusCode: 403,
			body: {}
		};

		this.stubMscallGet.resolves(msResponse);
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});
	});

	it('Should fail ms request when ms call throws an error', async () => {
		const error = new Error('Random error');
		this.stubMscallGet.rejects(error);

		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});
	});

	it('Should fail for no credentials in response', async () => {
		const msResponse = {
			statusCode: 200,
			body: {}
		};
		this.stubMscallGet.resolves(msResponse);

		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND
		});

		assert.rejects(MeliAuthSdk.getAccessToken('test', '123'), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND,
			message: 'No credentials found for seller: 123'
		});
	});

	it('Should fail for no expiration date in response', async () => {
		const msResponse = {
			statusCode: 200,
			body: {
				credentials: 'testing-testing-testing'
			}
		};
		this.stubMscallGet.resolves(msResponse);

		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.MALFORMED_RESPONSE
		});
	});

	it('Should fail for no token in decrypted data', async () => {
		const msResponse = {
			statusCode: 200,
			body: {
				credentials: 'validcredentialencrypted-xxxsefweijio',
				expiresIn: '01-01-2019',
				seller: 1234566
			}
		};
		const kmsResponse = {
			something: ''
		};

		this.stubMscallGet.resolves(msResponse);
		this.stubKms.resolves(kmsResponse);

		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND
		});

		assert.rejects(MeliAuthSdk.getAccessToken('test', '1234566'), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND,
			message: 'No token found for seller: 1234566'
		});

		this.stubKms.resolves(null);
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND
		});

		this.stubKms.rejects('Rejection test');
		assert.rejects(this.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND
		});
	});

	it('Should fail kms decrypt function', async () => {
		this.stubKms.rejects(new Error('Rejection test'));
		const kms = new KmsEncryption({ keyArn: this.keyArn });
		assert.rejects(kms.decrypt(), {
			name: 'Error',
			message: 'Rejection test'
		});
	});

});
