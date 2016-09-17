'use strict'

const {derive, verify} = require('../lib/password-util')
const {strictEqual} = require('assert')

describe('password util', function(){
    const PSWD = 'secret'
    let salt, hash
    it('computes salted hash', function(){
        ;( {salt, hash} = derive(PSWD) )
        strictEqual(typeof salt, 'string', 'returned salt is string')
        strictEqual(typeof hash, 'string', 'returned hash is string')
    })
    it('verifies computed hash', function(){
        let result = verify(PSWD, salt, hash)
        strictEqual(result, true, 'return true for correct password')
    })
    it('rejects wrong password', function(){
        let result = verify(PSWD+'123', salt, hash)
        strictEqual(result, false, 'return false for wrong password')
    })
})