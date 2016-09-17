'use strict'

const {pbkdf2Sync, randomBytes} = require('crypto')
const ROUNDS = 20000
const LENGTH = 256
const DIGEST = 'sha256'

function getSalt(bytes = 12) {
    return randomBytes(bytes)
}

function derive(password) {
    let salt = getSalt()
    let hash = pbkdf2Sync(password, salt, ROUNDS, LENGTH, DIGEST).toString('hex')
    return {salt: salt.toString('base64'), hash} 
}

function verify(password, salt, hash) {
    let saltBuffer = Buffer.from(salt, 'base64')
    return pbkdf2Sync(password, saltBuffer, ROUNDS, LENGTH, DIGEST).toString('hex') === hash
}

module.exports = {
    derive,
    verify
}