const fs = require("fs")
const Mustache = require('mustache')
const http = require('axios')
const aws4 = require('aws4')
const URL = require('url')
const { metricScope, Unit } = require("aws-embedded-metrics");
const Log = require('@dazn/lambda-powertools-logger')
const AWSXRay = require('aws-xray-sdk-core')
AWSXRay.captureHTTPsGlobal(require('https'))

const restaurantsApiRoot = process.env.restaurants_api
const ordersApiRoot = process.env.orders_api
const cognitoUserPoolId = process.env.cognito_user_pool_id
const cognitoClientId = process.env.cognito_client_id
const awsRegion = process.env.AWS_REGION

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const template = fs.readFileSync('static/index.html', 'utf-8')

const getRestaurants = async () => {
  Log.debug('getting restaurants...', { url: restaurantsApiRoot });
  const url = URL.parse(restaurantsApiRoot)
  const opts = {
    host: url.hostname,
    path: url.pathname
  }

  aws4.sign(opts)

  const httpReq = http.get(restaurantsApiRoot, {
    headers: opts.headers
  })
  return (await httpReq).data
}

module.exports.handler =  metricScope(metrics => async (event, context) => {

  metrics.setNamespace('GetRestaurantLambda')
  metrics.putDimensions({ Service: "lambda-get-restaurants"})

  const start = Date.now()
  const restaurants = await getRestaurants()
  const end = Date.now()

  metrics.putMetric("latency", end - start, Unit.Milliseconds)
  metrics.putMetric("count", restaurants.length, Unit.Count)
  // metrics.setProperty("RequestId", context.awsRequestId)
  // metrics.setProperty("ApiGatewayRequestId", event.requestContext.requestId)

  Log.debug('got restaurants', { count: restaurants.length }) 
  const dayOfWeek = days[new Date().getDay()]
  const view = {
    awsRegion,
    cognitoUserPoolId,
    cognitoClientId,
    dayOfWeek,
    restaurants,
    searchUrl: `${restaurantsApiRoot}/search`,
    placeOrderUrl: ordersApiRoot
  }
  const html = Mustache.render(template, view)
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8'
    },
    body: html
  }

  return response
})