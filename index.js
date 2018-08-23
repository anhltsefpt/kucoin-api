'use strict'

const clients = require('restify-clients')
const crypto = require('crypto')
const Q = require('q')

/**
 * A Node.js client for the KuCoin API.
 * @class
 * @version 0.0.2
 * @param {string} apiKey Your KuCoin API Key.
 * @param {string} apiSecret Your KuCoin API Secret.
 * @example
 * let kc = new Kucoin();
 */
class Kucoin {

  /**
   * You'll need to provide your KuCoin API key and secret.
   * @param {string} apiKey Your KuCoin API Key.
   * @param {string} apiSecret Your KuCoin API Secret.
   */
  constructor(apiKey, apiSecret) {
    this._apiKey = apiKey
    this._apiSecret = apiSecret
    this.client = clients.createJsonClient({
      url: 'https://api.kucoin.com'
    })
    this.path_prefix = '/v1'
  }

  /**
   * Send the request to the KuCoin API, sign if authorisation is required.
   * @access private
   * @param {string} method HTTP request method, either 'get' or 'post'.
   * @param {string} endpoint API endpoint URL suffix.
   * @param {boolean} [signed=false] Whether this endpoint requires authentiation.
   * @param {Object} params Any parameters for the request.
   * @return {Promise} An object containing the API response.
   */
  rawRequest(method, endpoint, signed = false, params) {
    let deferred = Q.defer()
    let path = this.path_prefix + endpoint
    let nonce = new Date().getTime()
    let queryString
    if (params !== undefined) {
      queryString = [];
      for (let key in params) {
        queryString.push(key + '=' + params[key])
      }
      queryString.sort()
      queryString = queryString.join('&')
    } else {
      queryString = ''
    }
    let options = {
      path: path + (queryString ? '?' + queryString : ''),
      headers: {}
    }
    if (signed) {
      options.headers = {
        'Content-Type': 'application/json',
        'KC-API-KEY': this._apiKey,
        'KC-API-NONCE': nonce,
        'KC-API-SIGNATURE': this.getSignature(path, queryString, nonce)
      }
    } else {
      options.headers = {
        'Content-Type': 'application/json'
      }
    }
    if (method == 'post') {
      this.client.post(options, {}, (err, req, res, obj) => {
        if (err || !obj.success) {
          if (!err && !obj.success) {
            err = obj
          }
          deferred.reject(err)
        } else {
          deferred.resolve(obj)
        }
      })
    } else {
      this.client.get(options, (err, req, res, obj) => {
        if (err || !obj.success) {
          if (!err && !obj.success) {
            err = obj
          }
          deferred.reject(err)
        } else {
          deferred.resolve(obj)
        }
      })
    }
    return deferred.promise
  }

  /**
   * Generate a signature to sign API requests that require authorisation.
   * @access private
   * @param {string} path API endpoint URL suffix.
   * @param {string} queryString A querystring of parameters for the request.
   * @param {number} nonce Number of milliseconds since the Unix epoch.
   * @return {string} A string to be used as the authorisation signature.
   */
  getSignature(path, queryString, nonce) {
    let strForSign = path + '/' + nonce + '/' + queryString
    let signatureStr = new Buffer(strForSign).toString('base64')
    let signatureResult = crypto.createHmac('sha256', this._apiSecret)
      .update(signatureStr)
      .digest('hex')
    return signatureResult
  }

  /**
   * Do a standard public request.
   * @access private
   * @param {string} method HTTP request method, either 'get' or 'post'.
   * @param {string} endpoint API endpoint URL suffix.
   * @param {Object} params Any parameters for the request.
   * @return {Promise} An object containing the API response.
   */
  doRequest(method, endpoint, params) {
    return this.rawRequest(method, endpoint, false, params)
  }

