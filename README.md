# meli-auth-sdk
[![Build Status](https://travis-ci.org/janis-commerce/meli-auth-sdk.svg?branch=master)](https://travis-ci.org/janis-commerce/meli-auth-sdk) [![Coverage Status](https://coveralls.io/repos/github/janis-commerce/meli-auth-sdk/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/meli-auth-sdk?branch=master)

Utilities for a simpler way to integrate serverless microservices with meli-auth service

## Installation

```sh
npm install @janiscommerce/meli-auth-sdk
```

## API
#### Methods
-   _async_  getAccessTokent(clientName, sellerId)
	|  Option     |  Type  |  Description  |
	|  ---------- | ------ | ------------- |
	|  clientName | string | Janis client name |
	|  sellerId   | string | Seller/User ID of MercadoLibre |
	|  **returns**| MeliToken | MercadoLibre authorization object |

#### Types
-   MeliToken
	|  Property    |  Type  |  Description  |
	|  ----------- | ------ | ------------- |
	|  accessToken | string | Mercadolibre access token |
	|  expiresIn   | string | Token expiration date in ISO 8601 format |

## Usage

```js
const MeliAuthSdk = require('@janiscommerce/meli-auth-sdk');
```

## Examples
```js
'use strict';

const { API } = require('@janiscommerce/api');
const MeliAuthSdk = require('@janiscommerce/meli-auth-sdk');
const requestPromise = require('request-promise');

class ExampleApi extends API {

	async process() {
		const orderId = '123455'
		const { accessToken, expiresIn } = await MeliAuthSdk.getAccessToken('test', '1234554');
		const response = await requestPromise({
			method: 'POST',
			uri: `https://api.mercadolibre.com/orders/${orderId}?access_token=${accessToken}`
			json: true
		});
		this.setBody({ response });
	}
}

module.exports = ExampleApi;
```
