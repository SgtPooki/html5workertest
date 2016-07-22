/* global it,describe,after,Worker,before,navigator,XMLHttpRequest */

import PromiseWorker from 'promise-worker'
import functionToString from 'function-to-string'
import tests from './tests'
import Promise from 'pouchdb-promise'
import UAParser from 'ua-parser-js'

function setupServiceWorker () {
  return navigator.serviceWorker.register('service-worker-bundle.js', {
    scope: './'
  }).then(() => {
    if (navigator.serviceWorker.controller) {
      // already active and controlling this page
      return navigator.serviceWorker
    }
    // wait for a new service worker to control this page
    return new Promise(resolve => {
      function onControllerChange () {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        resolve(navigator.serviceWorker)
      }
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    })
  })
}

describe('html5workertest', function () {
  this.timeout(30000)

  var results = {}

  var testSuites = ['Web Workers']
  if ('serviceWorker' in navigator) {
    testSuites.push('Service Workers')
  }
  testSuites.forEach(testSuite => {
    results[testSuite] = {}

    var worker
    var promiseWorker

    before(() => {
      if (testSuite === 'Service Workers') {
        return setupServiceWorker().then(theWorker => {
          worker = theWorker
          promiseWorker = new PromiseWorker(worker)
        })
      } else {
        worker = new Worker('worker-bundle.js')
        promiseWorker = new PromiseWorker(worker)
      }
    })

    describe(testSuite, function () {
      function runBasicTest (test) {
        return promiseWorker.postMessage({
          test: functionToString(test.func).body
        }).then(passed => {
          results[testSuite][test.name] = passed
        })
      }

      tests.forEach(test => {
        it(test.name, () => {
          return runBasicTest(test)
        })
      })
    })
  })

  function displayResults () {
    var pre = document.createElement('pre')
    pre.style.position = 'absolute'
    pre.style.top = '0'
    pre.style.left = '40%'
    pre.style.background = 'rgba(0, 0, 0, 0.7)'
    pre.style.color = '#fafafa'
    pre.style.padding = '40px'
    pre.innerHTML = JSON.stringify(results, null, '  ')
    document.body.appendChild(pre)
  }

  function postResults () {
    var ua = new UAParser().getResult()
    var jsonToPost = {
      _id: new Date().toISOString(),
      ua: ua,
      results: results,
      group: process.env.TRAVIS_BUILD_NUMBER || 0,
      version: 1
    }

    // non-standard; I forked zuul to add this behavior
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest()
      xhr.open('POST', '/__zuul/results')
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
          resolve()
        }
      }
      xhr.onerror = reject
      xhr.send(JSON.stringify(jsonToPost))
    })
  }

  after(() => {
    displayResults()

    if (typeof process.env.COUCH_URL !== 'undefined') {
      return postResults()
    }
  })
})