  /**
   * Do a signed private request.
   * @access private
   * @param {string} method HTTP request method, either 'get' or 'post'.
   * @param {string} endpoint API endpoint URL suffix.
   * @param {Object} params Any parameters for the request.
   * @return {Promise} An object containing the API response.
   */
  doSignedRequest(method, endpoint, params) {
    return this.rawRequest(method, endpoint, true, params)
  }
  /**
   * Retrieve deposit and withdrawal record history.
   * @access public
   * @param {{symbol: string, type: string, status: string, limit: number, page: number}} params Record details including the coin's symbol, type, status, limit, and page number for the records.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getDepositAndWithdrawalRecords({
   *   symbol: 'GAS'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509591779228,
   *   "data": {
   *     "total": 2,
   *     "firstPage": true,
   *     "lastPage": false,
   *     "datas": [{
   *       "coinType": "GAS",
   *       "createdAt": 1509540909000,
   *       "amount": 0.1117,
   *       "address": "Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
   *       "fee": 0,
   *       "outerWalletTxid": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@gas",
   *       "remark": null,
   *       "oid": "xxxxxxxxxxxxxxxxxxxxxxxx",
   *       "confirmation": 7,
   *       "type": "DEPOSIT",
   *       "status": "SUCCESS",
   *       "updatedAt": 1509541029000
   *     }, {
   *       "coinType": "GAS",
   *       "createdAt": 1509358609000,
   *       "amount": 1.1249,
   *       "address": "Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
   *       "fee": 0,
   *       "outerWalletTxid": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@gas",
   *       "remark": null,
   *       "oid": "xxxxxxxxxxxxxxxxxxxxxxxx",
   *       "confirmation": 6,
   *       "type": "DEPOSIT",
   *       "status": "SUCCESS",
   *       "updatedAt": 1509358729000
   *     }],
   *     "currPageNo": 1,
   *     "limit": 12,
   *     "pageNos": 1
   *   }
   * }
   */
  getDepositAndWithdrawalRecords(params = {}) {
    return this.doSignedRequest('get', '/account/' + params.symbol + '/wallet/records', params)
  }

  getDepositsByCurrency(currency) {
    return this.getDepositAndWithdrawalRecords({symbol : currency, type: 'WITHDRAW', status: 'FINISHED'})
  }

  getListDeposits(listCurrencies) {
    const depositTasks = []
    listCurrencies.forEach((currency) => {
      depositTasks.push(( async () => {
        const depositByCurrency = await this.getDepositsByCurrency(currency)
        return depositByCurrency
      })())
    })

    return depositTasks
  }

  getWithdrawByCurrency(currency) {
    return this.getDepositAndWithdrawalRecords({symbol : currency, type: 'WITHDRAW', status: 'FINISHED'})
  }

  getListWithdraws(listCurrencies) {
    const withdrawTasks = []
    listCurrencies.forEach((currency) => {
      withdrawTasks.push((async () => {
        const withdrawByCurrency = await this.getWithdrawByCurrency(currency)
        return withdrawByCurrency
      })())
    })

    return withdrawTasks
  }

  getOrderHistoryByCurrency(pair) {
    return this.getDealtOrders({pair}) 
  }

  getOrderHistories(listPairs) {
    const orderHistoryTasks = []
    listPairs.forEach((pair) => {
      orderHistoryTasks.push((async () => {
        const orderHistoryByCurrency = await this.getOrderHistoryByCurrency(pair)
        return orderHistoryByCurrency 
      })())
    })

    return orderHistoryTasks
  }

  /**
   * Retrieve balance for a particular coin.
   * @access public
   * @param {{symbol: string}} [params] The coin's symbol for the balance you want to retrieve.
   * @return {Promise} An object containing the API response.
   * @example <caption>Retrieve the balance for NEO:</caption>
   * kc.getBalance({
   *   symbol: 'NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592077557,
   *   "data": {
   *     "coinType": "NEO",
   *     "balanceStr": "10.72040467",
   *     "freezeBalance": 0,
   *     "balance": 10.72040467,
   *     "freezeBalanceStr": "0.0"
   *   }
   * }
   * @example <caption>Retrieve the balance for all coins (including zero balances):</caption>
   * kc.getBalance().then(console.log).catch(console.error)
   */
  getBalance(params = {}) {
    return this.doSignedRequest('get', '/account/' + (params.symbol ? params.symbol + '/' : '') + 'balance')
  }

