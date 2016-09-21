'use strict'

const shortid = require('shortid')

module.exports = function generateInvitationCode() {
    return shortid.generate()
}