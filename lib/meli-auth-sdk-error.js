'use strict';

class MeliAuthSdkError extends Error {

	static get codes() {

		return {
			ARN_NOT_FOUND: 1,
			CREDENTIALS_NOT_FOUND: 2,
			REMOTE_REQUEST_FAIL: 3,
			TOKEN_NOT_FOUND: 4,
			INVALID_CLIENT_NAME: 5,
			INVALID_SELLER_ID: 6
		};

	}

	constructor(err, code) {
		super(err);
		this.message = err.message || err;
		this.code = code;
		this.name = 'MeliAuthSdkError';
	}
}

module.exports = MeliAuthSdkError;
