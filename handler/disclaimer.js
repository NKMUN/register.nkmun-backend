'use strict'

const DISCLAIMER = require('../def/disclaimer')

module.exports = {
    Get: function* Handler_GetDisclaimer() {
        this.status = 200
        this.body = DISCLAIMER
    }
}