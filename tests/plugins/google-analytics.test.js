const test = require('ava')
const {GaApi} = require('../../plugins/google-analytics/api')
const mocks = require('../../fixtures')


mocks.initMocks()

let gaApi = new GaApi()
gaApi.jwt = "some test string"

test('ga api get works', async t => {
  t.plan(2)

  const params = {
    'start-date': '30daysAgo',
    'end-date': 'today',
    'sort': '-ga:uniquePageviews',
    'dimensions': 'ga:pagePathLevel2',
    'metrics': 'ga:uniquePageviews',
    'max-results': 30,
    'filters': 'ga:pagePathLevel1==/dataset/'
  }

  const result = await gaApi.get(params)

  console.log(result)

  t.is(result.status, 200)
  t.is(result.data.totalResults, 109)
})