  /**
   * Create an order for the specified trading pair.
   * @access public
   * @param {{pair: string, amount: number, price: number, type: string}} params Order details including the trading pair, amount, price, and type of order.
   * @return {Promise} An object containing the API response.
   * @example <caption>Create an order to sell 5 GAS for NEO at the specified price:</caption>
   * kc.createWithdrawal({
   *   pair: 'GAS-NEO',
   *   amount: 5,
   *   price: 0.608004
   *   type: 'SELL'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   success: true,
   *   code: 'OK',
   *   msg: 'OK',
   *   timestamp: 1509592202904,
   *   data: {
   *     orderOid: 'xxxxxxxxxxxxxxxxxxxxxxxx'
   *   }
   * }
   */
  createOrder(params = {}) {
    params.symbol = params.pair
    return this.doSignedRequest('post', '/order', params)
  }

  /**
   * View a list of active orders for the specified trading pair
   * @access public
   * @param {{pair: string}} params The trading pair to retrieve orders for.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getActiveOrders({
   *   pair: 'GAS-NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592278263,
   *   "data": {
   *     "SELL": [[1509592203000, "SELL", 1, 0.11206064, 0, "xxxxxxxxxxxxxxxxxxxxxxxx"]],
   *     "BUY": []
   *   }
   * }
   */
  getActiveOrders(params = {}) {
    params.symbol = params.pair
    return this.doSignedRequest('get', '/' + params.pair + '/order/active', params)
  }

  /**
   * Cancel an order for the specified trading pair.
   * @access public
   * @param {{pair: string, txOid: string}} params Order details including the trading pair and transaction ID for the order.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.cancelOrder({
   *   pair: 'GAS-NEO',
   *   txOid: '59fa71673b7468701cd714a1'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   success: true,
   *   code: 'OK',
   *   msg: 'Operation succeeded.',
   *   timestamp: 1509592278426,
   *   data: null
   * }
   */
  cancelOrder(params = {}) {
    params.symbol = params.pair
    return this.doSignedRequest('post', '/cancel-order', params)
  }

  /**
   * Retrieve a list of completed orders for the specified trading pair.
   * @access public
   * @param {{pair: string, type: string, limit: number, page: number}} params Order details including the trading pair, type, limit, and page number for the orders.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getDealtOrders({
   *   pair: 'GAS-NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592427203,
   *   "data": {
   *     "total": 1,
   *     "firstPage": true,
   *     "lastPage": false,
   *     "datas": [{
   *       "coinType": "GAS",
   *       "createdAt": 1509455416000,
   *       "amount": 0.14494322,
   *       "dealValue": 0.0929086,
   *       "fee": 0.00009291,
   *       "dealDirection": "SELL",
   *       "coinTypePair": "NEO",
   *       "oid": "xxxxxxxxxxxxxxxxxxxxxxxx",
   *       "dealPrice": 0.641,
   *       "orderOid": "xxxxxxxxxxxxxxxxxxxxxxxx",
   *       "feeRate": 0.001,
   *       "direction": "SELL"
   *     }],
   *     "currPageNo": 1,
   *     "limit": 12,
   *     "pageNos": 1
   *   }
   * }
   */
  getDealtOrders(params = {}) {
    params.symbol = params.pair
    return this.doSignedRequest('get', '/' + params.pair + '/deal-orders', params)
  }

  /**
   * Retrieve current price ticker data for the specified trading pair.
   * @access public
   * @param {{pair: string}} params The trading pair to retrieve price ticker for.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getTicker({
   *   pair: 'GAS-NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592566746,
   *   "data": {
   *     "coinType": "GAS",
   *     "trading": true,
   *     "symbol": "GAS-NEO",
   *     "lastDealPrice": 0.627999,
   *     "buy": 0.608004,
   *     "sell": 0.628,
   *     "change": 0.019994,
   *     "coinTypePair": "NEO",
   *     "sort": 0,
   *     "feeRate": 0.001,
   *     "volValue": 5246.36133161,
   *     "high": 0.635,
   *     "datetime": 1509592566000,
   *     "vol": 8499.38951847,
   *     "low": 0.601101,
   *     "changeRate": 0.0329
   *   }
   * }
   */
  getTicker(params = {}) {
    return this.doRequest('get', '/' + params.pair + '/open/tick')
  }

