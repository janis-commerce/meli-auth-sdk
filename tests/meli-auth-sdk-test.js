'use strict';

const Settings = require('@janiscommerce/settings');
const MicroServiceCall = require('@janiscommerce/microservice-call');
const KmsEncryption = require('@janiscommerce/kms-encryption');
const assert = require('assert');
const sinon = require('sinon');
const MeliAuthSdk = require('./../index');
const MeliAuthSdkError = require('./../lib/meli-auth-sdk-error');


describe('MeliAuthSdk', () => {
	it('Should get keyArn from settings', () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		const stub = sinon.stub(Settings, 'get').returns(keyArn);
		// eslint-disable-next-line no-underscore-dangle
		assert.deepEqual(MeliAuthSdk._getKmsArn(), keyArn);
		stub.restore();
	});

	it('Should get an error when keyArn not exists in settings', () => {
		const keyArn = null;
		const stub = sinon.stub(Settings, 'get').returns(keyArn);
		// eslint-disable-next-line no-underscore-dangle
		assert.throws(() => { MeliAuthSdk._getKmsArn(); }, {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.ARN_NOT_FOUND
		});
		stub.restore();
	});

	it('Should return a token string', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';

		const msResponse = {
			statusCode: 200,
			body: {
				credentials: 'validcredentialencrypted-xxxsefweijio'
			}
		};
		const kmsResponse = {
			accessToken: 'testresulttoken'
		};

		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);
		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').resolves(msResponse);
		const stubKms = sinon.stub(KmsEncryption.prototype, 'decrypt').returns(kmsResponse);

		assert.deepEqual(await MeliAuthSdk.getAccessToken(), kmsResponse.accessToken);

		stubKms.restore();
		stubMs.restore();
		stubKeyArn.restore();
	});

	it('Should fail ms request when status code is 200 and no response body', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);

		const msResponse = {
			statusCode: 200
		};

		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').resolves(msResponse);
		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});

		stubMs.restore();
		stubKeyArn.restore();
	});

	it('Should fail ms request when status code not 200', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);

		const msResponse = {
			statusCode: 403,
			body: {}
		};

		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').resolves(msResponse);
		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});

		stubMs.restore();
		stubKeyArn.restore();
	});

	it('Should fail ms request when ms call throws an error', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);

		const error = new Error('Random error');
		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').rejects(error);

		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.REMOTE_REQUEST_FAIL
		});

		stubMs.restore();
		stubKeyArn.restore();
	});

	it('Should fail for no credentials in response', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';
		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);

		const msResponse = {
			statusCode: 200,
			body: {}
		};
		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').resolves(msResponse);

		// eslint-disable-next-line no-underscore-dangle
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND
		});

		assert.rejects(MeliAuthSdk.getAccessToken('test', '123'), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.CREDENTIALS_NOT_FOUND,
			message: 'No credentials found for seller: 123'
		});

		stubMs.restore();
		stubKeyArn.restore();
	});

	it('Should fail for no token in decrypted data', async () => {
		const keyArn = 'arn:aws:kms:us-east-1:026813942644:key/XXXXXXXX-XXXX-XXXX-XXXX-123456789876';

		const msResponse = {
			statusCode: 200,
			body: {
				credentials: 'validcredentialencrypted-xxxsefweijio'
			}
		};
		const kmsResponse = {
			something: ''
		};

		const stubKeyArn = sinon.stub(MeliAuthSdk, '_getKmsArn').returns(keyArn);
		const stubMs = sinon.stub(MicroServiceCall.prototype, 'get').resolves(msResponse);
		let stubKms = sinon.stub(KmsEncryption.prototype, 'decrypt').returns(kmsResponse);

		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND
		});

		assert.rejects(MeliAuthSdk.getAccessToken('test', '123'), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND,
			message: 'No token found for seller: 123'
		});
		stubKms.restore();

		stubKms = sinon.stub(KmsEncryption.prototype, 'decrypt').returns(null);
		assert.rejects(MeliAuthSdk.getAccessToken(), {
			name: 'MeliAuthSdkError',
			code: MeliAuthSdkError.codes.TOKEN_NOT_FOUND
		});

		stubMs.restore();
		stubKeyArn.restore();
	});

});