  /**
   * Retrieve a list of orders for the specified trading pair.
   * @access public
   * @param {{pair: string, type: string, group: number, limit: number}} params Order book details including the trading pair, type, group, and limit for the orders.
   * @return {Promise} An object containing the API response.
   * @example <caption>Retrieve all orders currently on the books for the GAS-NEO trading pair:</caption>
   * kc.getOrderBooks({
   *   pair: 'GAS-NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592645132,
   *   "data": {
   *     "SELL": [[0.628, 227.1374, 142.6422872], [0.632999, 10, 6.32999], [0.633, 4.20740806, 2.6632893], [0.65, 0.6346, 0.41249], [0.6611, 6.7998, 4.49534778], [0.665699, 0.1875, 0.12481856]],
   *     "BUY": [[0.608004, 9.8481, 5.98768419], [0.608003, 21.9264, 13.33131698], [0.608001, 43.8442, 26.65731744], [0.604001, 25.5521, 15.43349395], [0.603, 1.0561, 0.6368283], [0.602006, 25, 15.05015]]
   *   }
   * }
   * @example <caption>Retrieve only SELL orders currently on the books for the GAS-NEO trading pair:</caption>
   * kc.getOrderBooks({
   *   pair: 'GAS-NEO',
   *   type: 'SELL'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592734633,
   *   "data": [[0.628, 227.1374, 142.6422872], [0.632999, 10, 6.32999], [0.633, 4.20740806, 2.6632893], [0.65, 0.6346, 0.41249], [0.6611, 6.7998, 4.49534778], [0.665699, 0.1875, 0.12481856]]
   * }
   */
  getOrderBooks(params = {}) {
    params.symbol = params.pair
    return this.doRequest('get', '/' + params.pair + '/open/orders' + (params.type ? '-' + params.type.toLowerCase() : ''), params)
  }

  /**
   * Retrieve a list of recently completed orders for the specified trading pair.
   * @access public
   * @param {{pair: string, limit: number, since: number}} params Order book details including the trading pair, limit, and since for the orders.
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getRecentlyDealtOrders({
   *   pair: 'GAS-NEO'
   * }).then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592783348,
   *   "data": [[1509591191000, "SELL", 0.608005, 10.771, 6.54882186], [1509591198000, "SELL", 0.608005, 10.7648, 6.54505222], [1509591512000, "SELL", 0.608005, 13.0292, 7.92181875], [1509591714000, "BUY", 0.627999, 19.9774, 12.54578722], [1509591951000, "SELL", 0.608005, 15.6217, 9.49807171], [1509592026000, "SELL", 0.608005, 15.2009, 9.2422232], [1509592105000, "SELL", 0.608005, 13.4969, 8.20618268], [1509592219000, "BUY", 0.627999, 20.9506, 13.15695585], [1509592311000, "BUY", 0.627999, 23.5278, 14.77543487], [1509592724000, "SELL", 0.608005, 8.6837, 5.27973302]]
   * }
   */
  getRecentlyDealtOrders(params = {}) {
    return this.doRequest('get', '/' + params.pair + '/open/deal-orders', params)
  }

  /**
   * Retrieve a list of available trading pairs.
   * @access public
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getTradingSymbols().then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509592839027,
   *   "data": [{
   *     "coinType": "KCS",
   *     "trading": true,
   *     "symbol": "KCS-BTC",
   *     "lastDealPrice": 0.00009277,
   *     "buy": 0.00009003,
   *     "sell": 0.0000927,
   *     "change": -0.00000322,
   *     "coinTypePair": "BTC",
   *     "sort": 0,
   *     "feeRate": 0.001,
   *     "volValue": 139.78123495,
   *     "high": 0.00012281,
   *     "datetime": 1509592836000,
   *     "vol": 1347022.79127505,
   *     "low": 0.0000835,
   *     "changeRate": -0.0335
   *   }, {
   *     ...
   *   }]
   * }
   */
  getTradingSymbols() {
    return this.doRequest('get', '/market/open/symbols')
  }

  /**
   * Retrieve a list of trending trading pairs.
   * @access public
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getTrending().then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509593321973,
   *   "data": [{
   *     "coinPair": "KCS-BTC",
   *     "deals": [[1509591600000, 0.0000928], [1509588000000, 0.00009421], [1509584400000, 0.00009134], [1509580800000, 0.000096], [1509577200000, 0.00010014], [1509573600000, 0.00010293], [1509570000000, 0.00010368], [1509566400000, 0.000107], [1509562800000, 0.00010496], [1509559200000, 0.0001057], [1509555600000, 0.000108], [1509552000000, 0.0001117], [1509548400000, 0.0001142], [1509544800000, 0.000114], [1509541200000, 0.000114], [1509537600000, 0.0001135], [1509534000000, 0.0001135], [1509530400000, 0.0001011], [1509526800000, 0.00010799], [1509523200000, 0.00011405], [1509519600000, 0.0001164], [1509516000000, 0.00012099], [1509512400000, 0.00012107], [1509508800000, 0.00012244], [1509505200000, 0.00012281], [1509501600000, 0.00012295], [1509498000000, 0.00012348], [1509494400000, 0.0001242], [1509490800000, 0.00012895], [1509487200000, 0.00012897], [1509483600000, 0.00012899], [1509480000000, 0.00012849], [1509476400000, 0.00012987], [1509472800000, 0.00013], [1509469200000, 0.00013188], [1509465600000, 0.00012978], [1509462000000, 0.00012978], [1509458400000, 0.000126], [1509454800000, 0.00012978], [1509451200000, 0.00012562], [1509447600000, 0.00012999], [1509444000000, 0.00013009], [1509440400000, 0.0001346], [1509436800000, 0.00013465], [1509433200000, 0.00013465], [1509429600000, 0.00013376], [1509426000000, 0.00013465], [1509422400000, 0.00013457], [1509418800000, 0.00013489], [1509415200000, 0.00013693], [1509411600000, 0.0001329], [1509408000000, 0.00013499], [1509404400000, 0.00013711], [1509400800000, 0.00013723], [1509397200000, 0.00013999], [1509393600000, 0.00013992], [1509390000000, 0.00014195], [1509386400000, 0.00014284], [1509382800000, 0.0001425], [1509379200000, 0.00014286], [1509375600000, 0.00014406], [1509372000000, 0.00014591], [1509368400000, 0.00014647], [1509364800000, 0.0001457], [1509361200000, 0.00014575], [1509357600000, 0.00014659], [1509354000000, 0.00014998], [1509350400000, 0.0001517], [1509346800000, 0.0001488], [1509343200000, 0.0001488], [1509339600000, 0.00014999], [1509336000000, 0.0001521]]
   *   }, {
   *     ...
   *   }]
   * }
   */
  getTrending() {
    return this.doRequest('get', '/market/open/coins-trending')
  }

  /**
   * Retrieve a list of available coins.
   * @access public
   * @return {Promise} An object containing the API response.
   * @example
   * kc.getCoins().then(console.log).catch(console.error)
   * 
   * // Returns:
   * 
   * {
   *   "success": true,
   *   "code": "OK",
   *   "msg": "Operation succeeded.",
   *   "timestamp": 1509593539250,
   *   "data": [{
   *     "withdrawMinFee": 2,
   *     "withdrawMinAmount": 50,
   *     "withdrawFeeRate": 0.001,
   *     "confirmationCount": 12,
   *     "name": "Kucoin Shares",
   *     "tradePrecision": 4,
   *     "enableWithdraw": true,
   *     "enableDeposit": true,
   *     "coin": "KCS"
   *   }, {
   *     ...
   *   }]
   * }
   */
  getCoins() {
    return this.doRequest('get', '/market/open/coins-list')
  }

}

module.exports = Kucoin
